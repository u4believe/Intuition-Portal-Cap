'use strict'

/**
 * Railway Notification Worker
 *
 * Runs directly on Railway — no Vercel endpoint calls.
 * Polls the Intuition GraphQL API and sends web push notifications
 * to subscribers based on their alert preferences.
 *
 * Replaces: Render (poll-notifications.js) + UptimeRobot
 *
 * Required env vars:
 *   DATABASE_URL       — Postgres connection string
 *   VAPID_PUBLIC_KEY   — Web Push VAPID public key
 *   VAPID_PRIVATE_KEY  — Web Push VAPID private key
 *   VAPID_SUBJECT      — Web Push VAPID subject (mailto: or https:)
 */

const { Pool } = require('pg')
const webpush = require('web-push')

const POLL_INTERVAL_EVENTS_MS = 10 * 1000    // 10 seconds — live deposit/redemption events
const POLL_INTERVAL_SNAPSHOTS_MS = 30 * 1000 // 30 seconds — watched-claim snapshot comparisons
const POLL_INTERVAL_BILLING_MS = 15 * 60 * 1000 // 15 minutes — Premium renewals (runs in the web app)
const GRAPHQL_URL = 'https://mainnet.intuition.sh/v1/graphql'

// ── Startup validation ────────────────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error('[Worker] Missing required env vars:', missing.join(', '))
  process.exit(1)
}

// ── DB pool ───────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── VAPID ─────────────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// ── Premium renewals ──────────────────────────────────────────────────────────
// Billing logic lives in the Next.js app (lib/billing); the worker only
// triggers it. Optional: set APP_URL + CRON_SECRET to enable.
let billingRunning = false
async function triggerBillingRenewals() {
  if (billingRunning) return
  billingRunning = true
  try {
    const res = await fetch(`${process.env.APP_URL.replace(/\/$/, '')}/api/cron/billing`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(120000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) console.warn(`[Worker] Billing cron returned ${res.status}`)
    else if (body && (body.charged || body.reconciled || body.errors)) console.log('[Worker] Billing:', body)
  } catch (e) {
    console.warn('[Worker] Billing cron error:', e.message)
  } finally {
    billingRunning = false
  }
}

// ── Activity patterns (scripts/patterns) ──────────────────────────────────────
// Collects all Intuition deposits/redemptions/creations every 5 min and
// recomputes pattern metrics hourly. Disable with PATTERNS_ENABLED=false.
const { collectOnce } = require('./patterns/collector')
const { computeMetrics } = require('./patterns/metrics')
const { archiveOnce } = require('./patterns/archive')
const POLL_INTERVAL_PATTERNS_MS = 5 * 60 * 1000
const PATTERN_METRICS_EVERY_MS = 60 * 60 * 1000
let patternsRunning = false
let patternsPausedUntil = 0
let lastMetricsAt = 0

async function runPatterns() {
  if (patternsRunning || Date.now() < patternsPausedUntil) return
  patternsRunning = true
  try {
    const c = await collectOnce(pool, queryGraphQL)
    if (c.inserted || c.balances || c.pruned) {
      console.log(`[Patterns] collected=${c.inserted} balances=${c.balances} pruned=${c.pruned}${c.caughtUp ? '' : ' (backfilling…)'}`)
    }
    // Measure once the backfill has caught up, then hourly.
    if (c.caughtUp && Date.now() - lastMetricsAt >= PATTERN_METRICS_EVERY_MS) {
      const results = await computeMetrics(pool)
      lastMetricsAt = Date.now()
      const failed = results.filter(r => !r.ok)
      console.log(`[Patterns] metrics computed: ${results.length - failed.length}/${results.length} ok`)
    }
    await runArchive()
  } catch (e) {
    if (e.code === '42P01') {
      // Tables missing: migration 14 hasn't run yet. Check again in an hour.
      console.warn('[Patterns] Pattern tables not found — run scripts/14-add-pattern-tables.sql. Pausing for 1h.')
      patternsPausedUntil = Date.now() + 60 * 60 * 1000
    } else {
      console.error('[Patterns] Run failed:', e.message)
    }
  } finally {
    patternsRunning = false
  }
}

// All-time archive in Cloudflare R2 (no-op until R2_* variables are set).
// Isolated from collection: an archive problem never pauses data collection.
let archivePausedUntil = 0
async function runArchive() {
  if (Date.now() < archivePausedUntil) return
  try {
    const a = await archiveOnce(pool, queryGraphQL)
    if (a && a.archived.length) {
      const unverified = a.archived.filter(d => !d.verified).map(d => d.day)
      console.log(`[Archive] +${a.archived.length} day(s), ${a.remaining} left; total ${a.manifest.total_events} events`
        + (unverified.length ? `; unverified: ${unverified.join(', ')}` : ''))
    }
  } catch (e) {
    if (e.code === '42P01') {
      console.warn('[Archive] Archive tables not found — run scripts/15-add-archive-tables.sql. Pausing for 1h.')
    } else {
      console.error('[Archive] Run failed:', e.message)
    }
    archivePausedUntil = Date.now() + (e.code === '42P01' ? 60 : 10) * 60 * 1000
  }
}

// ── GraphQL ───────────────────────────────────────────────────────────────────
async function queryGraphQL(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0]?.message || 'GraphQL error')
  return data.data
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getAllSubscriptions() {
  try {
    const result = await pool.query('SELECT * FROM push_subscriptions')
    return result.rows.map(row => ({ ...row, claim_alert_prefs: row.claim_alert_prefs || {} }))
  } catch (e) {
    console.error('[Worker] getAllSubscriptions failed:', e.message)
    return []
  }
}

async function getClaimSnapshots() {
  try {
    const result = await pool.query('SELECT * FROM claim_snapshots')
    return result.rows
  } catch (e) {
    console.error('[Worker] getClaimSnapshots failed:', e.message)
    return []
  }
}

async function upsertClaimSnapshot(snapshot) {
  try {
    await pool.query(
      `INSERT INTO claim_snapshots
         (claim_label, market_cap, position_count, total_shares, total_assets, current_share_price, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (claim_label) DO UPDATE SET
         market_cap = $2, position_count = $3, total_shares = $4,
         total_assets = $5, current_share_price = $6, updated_at = NOW()`,
      [
        snapshot.claim_label, snapshot.market_cap, snapshot.position_count,
        snapshot.total_shares, snapshot.total_assets, snapshot.current_share_price,
      ]
    )
  } catch (e) {
    console.error('[Worker] upsertClaimSnapshot failed:', e.message)
  }
}

async function deleteSubscription(endpoint) {
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
  } catch (e) {
    console.error('[Worker] deleteSubscription failed:', e.message)
  }
}

// ── Push notification ─────────────────────────────────────────────────────────
async function sendPushNotification(subscription, payload) {
  const shortEndpoint = subscription.endpoint.slice(-30)
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: payload.title, body: payload.body, tag: payload.tag || 'claim-update', url: payload.url || '/' })
    )
    console.log(`[Worker] Sent to ...${shortEndpoint}`)
    return true
  } catch (e) {
    if (e?.statusCode === 410) {
      console.log(`[Worker] Subscription expired (410), removing: ...${shortEndpoint}`)
      await deleteSubscription(subscription.endpoint)
    } else {
      console.error(`[Worker] Send failed — status=${e?.statusCode} endpoint=...${shortEndpoint}`)
    }
    return false
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? 0 : n / 1e18
}

function pctChange(oldVal, newVal) {
  if (oldVal === 0) return newVal > 0 ? 100 : 0
  return Math.abs((newVal - oldVal) / oldVal) * 100
}

function inRange(value, min, max) {
  return value >= min && value <= max
}

// ── GraphQL queries ───────────────────────────────────────────────────────────
const CLAIM_DATA_QUERY = `
  query GetClaimsByTermId($termIds: [String!]) {
    terms(where: { id: { _in: $termIds } }) {
      id
      total_market_cap
      total_assets
      vaults { position_count current_share_price total_shares }
      share_price_change_stats_daily { first_share_price last_share_price }
    }
  }
`

const RECENT_DEPOSITS_QUERY = `
  query GetRecentDeposits($since: timestamptz) {
    deposits(where: { created_at: { _gte: $since } }, order_by: { created_at: desc }) {
      id created_at assets_after_fees sender_id
      vault { term { id atom { label } triple { term_id subject { label } predicate { label } object { label } } } }
    }
  }
`

const RECENT_REDEMPTIONS_QUERY = `
  query GetRecentRedemptions($since: timestamptz) {
    redemptions(where: { created_at: { _gte: $since } }, order_by: { created_at: desc }) {
      id created_at assets receiver_id
      vault { term { id atom { label } triple { term_id subject { label } predicate { label } object { label } } } }
    }
  }
`

// ── Premium private activity ─────────────────────────────────────────────────
// Wallets whose deposits/redemptions must not alert other users: Premium
// subscribers with hide_activity on. The access condition mirrors
// hasPremiumAccess() / RENEWAL_POLICY in lib/billing/subscriptions.ts — keep in sync.
async function getPrivateActivityAddresses() {
  const result = await pool.query(`
    SELECT lower(substring(user_ref FROM 8)) AS address
      FROM billing_subscriptions
     WHERE hide_activity AND user_ref LIKE 'wallet:%'
       AND current_period_end IS NOT NULL
       AND current_period_end + CASE
             WHEN status = 'past_due' THEN CASE billing_interval
               WHEN 'daily' THEN interval '12 hours'
               WHEN 'monthly' THEN interval '72 hours'
               WHEN 'yearly' THEN interval '72 hours'
               ELSE interval '0' END
             ELSE interval '0' END > NOW()`)
  const addresses = new Set(result.rows.map(r => r.address))
  // Discord subscribers hide the wallet they linked. Separate query so a missing
  // links table (migration 13 pending) can't break wallet sign-ins' privacy.
  try {
    const linked = await pool.query(`
      SELECT l.wallet_address AS address
        FROM billing_subscriptions s
        JOIN account_wallet_links l ON l.account_ref = s.user_ref
       WHERE s.hide_activity
         AND s.current_period_end IS NOT NULL
         AND s.current_period_end + CASE
               WHEN s.status = 'past_due' THEN CASE s.billing_interval
                 WHEN 'daily' THEN interval '12 hours'
                 WHEN 'monthly' THEN interval '72 hours'
                 WHEN 'yearly' THEN interval '72 hours'
                 ELSE interval '0' END
               ELSE interval '0' END > NOW()`)
    for (const r of linked.rows) addresses.add(r.address)
  } catch (e) {
    if (e.code !== '42P01') throw e
  }
  return addresses
}

// ── Live events fetch ─────────────────────────────────────────────────────────
async function fetchRecentLiveEvents(since) {
  const events = []
  const sinceISO = since.toISOString()

  function resolveLabel(term) {
    if (term?.atom?.label) return term.atom.label
    const t = term?.triple
    if (t) return `${t.subject?.label || '?'} → ${t.predicate?.label || '?'} → ${t.object?.label || '?'}`
    return 'Unknown'
  }

  try {
    const depositsData = await queryGraphQL(RECENT_DEPOSITS_QUERY, { since: sinceISO })
    ;(depositsData?.deposits || []).forEach(d => {
      events.push({
        id: String(d.id), type: 'deposit',
        termId: d.vault?.term?.id || '',
        atomLabel: resolveLabel(d.vault?.term),
        assets: toNumber(d.assets_after_fees),
        createdAt: d.created_at,
        actor: String(d.sender_id || '').toLowerCase(),
      })
    })
  } catch (e) { console.warn('[Worker] Deposit fetch failed:', e.message) }

  try {
    const redemptionsData = await queryGraphQL(RECENT_REDEMPTIONS_QUERY, { since: sinceISO })
    ;(redemptionsData?.redemptions || []).forEach(r => {
      events.push({
        id: String(r.id), type: 'redemption',
        termId: r.vault?.term?.id || '',
        atomLabel: resolveLabel(r.vault?.term),
        assets: toNumber(r.assets),
        createdAt: r.created_at,
        actor: String(r.receiver_id || '').toLowerCase(),
      })
    })
  } catch (e) { console.warn('[Worker] Redemption fetch failed:', e.message) }

  return events
}

// ── Main check logic ──────────────────────────────────────────────────────────
async function runCheck(mode, since) {
  const doEvents = mode === 'all' || mode === 'events'
  const doSnapshots = mode === 'all' || mode === 'snapshots'

  const subscriptions = await getAllSubscriptions()
  if (subscriptions.length === 0) return

  // 1. Live events
  let liveEvents = []
  let privateActors = new Set()
  if (doEvents) {
    liveEvents = await fetchRecentLiveEvents(since)
    try {
      privateActors = await getPrivateActivityAddresses()
    } catch (e) {
      if (e.code === '42703' || e.code === '42P01') {
        // Column/table not created yet (migration 12 pending): nobody can have opted in.
        privateActors = new Set()
      } else {
        // Fail closed: better to skip one round of event alerts than leak private activity.
        console.error('[Worker] Could not load private-activity wallets — skipping event alerts:', e.message)
        liveEvents = []
      }
    }
    if (liveEvents.length > 0) {
      console.log(`[Worker] [events] ${liveEvents.length} event(s) since ${since.toISOString()}`)
    }
  }

  // 2. Collect watched term IDs
  const allTermIds = new Set()
  if (doSnapshots) {
    for (const sub of subscriptions) {
      for (const termId of Object.keys(sub.claim_alert_prefs || {})) {
        if (termId) allTermIds.add(termId)
      }
    }
  }

  // 3. Fetch current claim data from GraphQL
  const currentClaimsMap = new Map()
  if (doSnapshots && allTermIds.size > 0) {
    try {
      const result = await queryGraphQL(CLAIM_DATA_QUERY, { termIds: Array.from(allTermIds) })
      for (const term of (result?.terms || [])) {
        const termVaults = term.vaults || []
        const snap = {
          claim_label: term.id,
          market_cap: toNumber(term.total_market_cap),
          total_assets: toNumber(term.total_assets),
          total_shares: termVaults.reduce((s, v) => s + toNumber(v.total_shares), 0),
          position_count: termVaults.reduce((s, v) => s + (v.position_count || 0), 0),
          current_share_price: termVaults.reduce((s, v) => s + toNumber(v.current_share_price), 0),
        }
        const dailyStats = term.share_price_change_stats_daily?.[0]
        if (dailyStats && parseFloat(dailyStats.first_share_price || '0') > 0) {
          const first = parseFloat(dailyStats.first_share_price) / 1e18
          const last = parseFloat(dailyStats.last_share_price) / 1e18
          snap.pct_change_24h = first >= 0.001 ? ((last - first) / first) * 100 : 0
        }
        currentClaimsMap.set(term.id, snap)
      }
    } catch (e) { console.error('[Worker] Claim GraphQL failed:', e.message) }
  }

  // 4. Load snapshots baseline from DB
  const snapshots = doSnapshots ? await getClaimSnapshots() : []
  const snapshotsMap = new Map()
  for (const snap of snapshots) snapshotsMap.set(snap.claim_label, snap)

  // 5. Build alerts per subscription
  const notificationsToSend = []

  for (const subscription of subscriptions) {
    const alerts = []
    const claimPrefs = subscription.claim_alert_prefs || {}

    // A. Snapshot-based alerts (market cap, positions, shares)
    if (doSnapshots) {
      for (const [termId, pref] of Object.entries(claimPrefs)) {
        const current = currentClaimsMap.get(termId)
        const previous = snapshotsMap.get(termId)
        if (!current || !previous) continue

        const marketCapChange = pctChange(previous.market_cap, current.market_cap)
        const positionChange = Math.abs(current.position_count - previous.position_count)
        const sharesChange = pctChange(previous.total_shares, current.total_shares)
        const mktCapThreshold = pref.marketCapMin ?? 2
        const sharesThreshold = pref.sharesChangeMin ?? 2

        let trendSuffix = ''
        if (current.pct_change_24h) {
          const val = current.pct_change_24h
          const opts = Math.abs(val) > 1000 ? { notation: 'compact' } : { maximumFractionDigits: 1 }
          trendSuffix = ` (24h: ${val > 0 ? '+' : ''}${new Intl.NumberFormat('en-US', opts).format(val)}%)`
        }

        if (pref.marketCap && marketCapChange >= mktCapThreshold) {
          const dir = current.market_cap > previous.market_cap ? '↑' : '↓'
          alerts.push(`${pref.label}: market cap ${dir}${marketCapChange.toFixed(1)}%${trendSuffix}`)
        }
        if (pref.positionCount && positionChange >= 1) {
          const dir = current.position_count > previous.position_count ? '+' : '-'
          alerts.push(`${pref.label}: ${dir}${positionChange} position${positionChange > 1 ? 's' : ''}${trendSuffix}`)
        }
        if (pref.sharesChange && sharesChange >= sharesThreshold) {
          const dir = current.total_shares > previous.total_shares ? '↑' : '↓'
          alerts.push(`${pref.label}: shares ${dir}${sharesChange.toFixed(1)}%${trendSuffix}`)
        }

        // Smart alert: trending/viral detection
        if (subscription.receive_smart_alerts !== false) {
          const positionGrowth = previous.position_count > 0
            ? (current.position_count - previous.position_count) / previous.position_count
            : 0
          if (positionGrowth >= 0.20 && current.position_count >= 10) {
            alerts.push(`🚀 Trending Now: ${pref.label} just surged in backers!`)
          }
        }
      }
    }

    // B. Live event alerts (deposits / redemptions)
    if (doEvents) {
      const DEFAULT_RANGE = { enabled: true, min: 0, max: 10_000 }
      const ranges = subscription.alert_ranges
      const depositCfg = ranges?.deposits ?? DEFAULT_RANGE
      const redemptionCfg = ranges?.redemptions ?? DEFAULT_RANGE

      const ownAddress = String(subscription.address || '').toLowerCase()
      for (const event of liveEvents) {
        // Private activity: only the wallet's owner is alerted about it.
        if (privateActors.has(event.actor) && event.actor !== ownAddress) continue
        const claimPref = claimPrefs[event.termId]
        if (claimPref) {
          if (event.type === 'deposit' && claimPref.deposits) {
            const min = claimPref.depositsMin ?? 0
            const max = claimPref.depositsMax ?? 10_000
            if (inRange(event.assets, min, max))
              alerts.push(`Deposit: ${event.assets.toFixed(2)} TRUST on "${claimPref.label || event.atomLabel}"`)
          }
          if (event.type === 'redemption' && claimPref.redemptions) {
            const min = claimPref.redemptionsMin ?? 0
            const max = claimPref.redemptionsMax ?? 10_000
            if (inRange(event.assets, min, max))
              alerts.push(`Redemption: ${event.assets.toFixed(2)} TRUST on "${claimPref.label || event.atomLabel}"`)
          }
        } else {
          if (event.type === 'deposit' && depositCfg?.enabled && inRange(event.assets, depositCfg.min, depositCfg.max))
            alerts.push(`Deposit: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
          if (event.type === 'redemption' && redemptionCfg?.enabled && inRange(event.assets, redemptionCfg.min, redemptionCfg.max))
            alerts.push(`Redemption: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
        }

        // Smart alert: whale detection
        if (subscription.receive_smart_alerts !== false && event.assets >= 5000) {
          alerts.push(
            event.type === 'deposit'
              ? `🐋 Whale Alert: Massive ${event.assets.toFixed(0)} TRUST deposit just backed "${event.atomLabel}"!`
              : `⚠️ Massive Dump: A Whale just redeemed ${event.assets.toFixed(0)} TRUST from "${event.atomLabel}".`
          )
        }
      }
    }

    if (alerts.length > 0) {
      notificationsToSend.push({
        subscription,
        payload: {
          title: `Portal Cap Alert${alerts.length > 1 ? 's' : ''}`,
          body: alerts.slice(0, 3).join(' | '),
          tag: 'portal-cap-alert',
          url: '/',
        },
      })
    }
  }

  // 6. Send notifications
  let totalNotified = 0
  await Promise.allSettled(
    notificationsToSend.map(async ({ subscription, payload }) => {
      const sent = await sendPushNotification(subscription, payload)
      if (sent) totalNotified++
    })
  )

  // 7. Update snapshot baseline in DB
  if (doSnapshots && currentClaimsMap.size > 0) {
    await Promise.allSettled(Array.from(currentClaimsMap.values()).map(snap => upsertClaimSnapshot(snap)))
  }

  if (totalNotified > 0 || liveEvents.length > 0) {
    console.log(`[Worker] [${mode}] subs=${subscriptions.length} events=${liveEvents.length} sent=${totalNotified}`)
  }
}

// ── Polling state ─────────────────────────────────────────────────────────────
let lastEventsPollAt = null
let eventsRunning = false
let snapshotsRunning = false

async function checkEvents() {
  if (eventsRunning) return
  eventsRunning = true
  const thisPollStart = new Date()
  const since = lastEventsPollAt ? new Date(lastEventsPollAt) : new Date(Date.now() - 30_000)
  try {
    await runCheck('events', since)
    lastEventsPollAt = thisPollStart.toISOString()
  } catch (e) {
    console.error('[Worker] checkEvents error:', e.message)
  } finally {
    eventsRunning = false
  }
}

async function checkSnapshots() {
  if (snapshotsRunning) return
  snapshotsRunning = true
  try {
    await runCheck('snapshots', new Date(Date.now() - 30_000))
  } catch (e) {
    console.error('[Worker] checkSnapshots error:', e.message)
  } finally {
    snapshotsRunning = false
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  console.log('[Worker] Starting Railway notification worker')
  console.log(`[Worker] Events: every ${POLL_INTERVAL_EVENTS_MS / 1000}s | Snapshots: every ${POLL_INTERVAL_SNAPSHOTS_MS / 1000}s`)

  try {
    await pool.query('SELECT 1')
    console.log('[Worker] DB connection OK')
  } catch (e) {
    console.error('[Worker] DB connection failed:', e.message)
    process.exit(1)
  }

  await checkEvents()
  setTimeout(() => checkSnapshots(), 2000)

  setInterval(checkEvents, POLL_INTERVAL_EVENTS_MS)
  setInterval(checkSnapshots, POLL_INTERVAL_SNAPSHOTS_MS)

  if (process.env.APP_URL && process.env.CRON_SECRET) {
    console.log(`[Worker] Billing renewals: every ${POLL_INTERVAL_BILLING_MS / 60000} min via ${process.env.APP_URL}`)
    triggerBillingRenewals()
    setInterval(triggerBillingRenewals, POLL_INTERVAL_BILLING_MS)
  } else {
    console.warn('[Worker] APP_URL / CRON_SECRET not set — Premium renewals will not be triggered')
  }

  if (process.env.PATTERNS_ENABLED !== 'false') {
    console.log(`[Worker] Activity patterns: collect every ${POLL_INTERVAL_PATTERNS_MS / 60000} min, metrics hourly`)
    const missingR2 = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter(k => !process.env[k])
    if (missingR2.length) console.warn(`[Worker] R2 archive: OFF — missing ${missingR2.join(', ')}`)
    else console.log(`[Worker] R2 archive: ON (bucket ${process.env.R2_BUCKET})`)
    setTimeout(runPatterns, 5000)
    setInterval(runPatterns, POLL_INTERVAL_PATTERNS_MS)
  }

  console.log('[Worker] Running.')
}

process.on('SIGTERM', async () => {
  console.log('[Worker] Shutting down gracefully...')
  await pool.end()
  process.exit(0)
})

main().catch(e => {
  console.error('[Worker] Fatal error:', e)
  process.exit(1)
})
