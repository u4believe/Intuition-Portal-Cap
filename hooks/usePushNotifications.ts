'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
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
  const { address } = useAccount()
  const { updateNotificationSettings, getWatchedClaims } = useUserPreferences()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('denied')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check support on mount
  useEffect(() => {
    setIsSupported(isPushNotificationSupported())
    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission())
      registerServiceWorker()
    }
  }, [])

  // Check subscription status
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
    if (!isSupported || !address) return false

    setIsLoading(true)
    try {
      // Request permission if needed
      if (permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) return false
      }

      // Get current watched claims to sync with server
      const watchedClaims = getWatchedClaims()

      // Subscribe to push notifications and save to server
      const success = await subscribeToPushNotifications(address, watchedClaims)
      if (success) {
        setIsSubscribed(true)
        // Update user preferences to reflect push notifications are enabled
        updateNotificationSettings({ pushNotificationsEnabled: true })
        console.log('[v0] Push notifications enabled for', address, 'watching:', watchedClaims)

        // Dispatch event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('push-notifications-enabled', {
            detail: { address }
          }))
        }
      }
      return success
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, permission, address, requestPermission, updateNotificationSettings, getWatchedClaims])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false

    setIsLoading(true)
    try {
      const success = await unsubscribeFromPushNotifications()
      if (success) {
        setIsSubscribed(false)
        // Update user preferences
        updateNotificationSettings({ pushNotificationsEnabled: false })
        console.log('[v0] Push notifications disabled')
      }
      return success
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, updateNotificationSettings])

  // Sync watched claims to server whenever they change
  const syncWatchedClaimsToServer = useCallback(async () => {
    if (!address || !isSubscribed) return
    const watchedClaims = getWatchedClaims()
    await updateWatchedClaimsOnServer(address, watchedClaims)
  }, [address, isSubscribed, getWatchedClaims])

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
      console.error('[v0] Failed to send test notification:', error)
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
