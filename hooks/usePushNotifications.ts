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
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsSupported(isPushNotificationSupported())
    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission())
      registerServiceWorker()
    }
  }, [])

  useEffect(() => {
    if (isSupported && permission === 'granted') {
      getPushSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    }
  }, [isSupported, permission])

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

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return false

    setIsLoading(true)
    try {
      if (permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) return false
      }

      const watchedClaims = getWatchedClaims()
      const success = await subscribeToPushNotifications(userId, watchedClaims)
      if (success) {
        setIsSubscribed(true)
        updateNotificationSettings({ pushNotificationsEnabled: true })
        console.log('[Push] Notifications enabled for', userId, 'watching:', watchedClaims)

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('push-notifications-enabled', {
            detail: { userId }
          }))
        }
      }
      return success
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
        updateNotificationSettings({ pushNotificationsEnabled: false })
        console.log('[Push] Notifications disabled')
      }
      return success
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, updateNotificationSettings])

  const syncWatchedClaimsToServer = useCallback(async () => {
    if (!userId || !isSubscribed) return
    const watchedClaims = getWatchedClaims()
    await updateWatchedClaimsOnServer(userId, watchedClaims)
  }, [userId, isSubscribed, getWatchedClaims])

  const sendTest = useCallback(async () => {
    if (!isSupported || permission !== 'granted') return false
    try {
      await sendTestNotification('Portal Cap', {
        body: 'Push notifications are working! You will receive alerts for your watched claims.',
        icon: '/icon-light-32x32.png',
        badge: '/icon-light-32x32.png',
      })
      return true
    } catch (error) {
      console.error('[Push] Failed to send test notification:', error)
      return false
    }
  }, [isSupported, permission])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    syncWatchedClaimsToServer,
    sendTest,
  }
}
