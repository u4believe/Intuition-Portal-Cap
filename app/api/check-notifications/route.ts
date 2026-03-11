import { NextRequest, NextResponse } from 'next/server'
import {
  getAllSubscriptions,
  getClaimSnapshots,
  upsertClaimSnapshot,
  sendPushNotification,
  ClaimSnapshot,
} from '@/lib/web-push-server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

// ─── Claim snapshot query (for market-cap / position alerts) ───────────────
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

// ─── Live Events queries (for deposit / redemption range alerts) ────────────
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
}

function toNumber(val: string | number | null | undefined): number {
  if (!val) return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
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

// ─── Fetch recent Live Events ───────────────────────────────────────────────
async function fetchRecentLiveEvents(since: Date): Promise<LiveEvent[]> {
  const events: LiveEvent[] = []
  const sinceISO = since.toISOString()

  try {
    const depositsData = await queryIntuitionGraphQL(RECENT_DEPOSITS_QUERY, { since: sinceISO })
    ;(depositsData?.deposits || []).forEach((d: any) => {
      const assets = d.assets_after_fees ? parseFloat(d.assets_after_fees) / 1e18 : 0
      events.push({
        id: d.id,
        type: 'deposit',
        atomLabel: d.vault?.term?.atom?.label || 'Unknown',
        assets,
      })
    })
  } catch (e) {
    console.warn('[Check Notifications] Deposit fetch failed:', e)
  }

  try {
    const redemptionsData = await queryIntuitionGraphQL(RECENT_REDEMPTIONS_QUERY, { since: sinceISO })
    ;(redemptionsData?.redemptions || []).forEach((r: any) => {
      const assets = r.assets ? parseFloat(r.assets) / 1e18 : 0
      events.push({
        id: r.id,
        type: 'redemption',
        atomLabel: r.vault?.term?.atom?.label || 'Unknown',
        assets,
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
    if (subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions to process', notified: 0 })
    }

    // ── 1. Claim snapshot alerting ──────────────────────────────────────────
    const allWatchedLabels = new Set<string>()
    for (const sub of subscriptions) {
      for (const label of sub.watched_claims || []) {
        allWatchedLabels.add(label)
      }
    }

    let currentClaimsMap = new Map<string, ClaimSnapshot>()
    if (allWatchedLabels.size > 0) {
      try {
        const result = await queryIntuitionGraphQL(CLAIM_DATA_QUERY, {
          labels: Array.from(allWatchedLabels),
        })
        for (const vault of (result?.vaults || []) as ClaimData[]) {
          const label = vault.term?.atom?.label
          if (!label) continue
          currentClaimsMap.set(label, {
            claim_label: label,
            market_cap: toNumber(vault.market_cap),
            position_count: vault.position_count || 0,
            total_shares: toNumber(vault.total_shares),
            total_assets: toNumber(vault.total_assets),
            current_share_price: toNumber(vault.current_share_price),
          })
        }
      } catch (e) {
        console.error('[Check Notifications] Claim GraphQL failed:', e)
      }
    }

    const snapshots = await getClaimSnapshots()
    const snapshotsMap = new Map<string, ClaimSnapshot>()
    for (const snap of snapshots) snapshotsMap.set(snap.claim_label, snap)

    // ── 2. Live Events alerting (deposits / redemptions in range) ───────────
    // Fetch events from the last 5 minutes (poll runs every 2 min, 5 min = overlap buffer)
    const since = new Date(Date.now() - 5 * 60 * 1000)
    const liveEvents = await fetchRecentLiveEvents(since)

    // ── 3. Build notification payloads for each subscription ────────────────
    const notificationsToSend: Array<{
      subscription: typeof subscriptions[0]
      payload: { title: string; body: string; tag: string; url: string }
    }> = []

    for (const subscription of subscriptions) {
      const alerts: string[] = []

      // Claim snapshot alerts
      for (const claimLabel of subscription.watched_claims || []) {
        const current = currentClaimsMap.get(claimLabel)
        const previous = snapshotsMap.get(claimLabel)
        if (!current || !previous) continue

        const marketCapChange = pctChange(previous.market_cap, current.market_cap)
        if (marketCapChange >= 5) {
          const dir = current.market_cap > previous.market_cap ? '↑' : '↓'
          alerts.push(`${claimLabel}: market cap ${dir}${marketCapChange.toFixed(1)}%`)
        }

        const positionChange = Math.abs(current.position_count - previous.position_count)
        if (positionChange >= 10) {
          alerts.push(`${claimLabel}: ${positionChange} new position${positionChange > 1 ? 's' : ''}`)
        }

        const sharesChange = pctChange(previous.total_shares, current.total_shares)
        if (sharesChange >= 5) {
          const dir = current.total_shares > previous.total_shares ? '↑' : '↓'
          alerts.push(`${claimLabel}: shares ${dir}${sharesChange.toFixed(1)}%`)
        }
      }

      // Live Events range alerts
      const ranges = subscription.alert_ranges || {}
      const depositCfg = ranges.deposits
      const redemptionCfg = ranges.redemptions

      for (const event of liveEvents) {
        if (event.type === 'deposit' && depositCfg?.enabled) {
          if (inRange(event.assets, depositCfg.min, depositCfg.max)) {
            alerts.push(
              `Deposit: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`
            )
          }
        }
        if (event.type === 'redemption' && redemptionCfg?.enabled) {
          if (inRange(event.assets, redemptionCfg.min, redemptionCfg.max)) {
            alerts.push(
              `Redemption: ${event.assets.toFixed(2)} TRUST on "${event.atomLabel}"`
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

    let totalNotified = 0
    await Promise.allSettled(
      notificationsToSend.map(async ({ subscription, payload }) => {
        const sent = await sendPushNotification(subscription, payload)
        if (sent) totalNotified++
      })
    )

    // Update claim snapshots
    if (currentClaimsMap.size > 0) {
      await Promise.allSettled(
        Array.from(currentClaimsMap.values()).map(snap => upsertClaimSnapshot(snap))
      )
    }

    console.log(
      `[Check Notifications] ${subscriptions.length} subs, ${liveEvents.length} live events, ${totalNotified} sent`
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
