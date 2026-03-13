'use client'

import { useCallback, useEffect, useState } from 'react'
import { useCurrentUserId } from './useCurrentUserId'
import {
  isPushNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getPushSubscription,
  checkServerSubscription,
  sendTestNotification,
  updateWatchedClaimsOnServer,
} from '@/lib/push-notifications'
import { useUserPreferences } from './useUserPreferences'

export function usePushNotifications() {
  const userId = useCurrentUserId()
  const { updateNotificationSettings, getWatchedClaims } = useUserPreferences()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('denied')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isServerSubscribed, setIsServerSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  useEffect(() => {
    setIsSupported(isPushNotificationSupported())
    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission())
      registerServiceWorker()
    }
  }, [])

  // Check browser subscription state when supported + permission granted
  useEffect(() => {
    if (isSupported && permission === 'granted') {
      getPushSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    }
  }, [isSupported, permission])

  // Check server subscription state when userId is known
  useEffect(() => {
    if (userId) {
      checkServerSubscription(userId).then(setIsServerSubscribed)
    }
  }, [userId])

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false
    setIsLoading(true)
    try {
      const granted = await requestNotificationPermission()
      setPermission(granted ? 'granted' : 'denied')
      return granted
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId) {
      setSubscribeError(!isSupported ? 'Push notifications are not supported in this browser.' : 'Not signed in.')
      return false
    }

    setIsLoading(true)
    setSubscribeError(null)
    try {
      if (permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          setSubscribeError('Permission denied. Please allow notifications in your browser/OS settings.')
          return false
        }
      }

      const watchedClaims = getWatchedClaims()
      await subscribeToPushNotifications(userId, watchedClaims)
      setIsSubscribed(true)
      setIsServerSubscribed(true)
      updateNotificationSettings({ pushNotificationsEnabled: true })
      console.log('[Push] Notifications enabled for', userId)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('push-notifications-enabled', { detail: { userId } }))
      }
      return true
    } catch (error: any) {
      const msg = error?.message || String(error)
      setSubscribeError(msg)
      console.error('[Push] Subscribe error:', msg)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, permission, userId, requestPermission, updateNotificationSettings, getWatchedClaims])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false
    setIsLoading(true)
    try {
      const success = await unsubscribeFromPushNotifications()
      if (success) {
        setIsSubscribed(false)
        setIsServerSubscribed(false)
        updateNotificationSettings({ pushNotificationsEnabled: false })
      }
      return success
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, updateNotificationSettings])

  const syncWatchedClaimsToServer = useCallback(async () => {
    if (!userId || !isServerSubscribed) return
    const watchedClaims = getWatchedClaims()
    await updateWatchedClaimsOnServer(userId, watchedClaims)
  }, [userId, isServerSubscribed, getWatchedClaims])

  // Send a test push notification via the server pipeline
  const sendServerTest = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!userId) return { ok: false, message: 'Not signed in.' }
    try {
      const res = await fetch('/api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userId }),
      })
      const data = await res.json()
      if (data.error === 'NO_SUBSCRIPTION') {
        return { ok: false, message: 'No subscription found on the server. Please enable push notifications first.' }
      }
      if (!res.ok || !data.success) {
        return { ok: false, message: data.message || data.error || 'Failed to send test notification.' }
      }
      return { ok: true, message: 'Test notification sent! Check your device.' }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Network error sending test.' }
    }
  }, [userId])

  const sendTest = useCallback(async () => {
    if (!isSupported || permission !== 'granted') return false
    try {
      await sendTestNotification('Portal Cap', {
        body: 'Push notifications are working!',
        icon: '/icon-light-32x32.png',
        badge: '/icon-light-32x32.png',
      })
      return true
    } catch {
      return false
    }
  }, [isSupported, permission])

  const refreshServerStatus = useCallback(async () => {
    if (!userId) return
    const serverHas = await checkServerSubscription(userId)
    setIsServerSubscribed(serverHas)
  }, [userId])

  return {
    isSupported,
    permission,
    isSubscribed,
    isServerSubscribed,
    isLoading,
    subscribeError,
    requestPermission,
    subscribe,
    unsubscribe,
    syncWatchedClaimsToServer,
    sendTest,
    sendServerTest,
    refreshServerStatus,
  }
}
