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
} from '@/lib/push-notifications'
import { useUserPreferences } from './useUserPreferences'

export function usePushNotifications() {
  const { address } = useAccount()
  const { updateNotificationSettings, getUserPrefs } = useUserPreferences()
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

      // Subscribe to push notifications
      const success = await subscribeToPushNotifications()
      if (success) {
        setIsSubscribed(true)
        // Update user preferences to reflect push notifications are enabled
        updateNotificationSettings({ pushNotificationsEnabled: true })
        console.log('[v0] Push notifications enabled for', address)
      }
      return success
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, permission, address, requestPermission, updateNotificationSettings])

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

  const sendTest = useCallback(async () => {
    if (!isSupported || permission !== 'granted') return false

    try {
      await sendTestNotification('Portal Cap', {
        body: 'This is a test notification',
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
    sendTest,
  }
}
