import { NextRequest, NextResponse } from 'next/server'
import {
  getAllSubscriptions,
  getClaimSnapshots,
  upsertClaimSnapshot,
  sendPushNotification,
  ClaimSnapshot,
} from '@/lib/web-push-server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

// ─── Claim snapshot query — uses term-level aggregates (Lin+Exp combined) ─────
// Querying `terms` directly (not `vaults`) ensures we get the true combined total
// for both Support (termId) and Against (opposeTermId / counter_term.id) watched claims.
// term.total_market_cap and term.total_assets are pre-computed Lin+Exp sums.
// term.vaults[] always returns ALL vaults — summing them gives accurate totals.
const CLAIM_DATA_QUERY = `
  query GetClaimsByTermId($termIds: [String!]) {
    terms(where: { id: { _in: $termIds } }) {
      id
      total_market_cap
      total_assets
      vaults {
        position_count
        current_share_price
        total_shares
      }
      share_price_change_stats_daily {
        first_share_price
        last_share_price
      }
    }
  }
`

// ─── Live Events queries — include vault term ID for claim matching ───────────
const RECENT_DEPOSITS_QUERY = `
  query GetRecentDeposits($since: timestamptz) {
    deposits(
      where: { created_at: { _gte: $since } }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      assets_after_fees
      vault {
        term {
          id
          atom { label }
          triple {
            term_id
            subject { label }
            predicate { label }
            object { label }
          }
        }
      }
    }
  }
`

const RECENT_REDEMPTIONS_QUERY = `
  query GetRecentRedemptions($since: timestamptz) {
    redemptions(
      where: { created_at: { _gte: $since } }
      order_by: { created_at: desc }
    ) {
      id
      created_at
      assets
      vault {
        term {
          id
          atom { label }
          triple {
            term_id
            subject { label }
            predicate { label }
            object { label }
          }
        }
      }
    }
  }
`

interface TermData {
  id: string
  total_market_cap: string
  total_assets: string
  vaults: Array<{
    position_count: number
    current_share_price: string
    total_shares: string
  }>
  share_price_change_stats_daily?: Array<{
    first_share_price: string
    last_share_price: string
  }>
}

interface LiveEvent {
  id: string
  type: 'deposit' | 'redemption'
  termId: string
  atomLabel: string
  assets: number
  createdAt: string
}

function toNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 0
  if (n > 1e15) return n / 1e18
  return n
}

function pctChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0
  return Math.abs((newVal - oldVal) / oldVal) * 100
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

async function fetchRecentLiveEvents(since: Date): Promise<LiveEvent[]> {
  const events: LiveEvent[] = []
  const sinceISO = since.toISOString()

  function resolveLabel(term: any): string {
    const atomLabel = term?.atom?.label
    if (atomLabel) return atomLabel
    const triple = term?.triple
    if (triple) {
      return `${triple.subject?.label || '?'} → ${triple.predicate?.label || '?'} → ${triple.object?.label || '?'}`
    }
    return 'Unknown'
  }

  try {
    const depositsData = await queryIntuitionGraphQL(RECENT_DEPOSITS_QUERY, { since: sinceISO })
    ;(depositsData?.deposits || []).forEach((d: any) => {
      const raw = d.assets_after_fees ? parseFloat(d.assets_after_fees) : 0
      const assets = raw > 1e15 ? raw / 1e18 : raw
      events.push({
        id: String(d.id),
        type: 'deposit',
        termId: d.vault?.term?.id || '',
        atomLabel: resolveLabel(d.vault?.term),
        assets,
        createdAt: d.created_at,
      })
    })
  } catch (e) {
    console.warn('[Check Notifications] Deposit fetch failed:', e)
  }

  try {
    const redemptionsData = await queryIntuitionGraphQL(RECENT_REDEMPTIONS_QUERY, { since: sinceISO })
    ;(redemptionsData?.redemptions || []).forEach((r: any) => {
      const raw = r.assets ? parseFloat(r.assets) : 0
      const assets = raw > 1e15 ? raw / 1e18 : raw
      events.push({
        id: String(r.id),
        type: 'redemption',
        termId: r.vault?.term?.id || '',
        atomLabel: resolveLabel(r.vault?.term),
        assets,
        createdAt: r.created_at,
      })
    })
  } catch (e) {
    console.warn('[Check Notifications] Redemption fetch failed:', e)
  }

  return events
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-cron-secret')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscriptions = await getAllSubscriptions()
    console.log(`[Check Notifications] Loaded ${subscriptions.length} subscription(s)`)

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        subscriptions: 0,
        claimsWatched: 0,
        liveEventsChecked: 0,
        notificationsSent: 0,
        message: 'No subscriptions',
      })
    }

    for (const sub of subscriptions) {
      const claimCount = Object.keys(sub.claim_alert_prefs || {}).length
      console.log(
        `[Check Notifications] Sub: address=${sub.address}, ` +
        `claimPrefs=${claimCount}, ` +
        `watched=${JSON.stringify(sub.watched_claims)}, ` +
        `ranges=${JSON.stringify(sub.alert_ranges)}`
      )
    }

    // ── 0. Determine mode ────────────────────────────────────────────────────
    // mode=events   → live deposits/redemptions only (fast, run every 10s)
    // mode=snapshots → watched-claim comparison only (run every 15s)
    // mode=all (default) → both (used for manual/backward-compat calls)
    const mode = req.nextUrl.searchParams.get('mode') ?? 'all'
    const doEvents = mode === 'all' || mode === 'events'
    const doSnapshots = mode === 'all' || mode === 'snapshots'

    // ── 1. Determine the "since" timestamp ──────────────────────────────────
    const sinceParam = req.nextUrl.searchParams.get('since')
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 30 * 1000)

    // ── 2. Fetch live events (events mode only) ──────────────────────────────
    let liveEvents: LiveEvent[] = []
    if (doEvents) {
      console.log(`[Check Notifications] [events] Fetching since: ${since.toISOString()}`)
      liveEvents = await fetchRecentLiveEvents(since)
      console.log(`[Check Notifications] Got ${liveEvents.length} live event(s)`)
      for (const ev of liveEvents) {
        console.log(`  [Event] ${ev.type} id=${ev.id} assets=${ev.assets.toFixed(4)} TRUST termId="${ev.termId}" atom="${ev.atomLabel}"`)
      }
    }

    // ── 3. Collect all termIds from claim_alert_prefs (snapshots mode only) ──
    const allTermIds = new Set<string>()
    if (doSnapshots) {
      for (const sub of subscriptions) {
        for (const termId of Object.keys(sub.claim_alert_prefs || {})) {
          if (termId) allTermIds.add(termId)
        }
      }
    }

    // ── 4. Fetch current claim data for all watched term IDs ─────────────────
    const currentClaimsMap = new Map<string, ClaimSnapshot>()
    if (doSnapshots && allTermIds.size > 0) {
      console.log(`[Check Notifications] [snapshots] Fetching claim data for ${allTermIds.size} term ID(s)`)
      try {
        const result = await queryIntuitionGraphQL(CLAIM_DATA_QUERY, {
          termIds: Array.from(allTermIds),
        })
        for (const term of (result?.terms || []) as TermData[]) {
          const termId = term.id
          if (!termId) continue
          const termVaults = term.vaults || []
          const snap: ClaimSnapshot = {
            claim_label: termId,
            market_cap: toNumber(term.total_market_cap),
            total_assets: toNumber(term.total_assets),
            // Sum Lin+Exp vaults for accurate combined totals (works for both For and Against termIds)
            total_shares: termVaults.reduce((s, v) => s + toNumber(v.total_shares), 0),
            position_count: termVaults.reduce((s, v) => s + (v.position_count || 0), 0),
            current_share_price: termVaults.reduce((s, v) => s + toNumber(v.current_share_price), 0),
          }
          const dailyStats = term.share_price_change_stats_daily?.[0]
          if (dailyStats && parseFloat(dailyStats.first_share_price || '0') > 0) {
            const first = parseFloat(dailyStats.first_share_price)
            const last = parseFloat(dailyStats.last_share_price)
            snap.pct_change_24h = ((last - first) / first) * 100
          }
          currentClaimsMap.set(termId, snap)
          console.log(`  [Claim] termId="${termId}" marketCap=${snap.market_cap.toFixed(4)} positions=${snap.position_count} vaults=${termVaults.length}`)
        }
      } catch (e) {
        console.error('[Check Notifications] Claim GraphQL failed:', e)
      }
    }

    // Load claim snapshots (baseline) from DB, keyed by termId
    const snapshots = doSnapshots ? await getClaimSnapshots() : []
    const snapshotsMap = new Map<string, ClaimSnapshot>()
    for (const snap of snapshots) snapshotsMap.set(snap.claim_label, snap)
    if (doSnapshots) console.log(`[Check Notifications] Loaded ${snapshots.length} claim snapshot(s) from DB`)

    // ── 5. Build notifications per subscription ──────────────────────────────
    const notificationsToSend: Array<{
      subscription: typeof subscriptions[0]
      payload: { title: string; body: string; tag: string; url: string }
    }> = []

    for (const subscription of subscriptions) {
      const alerts: string[] = []
      const claimPrefs = subscription.claim_alert_prefs || {}

      // ─ A. Per-claim snapshot alerts (marketCap, positionCount, sharesChange) ─
      if (doSnapshots) for (const [termId, pref] of Object.entries(claimPrefs)) {
        const current = currentClaimsMap.get(termId)
        const previous = snapshotsMap.get(termId)

        if (!current) {
          console.log(`  [Claim alert] No current data for termId="${termId}" (${pref.label}), skipping`)
          continue
        }
        if (!previous) {
          console.log(`  [Claim alert] No snapshot for "${pref.label}" — baseline set this run`)
          continue
        }

        const marketCapChange = pctChange(previous.market_cap, current.market_cap)
        const positionChange = Math.abs(current.position_count - previous.position_count)
        const sharesChange = pctChange(previous.total_shares, current.total_shares)

        console.log(
          `  [Claim alert] "${pref.label}" marketCap Δ${marketCapChange.toFixed(1)}% ` +
          `positions Δ${positionChange} shares Δ${sharesChange.toFixed(1)}%`
        )

        const mktCapThreshold = pref.marketCapMin ?? 2
        const sharesThreshold = pref.sharesChangeMin ?? 2
        const trendSuffix = current.pct_change_24h ? ` (24h: ${current.pct_change_24h > 0 ? '+' : ''}${current.pct_change_24h.toFixed(1)}%)` : ''

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
        
        // Smart Alert: Trending / Viral Claim Detection
        if (subscription.receive_smart_alerts !== false) {
          const positionGrowth = previous.position_count > 0 ? (current.position_count - previous.position_count) / previous.position_count : 0
          if (positionGrowth >= 0.20 && current.position_count >= 10) {
            alerts.push(`🚀 Trending Now: ${pref.label} just surged in backers!`)
          }
        }
      }

      // ─ B. Live event alerts ───────────────────────────────────────────────
      if (doEvents) {
      const DEFAULT_RANGE = { enabled: true, min: 0, max: 10_000 }
      const ranges = subscription.alert_ranges
      const depositCfg = ranges?.deposits ?? DEFAULT_RANGE
      const redemptionCfg = ranges?.redemptions ?? DEFAULT_RANGE

      for (const event of liveEvents) {
        const claimPref = claimPrefs[event.termId]

        if (claimPref) {
          // Per-claim alert: deposit/redemption on a specifically watched claim
          if (event.type === 'deposit' && claimPref.deposits) {
            const label = claimPref.label || event.atomLabel
            const min = claimPref.depositsMin ?? 0
            const max = claimPref.depositsMax ?? 10_000
            const matches = inRange(event.assets, min, max)
            console.log(`    [Deposit/Watched] "${label}" assets=${event.assets.toFixed(4)} range=${min}-${max} match=${matches}`)
            if (matches) alerts.push(`Deposit: ${event.assets.toFixed(2)} TRUST on "${label}"`)
          }
          if (event.type === 'redemption' && claimPref.redemptions) {
            const label = claimPref.label || event.atomLabel
            const min = claimPref.redemptionsMin ?? 0
            const max = claimPref.redemptionsMax ?? 10_000
            const matches = inRange(event.assets, min, max)
            console.log(`    [Redemption/Watched] "${label}" assets=${event.assets.toFixed(4)} range=${min}-${max} match=${matches}`)
            if (matches) alerts.push(`Redemption: ${event.assets.toFixed(2)} TRUST on "${label}"`)
          }
        } else {
          // Global range alert: fire for any event in the configured TRUST range
          if (event.type === 'deposit' && depositCfg?.enabled) {
            const matches = inRange(event.assets, depositCfg.min, depositCfg.max)
            console.log(
              `    [Deposit/Global] assets=${event.assets.toFixed(4)} ` +
              `range=${depositCfg.min}-${depositCfg.max} match=${matches}`
            )
            if (matches) alerts.push(`Deposit: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
          }
          if (event.type === 'redemption' && redemptionCfg?.enabled) {
            const matches = inRange(event.assets, redemptionCfg.min, redemptionCfg.max)
            console.log(
              `    [Redemption/Global] assets=${event.assets.toFixed(4)} ` +
              `range=${redemptionCfg.min}-${redemptionCfg.max} match=${matches}`
            )
            if (matches) alerts.push(`Redemption: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
          }
        }

        // Smart Alert: Whale Activity Detection
        if (subscription.receive_smart_alerts !== false) {
          const isWhale = event.assets >= 5000;
          if (isWhale) {
            if (event.type === 'deposit') {
              alerts.push(`🐋 Whale Alert: Massive ${event.assets.toFixed(0)} TRUST deposit just backed "${event.atomLabel}"!`)
            } else {
              alerts.push(`⚠️ Massive Dump: A Whale just redeemed ${event.assets.toFixed(0)} TRUST from "${event.atomLabel}".`)
            }
          }
        }
      }
      } // end if (doEvents)

      if (alerts.length > 0) {
        console.log(`  [Notify] Queuing ${alerts.length} alert(s) for ${subscription.address}`)
        notificationsToSend.push({
          subscription,
          payload: {
            title: `Portal Cap Alert${alerts.length > 1 ? 's' : ''}`,
            body: alerts.slice(0, 3).join(' | '),
            tag: 'portal-cap-alert',
            url: '/',
          },
        })
      } else {
        console.log(`  [Notify] No alerts for ${subscription.address}`)
      }
    }

    // ── 6. Send notifications ─────────────────────────────────────────────────
    let totalNotified = 0
    await Promise.allSettled(
      notificationsToSend.map(async ({ subscription, payload }) => {
        const sent = await sendPushNotification(subscription, payload)
        if (sent) totalNotified++
      })
    )

    // ── 7. Update claim snapshots as new baseline (snapshots mode only) ───────
    if (doSnapshots && currentClaimsMap.size > 0) {
      await Promise.allSettled(
        Array.from(currentClaimsMap.values()).map(snap => upsertClaimSnapshot(snap))
      )
      console.log(`[Check Notifications] Updated ${currentClaimsMap.size} claim snapshot(s)`)
    }

    console.log(
      `[Check Notifications] Done. [${mode}] ${subscriptions.length} subs, ` +
      `${liveEvents.length} events, ${totalNotified} sent`
    )

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.length,
      claimsWatched: allTermIds.size,
      liveEventsChecked: liveEvents.length,
      notificationsSent: totalNotified,
    })
  } catch (error) {
    console.error('[Check Notifications] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = GET
