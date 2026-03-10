'use client'

/**
 * Web Push Notifications for Portal Cap
 * Uses the browser's native Push API and Service Workers
 */

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
 * Subscribe to push notifications
 * Returns the subscription endpoint to be stored (client-side only)
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn('[Push Notifications] Browser does not support push notifications')
    return false
  }

  try {
    // Check if already subscribed
    const existing = await getPushSubscription()
    if (existing) {
      console.log('[Push Notifications] Already subscribed')
      return true
    }

    // Register service worker first if not already registered
    const registration = await navigator.serviceWorker.ready

    // Subscribe to push notifications
    // Note: In a production app, you'd generate a VAPID key pair on your server
    // For now, we'll create a subscription that can be sent to your notification service
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // In production, replace this with your server's public VAPID key
      applicationServerKey: urlBase64ToUint8Array(
        'BAI-EwAvvF8sR-CIo2hQqfBQW3gZbRh5bltBvP0P-nkh2qLYd-jSWVQy4STJ7Dne_YEK3B5gPQGh-ETGCS0Tn5Q'
      ),
    })

    console.log('[Push Notifications] Subscription successful')
    return true
  } catch (error) {
    console.error('[Push Notifications] Subscription failed:', error)
    return false
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
