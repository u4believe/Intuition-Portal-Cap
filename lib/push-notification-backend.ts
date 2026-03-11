/**
 * Push Notification Backend Integration
 * 
 * This file documents how to set up push notifications to actually be SENT to users.
 * 
 * Currently implemented:
 * - Client-side subscription to push notifications (browser registration)
 * - Permission request UI
 * - Service worker to handle incoming push messages
 * 
 * Still needed (backend):
 * - API endpoint to store push subscriptions
 * - System to monitor claim data changes
 * - Web Push API integration to send notifications
 * 
 * HOW TO IMPLEMENT:
 * 
 * 1. STORE SUBSCRIPTIONS on your backend:
 *    POST /api/push-subscriptions
 *    Body: {
 *      address: "0x...",
 *      subscription: PushSubscription (with endpoint, keys)
 *    }
 * 
 * 2. MONITOR CLAIM CHANGES:
 *    Set up a background job that:
 *    - Polls the Intuition GraphQL API for claim updates
 *    - Compares new data against stored preferences (market cap thresholds, etc.)
 *    - Identifies which users should be notified
 * 
 * 3. SEND NOTIFICATIONS using Web Push:
 *    For each user to notify:
 *    - Get their stored subscription from database
 *    - Use a library like "web-push" (Node.js) to send
 *    - Example: 
 *      webpush.sendNotification(subscription, JSON.stringify({
 *        title: "Market Cap Alert",
 *        body: "Beta increased by 5%",
 *        url: "/vault/claim-id"
 *      }))
 * 
 * 4. GENERATE VAPID KEYS:
 *    npm install -g web-push
 *    web-push generate-vapid-keys
 *    Use these keys for secure communication between browser and push service
 * 
 * REFERENCE IMPLEMENTATION CHECKLIST:
 * [ ] Create POST /api/push-subscriptions endpoint
 * [ ] Create database table for subscriptions (address, subscription JSON, preferences)
 * [ ] Set up background job to monitor claim data
 * [ ] Integrate web-push library
 * [ ] Configure VAPID keys in environment
 * [ ] Send test notifications
 * [ ] Monitor unsubscribe events (when users disable notifications)
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
}

export async function savePushSubscriptionOnServer(
  address: string,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    // TODO: Implement this endpoint
    const response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        subscription: subscription.toJSON(),
      }),
    })
    return response.ok
  } catch (error) {
    console.error('[Push Notifications] Failed to save subscription on server:', error)
    return false
  }
}

export async function removePushSubscriptionFromServer(
  address: string,
  endpoint: string
): Promise<boolean> {
  try {
    // TODO: Implement this endpoint
    const response = await fetch('/api/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        endpoint,
      }),
    })
    return response.ok
  } catch (error) {
    console.error('[Push Notifications] Failed to remove subscription:', error)
    return false
  }
}
