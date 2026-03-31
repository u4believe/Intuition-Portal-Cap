/**
 * Server-side Web Push utilities
 * Only used in API routes (server-side), never imported in client components
 */
import webpush from 'web-push'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Configure VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'https://portal-cap.replit.app',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface AlertRangeConfig {
  enabled: boolean
  min: number
  max: number
}

export interface ClaimAlertPref {
  label: string
  deposits: boolean
  depositsMin: number
  depositsMax: number
  redemptions: boolean
  redemptionsMin: number
  redemptionsMax: number
  marketCap: boolean
  marketCapMin: number
  positionCount: boolean
  sharesChange: boolean
  sharesChangeMin: number
}

export interface PushSubscriptionRow {
  id: number
  address: string
  endpoint: string
  p256dh: string
  auth: string
  watched_claims: string[]
  alert_ranges: {
    deposits?: AlertRangeConfig
    redemptions?: AlertRangeConfig
  }
  receive_smart_alerts: boolean
  claim_alert_prefs: Record<string, ClaimAlertPref>
  created_at: Date
  updated_at: Date
}

export interface ClaimSnapshot {
  claim_label: string
  market_cap: number
  position_count: number
  total_shares: number
  total_assets: number
  current_share_price: number
  pct_change_24h?: number
}

export async function saveSubscription(
  address: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  watchedClaims: string[] = [],
  alertRanges: PushSubscriptionRow['alert_ranges'] | null = null,
  receiveSmartAlerts: boolean = true
): Promise<boolean> {
  try {
    if (alertRanges !== null) {
      // Save with alert_ranges (merge with any existing value)
      await pool.query(
        `INSERT INTO push_subscriptions (address, endpoint, p256dh, auth, watched_claims, alert_ranges, receive_smart_alerts, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (address, endpoint) DO UPDATE SET
           p256dh = $3,
           auth = $4,
           watched_claims = $5,
           alert_ranges = $6,
           receive_smart_alerts = $7,
           updated_at = NOW()`,
        [address, endpoint, p256dh, auth, watchedClaims, JSON.stringify(alertRanges), receiveSmartAlerts]
      )
    } else {
      // Save without overwriting existing alert_ranges
      await pool.query(
        `INSERT INTO push_subscriptions (address, endpoint, p256dh, auth, watched_claims, receive_smart_alerts, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (address, endpoint) DO UPDATE SET
           p256dh = $3,
           auth = $4,
           watched_claims = $5,
           receive_smart_alerts = $6,
           updated_at = NOW()`,
        [address, endpoint, p256dh, auth, watchedClaims, receiveSmartAlerts]
      )
    }
    console.log(`[Push Server] Saved subscription for ${address}, alertRanges=${alertRanges !== null ? 'included' : 'preserved'}`)
    return true
  } catch (error) {
    console.error('[Push Server] Failed to save subscription:', error)
    return false
  }
}

export async function deleteSubscription(endpoint: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
    return true
  } catch (error) {
    console.error('[Push Server] Failed to delete subscription:', error)
    return false
  }
}

export async function updateWatchedClaims(
  address: string,
  watchedClaims: string[]
): Promise<boolean> {
  try {
    await pool.query(
      `UPDATE push_subscriptions SET watched_claims = $2, updated_at = NOW() WHERE address = $1`,
      [address, watchedClaims]
    )
    return true
  } catch (error) {
    console.error('[Push Server] Failed to update watched claims:', error)
    return false
  }
}

export async function updateAlertRanges(
  address: string,
  alertRanges: PushSubscriptionRow['alert_ranges']
): Promise<boolean> {
  try {
    await pool.query(
      `UPDATE push_subscriptions SET alert_ranges = $2, updated_at = NOW() WHERE address = $1`,
      [address, JSON.stringify(alertRanges)]
    )
    return true
  } catch (error) {
    console.error('[Push Server] Failed to update alert ranges:', error)
    return false
  }
}

export async function upsertClaimAlertPref(
  address: string,
  termId: string,
  pref: ClaimAlertPref
): Promise<boolean> {
  try {
    const patch = JSON.stringify({ [termId]: pref })
    await pool.query(
      `UPDATE push_subscriptions
         SET claim_alert_prefs = COALESCE(claim_alert_prefs, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
       WHERE address = $1`,
      [address, patch]
    )
    return true
  } catch (error) {
    console.error('[Push Server] Failed to upsert claim alert pref:', error)
    return false
  }
}

export async function removeClaimAlertPref(
  address: string,
  termId: string
): Promise<boolean> {
  try {
    await pool.query(
      `UPDATE push_subscriptions
         SET claim_alert_prefs = COALESCE(claim_alert_prefs, '{}'::jsonb) - $2,
             updated_at = NOW()
       WHERE address = $1`,
      [address, termId]
    )
    return true
  } catch (error) {
    console.error('[Push Server] Failed to remove claim alert pref:', error)
    return false
  }
}

export async function getAllSubscriptions(): Promise<PushSubscriptionRow[]> {
  try {
    const result = await pool.query('SELECT * FROM push_subscriptions')
    return result.rows.map(row => ({
      ...row,
      claim_alert_prefs: row.claim_alert_prefs || {},
    }))
  } catch (error) {
    console.error('[Push Server] Failed to get subscriptions:', error)
    return []
  }
}

export async function getSubscriptionsByAddress(address: string): Promise<PushSubscriptionRow[]> {
  try {
    const result = await pool.query(
      'SELECT * FROM push_subscriptions WHERE address = $1',
      [address]
    )
    return result.rows.map(row => ({
      ...row,
      claim_alert_prefs: row.claim_alert_prefs || {},
    }))
  } catch (error) {
    console.error('[Push Server] Failed to get subscriptions by address:', error)
    return []
  }
}

export async function getClaimSnapshots(): Promise<ClaimSnapshot[]> {
  try {
    const result = await pool.query('SELECT * FROM claim_snapshots')
    return result.rows
  } catch (error) {
    console.error('[Push Server] Failed to get claim snapshots:', error)
    return []
  }
}

export async function upsertClaimSnapshot(snapshot: ClaimSnapshot): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO claim_snapshots (claim_label, market_cap, position_count, total_shares, total_assets, current_share_price, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (claim_label) DO UPDATE SET
         market_cap = $2,
         position_count = $3,
         total_shares = $4,
         total_assets = $5,
         current_share_price = $6,
         updated_at = NOW()`,
      [
        snapshot.claim_label,
        snapshot.market_cap,
        snapshot.position_count,
        snapshot.total_shares,
        snapshot.total_assets,
        snapshot.current_share_price,
      ]
    )
  } catch (error) {
    console.error('[Push Server] Failed to upsert claim snapshot:', error)
  }
}

export async function sendPushNotification(
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; tag?: string; url?: string }
): Promise<boolean> {
  const shortEndpoint = subscription.endpoint.slice(-30)
  try {
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        tag: payload.tag || 'claim-update',
        url: payload.url || '/',
      })
    )
    console.log(`[Push Server] ✓ Sent to ...${shortEndpoint} — FCM status: ${result.statusCode}`)
    return true
  } catch (error: any) {
    const status = error?.statusCode
    const body = error?.body || ''
    // If the subscription is expired/invalid (410), delete it
    if (status === 410) {
      console.log(`[Push Server] Subscription expired (410), removing: ...${shortEndpoint}`)
      await deleteSubscription(subscription.endpoint)
    } else {
      console.error(`[Push Server] ✗ Send failed — status=${status} body=${body} endpoint=...${shortEndpoint}`)
    }
    return false
  }
}
