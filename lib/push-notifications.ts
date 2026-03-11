'use client'

/**
 * Web Push Notifications for Portal Cap
 * Uses the browser's native Push API and Service Workers
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BBzvhhej2AYuBRaiDZp0jnJIiG9aR0YGKNsAZldqSHsuS8wnAX35v8NIdjwBID8AtNFuC_lUHiDZNWLNTi189U8'

/**
 * Check if the browser supports push notifications
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isPushNotificationSupported()) {
    return 'denied'
  }
  return Notification.permission
}

/**
 * Request permission for push notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn('[Push Notifications] Browser does not support push notifications')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch (error) {
    console.error('[Push Notifications] Failed to request permission:', error)
    return false
  }
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js')
    console.log('[Push Notifications] Service worker registered:', registration)
    return registration
  } catch (error) {
    console.error('[Push Notifications] Service worker registration failed:', error)
    return null
  }
}

/**
 * Get the push subscription for the user
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch (error) {
    console.error('[Push Notifications] Failed to get push subscription:', error)
    return null
  }
}

/**
 * Subscribe to push notifications and save to server
 */
export async function subscribeToPushNotifications(
  address: string,
  watchedClaims: string[] = []
): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn('[Push Notifications] Browser does not support push notifications')
    return false
  }

  try {
    // Check if already subscribed
    const existing = await getPushSubscription()
    if (existing) {
      // Update watched claims on server even if already subscribed
      await saveSubscriptionToServer(address, existing, watchedClaims)
      console.log('[Push Notifications] Already subscribed, updated watched claims')
      return true
    }

    const registration = await navigator.serviceWorker.ready

    // Subscribe to push notifications with VAPID key
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // Save subscription to server
    await saveSubscriptionToServer(address, subscription, watchedClaims)

    console.log('[Push Notifications] Subscription successful')
    return true
  } catch (error) {
    console.error('[Push Notifications] Subscription failed:', error)
    return false
  }
}

/**
 * Save the push subscription to the server
 */
async function saveSubscriptionToServer(
  address: string,
  subscription: PushSubscription,
  watchedClaims: string[]
): Promise<void> {
  try {
    const subJson = subscription.toJSON()
    const response = await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
        watchedClaims,
      }),
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    console.log('[Push Notifications] Subscription saved to server')
  } catch (error) {
    console.error('[Push Notifications] Failed to save subscription to server:', error)
  }
}

/**
 * Update watched claims on server (when user watches/unwatches a claim)
 */
export async function updateWatchedClaimsOnServer(
  address: string,
  watchedClaims: string[]
): Promise<void> {
  try {
    await fetch('/api/push-subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, watchedClaims }),
    })
  } catch (error) {
    console.error('[Push Notifications] Failed to update watched claims on server:', error)
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false
  }

  try {
    const subscription = await getPushSubscription()
    if (subscription) {
      // Remove from server first
      await fetch('/api/push-subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      await subscription.unsubscribe()
      console.log('[Push Notifications] Unsubscribed successfully')
      return true
    }
    return false
  } catch (error) {
    console.error('[Push Notifications] Failed to unsubscribe:', error)
    return false
  }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(title: string, options?: NotificationOptions): Promise<void> {
  if (!isPushNotificationSupported()) {
    console.warn('[Push Notifications] Push notifications not supported')
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, options)
  } catch (error) {
    console.error('[Push Notifications] Failed to send test notification:', error)
  }
}

/**
 * Helper function to convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
