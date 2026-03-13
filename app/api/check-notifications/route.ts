import { NextRequest, NextResponse } from 'next/server'
import {
  getAllSubscriptions,
  getClaimSnapshots,
  upsertClaimSnapshot,
  sendPushNotification,
  ClaimSnapshot,
} from '@/lib/web-push-server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

// ─── Claim snapshot query ────────────────────────────────────────────────────
const CLAIM_DATA_QUERY = `
  query GetClaimsForNotification($labels: [String!]) {
    vaults(
      where: {
        term: {
          atom: { label: { _in: $labels } }
        }
      }
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      total_shares
      total_assets
      current_share_price
      term {
        atom {
          label
        }
      }
    }
  }
`

// ─── Live Events queries ─────────────────────────────────────────────────────
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
        term { atom { label } }
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
        term { atom { label } }
      }
    }
  }
`

interface ClaimData {
  market_cap: string
  position_count: number
  total_shares: string
  total_assets: string
  current_share_price: string
  term: {
    atom: { label: string } | null
  }
}

interface LiveEvent {
  id: string
  type: 'deposit' | 'redemption'
  atomLabel: string
  assets: number
  createdAt: string
}

function toNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 0
  // Convert from wei if value is astronomically large
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

  try {
    const depositsData = await queryIntuitionGraphQL(RECENT_DEPOSITS_QUERY, { since: sinceISO })
    ;(depositsData?.deposits || []).forEach((d: any) => {
      const raw = d.assets_after_fees ? parseFloat(d.assets_after_fees) : 0
      const assets = raw > 1e15 ? raw / 1e18 : raw
      events.push({
        id: String(d.id),
        type: 'deposit',
        atomLabel: d.vault?.term?.atom?.label || 'Unknown',
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
        atomLabel: r.vault?.term?.atom?.label || 'Unknown',
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

    // Log subscription details for debugging
    for (const sub of subscriptions) {
      console.log(
        `[Check Notifications] Sub: address=${sub.address}, ` +
        `watched=${JSON.stringify(sub.watched_claims)}, ` +
        `ranges=${JSON.stringify(sub.alert_ranges)}`
      )
    }

    // ── 1. Determine the "since" timestamp for live events ──────────────────
    // The poller passes ?since= when it has a previous run timestamp.
    // This guarantees each event is processed exactly once.
    const sinceParam = req.nextUrl.searchParams.get('since')
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 5 * 60 * 1000) // fallback: last 5 min
    console.log(`[Check Notifications] Fetching live events since: ${since.toISOString()}`)

    // ── 2. Fetch live events ────────────────────────────────────────────────
    const liveEvents = await fetchRecentLiveEvents(since)
    console.log(`[Check Notifications] Got ${liveEvents.length} live event(s) since ${since.toISOString()}`)
    for (const ev of liveEvents) {
      console.log(`  [Event] ${ev.type} id=${ev.id} assets=${ev.assets.toFixed(4)} TRUST atom="${ev.atomLabel}"`)
    }

    // ── 3. Fetch current claim data for all watched claims ──────────────────
    const allWatchedLabels = new Set<string>()
    for (const sub of subscriptions) {
      for (const label of sub.watched_claims || []) {
        allWatchedLabels.add(label)
      }
    }

    let currentClaimsMap = new Map<string, ClaimSnapshot>()
    if (allWatchedLabels.size > 0) {
      console.log(`[Check Notifications] Fetching claim data for: ${[...allWatchedLabels].join(', ')}`)
      try {
        const result = await queryIntuitionGraphQL(CLAIM_DATA_QUERY, {
          labels: Array.from(allWatchedLabels),
        })
        for (const vault of (result?.vaults || []) as ClaimData[]) {
          const label = vault.term?.atom?.label
          if (!label) continue
          const snap: ClaimSnapshot = {
            claim_label: label,
            market_cap: toNumber(vault.market_cap),
            position_count: vault.position_count || 0,
            total_shares: toNumber(vault.total_shares),
            total_assets: toNumber(vault.total_assets),
            current_share_price: toNumber(vault.current_share_price),
          }
          currentClaimsMap.set(label, snap)
          console.log(`  [Claim] "${label}" marketCap=${snap.market_cap.toFixed(4)} positions=${snap.position_count}`)
        }
      } catch (e) {
        console.error('[Check Notifications] Claim GraphQL failed:', e)
      }
    }

    const snapshots = await getClaimSnapshots()
    const snapshotsMap = new Map<string, ClaimSnapshot>()
    for (const snap of snapshots) snapshotsMap.set(snap.claim_label, snap)
    console.log(`[Check Notifications] Loaded ${snapshots.length} claim snapshot(s) from DB`)

    // ── 4. Build notifications ──────────────────────────────────────────────
    const notificationsToSend: Array<{
      subscription: typeof subscriptions[0]
      payload: { title: string; body: string; tag: string; url: string }
    }> = []

    for (const subscription of subscriptions) {
      const alerts: string[] = []

      // Claim snapshot alerts (requires a previous snapshot to compare against)
      for (const claimLabel of subscription.watched_claims || []) {
        const current = currentClaimsMap.get(claimLabel)
        const previous = snapshotsMap.get(claimLabel)

        if (!current) {
          console.log(`  [Claim alert] No current data for "${claimLabel}", skipping`)
          continue
        }
        if (!previous) {
          console.log(`  [Claim alert] No previous snapshot for "${claimLabel}" — baseline will be set this run`)
          continue
        }

        const marketCapChange = pctChange(previous.market_cap, current.market_cap)
        const positionChange = Math.abs(current.position_count - previous.position_count)
        const sharesChange = pctChange(previous.total_shares, current.total_shares)

        console.log(
          `  [Claim alert] "${claimLabel}" marketCap Δ${marketCapChange.toFixed(1)}% ` +
          `positions Δ${positionChange} shares Δ${sharesChange.toFixed(1)}%`
        )

        // 2% threshold for market cap / shares; 3 positions minimum change
        if (marketCapChange >= 2) {
          const dir = current.market_cap > previous.market_cap ? '↑' : '↓'
          alerts.push(`${claimLabel}: market cap ${dir}${marketCapChange.toFixed(1)}%`)
        }
        if (positionChange >= 3) {
          const dir = current.position_count > previous.position_count ? '+' : '-'
          alerts.push(`${claimLabel}: ${dir}${positionChange} position${positionChange > 1 ? 's' : ''}`)
        }
        if (sharesChange >= 2) {
          const dir = current.total_shares > previous.total_shares ? '↑' : '↓'
          alerts.push(`${claimLabel}: shares ${dir}${sharesChange.toFixed(1)}%`)
        }
      }

      // Live Events range alerts
      const ranges = subscription.alert_ranges || {}
      const depositCfg = ranges.deposits
      const redemptionCfg = ranges.redemptions

      console.log(
        `  [Range check] address=${subscription.address} ` +
        `depositCfg=${JSON.stringify(depositCfg)} ` +
        `redemptionCfg=${JSON.stringify(redemptionCfg)}`
      )

      for (const event of liveEvents) {
        if (event.type === 'deposit' && depositCfg?.enabled) {
          const matches = inRange(event.assets, depositCfg.min, depositCfg.max)
          console.log(
            `    [Deposit] id=${event.id} assets=${event.assets.toFixed(4)} ` +
            `range=${depositCfg.min}-${depositCfg.max} match=${matches}`
          )
          if (matches) {
            alerts.push(`Deposit: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
          }
        }
        if (event.type === 'redemption' && redemptionCfg?.enabled) {
          const matches = inRange(event.assets, redemptionCfg.min, redemptionCfg.max)
          console.log(
            `    [Redemption] id=${event.id} assets=${event.assets.toFixed(4)} ` +
            `range=${redemptionCfg.min}-${redemptionCfg.max} match=${matches}`
          )
          if (matches) {
            alerts.push(`Redemption: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`)
          }
        }
      }

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

    // ── 5. Send notifications ───────────────────────────────────────────────
    let totalNotified = 0
    await Promise.allSettled(
      notificationsToSend.map(async ({ subscription, payload }) => {
        const sent = await sendPushNotification(subscription, payload)
        if (sent) totalNotified++
      })
    )

    // ── 6. Update claim snapshots (always, so baseline is current) ──────────
    if (currentClaimsMap.size > 0) {
      await Promise.allSettled(
        Array.from(currentClaimsMap.values()).map(snap => upsertClaimSnapshot(snap))
      )
      console.log(`[Check Notifications] Updated ${currentClaimsMap.size} claim snapshot(s)`)
    }

    console.log(
      `[Check Notifications] Done. ${subscriptions.length} subs, ` +
      `${liveEvents.length} events, ${totalNotified} sent`
    )

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.length,
      claimsWatched: allWatchedLabels.size,
      liveEventsChecked: liveEvents.length,
      notificationsSent: totalNotified,
    })
  } catch (error) {
    console.error('[Check Notifications] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = GET
