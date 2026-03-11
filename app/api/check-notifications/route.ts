import { NextRequest, NextResponse } from 'next/server'
import {
  getAllSubscriptions,
  getClaimSnapshots,
  upsertClaimSnapshot,
  sendPushNotification,
  ClaimSnapshot,
} from '@/lib/web-push-server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

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

function convertToNumber(val: string | number | null | undefined): number {
  if (!val) return 0
  try {
    const num = typeof val === 'string' ? parseFloat(val) : val
    // Handle wei values (very large numbers) by dividing
    if (num > 1e15) return num / 1e18
    return num
  } catch {
    return 0
  }
}

function calculatePercentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0
  return Math.abs((newVal - oldVal) / oldVal) * 100
}

function getUserPreferencesForClaim(claim_label: string, address: string): {
  marketCapThreshold: number
  positionThreshold: number
  sharesThreshold: number
} {
  // Default thresholds (since preferences are client-side, server uses sensible defaults)
  // In production, store preferences in DB too
  return {
    marketCapThreshold: 5,   // 5% market cap change
    positionThreshold: 10,   // 10 new positions
    sharesThreshold: 5,      // 5% shares change
  }
}

export async function GET(req: NextRequest) {
  try {
    // Simple security: only allow calls with a secret or from server
    const authHeader = req.headers.get('x-cron-secret')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all push subscriptions
    const subscriptions = await getAllSubscriptions()
    if (subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions to process', notified: 0 })
    }

    // Collect all unique claim labels being watched
    const allWatchedLabels = new Set<string>()
    for (const sub of subscriptions) {
      for (const label of sub.watched_claims || []) {
        allWatchedLabels.add(label)
      }
    }

    if (allWatchedLabels.size === 0) {
      return NextResponse.json({ message: 'No claims being watched', notified: 0 })
    }

    // Fetch current claim data from Intuition GraphQL
    const labelsArray = Array.from(allWatchedLabels)
    let currentClaimsData: ClaimData[] = []
    try {
      const graphqlResult = await queryIntuitionGraphQL(CLAIM_DATA_QUERY, {
        labels: labelsArray,
      })
      currentClaimsData = graphqlResult?.vaults || []
    } catch (error) {
      console.error('[Check Notifications] GraphQL query failed:', error)
      return NextResponse.json({ error: 'Failed to fetch claim data' }, { status: 500 })
    }

    // Build a map of current claim data
    const currentClaimsMap = new Map<string, ClaimSnapshot>()
    for (const vault of currentClaimsData) {
      const label = vault.term?.atom?.label
      if (!label) continue
      currentClaimsMap.set(label, {
        claim_label: label,
        market_cap: convertToNumber(vault.market_cap),
        position_count: vault.position_count || 0,
        total_shares: convertToNumber(vault.total_shares),
        total_assets: convertToNumber(vault.total_assets),
        current_share_price: convertToNumber(vault.current_share_price),
      })
    }

    // Get stored snapshots for comparison
    const snapshots = await getClaimSnapshots()
    const snapshotsMap = new Map<string, ClaimSnapshot>()
    for (const snap of snapshots) {
      snapshotsMap.set(snap.claim_label, snap)
    }

    // Check each subscription for threshold violations
    let totalNotified = 0
    const notificationsToSend: Array<{
      subscription: typeof subscriptions[0]
      payload: { title: string; body: string; tag: string; url: string }
    }> = []

    for (const subscription of subscriptions) {
      const watchedClaims = subscription.watched_claims || []
      const alerts: string[] = []

      for (const claimLabel of watchedClaims) {
        const current = currentClaimsMap.get(claimLabel)
        const previous = snapshotsMap.get(claimLabel)

        if (!current) continue

        // If no previous snapshot, we'll create one without alerting
        if (!previous) continue

        const prefs = getUserPreferencesForClaim(claimLabel, subscription.address)

        // Check market cap threshold
        const marketCapChange = calculatePercentChange(previous.market_cap, current.market_cap)
        if (marketCapChange >= prefs.marketCapThreshold) {
          const direction = current.market_cap > previous.market_cap ? 'up' : 'down'
          alerts.push(
            `${claimLabel}: Market cap ${direction} ${marketCapChange.toFixed(1)}%`
          )
        }

        // Check position count threshold
        const positionChange = Math.abs(current.position_count - previous.position_count)
        if (positionChange >= prefs.positionThreshold) {
          alerts.push(
            `${claimLabel}: ${positionChange} new position${positionChange > 1 ? 's' : ''}`
          )
        }

        // Check total shares threshold
        const sharesChange = calculatePercentChange(previous.total_shares, current.total_shares)
        if (sharesChange >= prefs.sharesThreshold) {
          const direction = current.total_shares > previous.total_shares ? 'up' : 'down'
          alerts.push(
            `${claimLabel}: Shares ${direction} ${sharesChange.toFixed(1)}%`
          )
        }
      }

      if (alerts.length > 0) {
        notificationsToSend.push({
          subscription,
          payload: {
            title: `Portal Cap Alert${alerts.length > 1 ? 's' : ''}`,
            body: alerts.slice(0, 3).join(' | '),
            tag: 'claim-update',
            url: '/',
          },
        })
      }
    }

    // Send all notifications
    await Promise.allSettled(
      notificationsToSend.map(async ({ subscription, payload }) => {
        const sent = await sendPushNotification(subscription, payload)
        if (sent) totalNotified++
      })
    )

    // Update snapshots with current data
    await Promise.allSettled(
      Array.from(currentClaimsMap.values()).map(snapshot => upsertClaimSnapshot(snapshot))
    )

    console.log(
      `[Check Notifications] Processed ${subscriptions.length} subscriptions, sent ${totalNotified} notifications`
    )

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.length,
      claimsWatched: allWatchedLabels.size,
      notificationsSent: totalNotified,
    })
  } catch (error) {
    console.error('[Check Notifications] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support POST for webhook-style calls
export const POST = GET
