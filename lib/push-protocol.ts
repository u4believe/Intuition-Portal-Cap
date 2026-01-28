'use client';

import { useAccount } from 'wagmi'
import { useCallback } from 'react'

export interface NotificationPreference {
  email: string
  frequency: 'instant' | 'daily' | 'weekly'
  enabled: boolean
  depositAlerts: boolean
  redemptionAlerts: boolean
  priceChangeThreshold: number // percentage
}

const PUSH_API_URL = 'https://api.push.org/restapi/v1'

/**
 * Note: For true decentralization, Push Protocol integration is limited in this client-side only app.
 * Users can:
 * 1. Set their email preferences locally (stored in localStorage)
 * 2. Manually subscribe to notifications on push.org
 * 3. Set up webhooks from Intuition GraphQL to their own email service
 *
 * Push API credentials are not stored client-side to avoid security risks.
 */

/**
 * Subscribe user to notifications via Push Protocol
 * This stores subscription preference locally without sending sensitive API keys
 */
export async function subscribeToPushNotifications(
  address: string,
  email: string
) {
  try {
    // Store subscription preference locally only
    const preferences: NotificationPreference = {
      email,
      frequency: 'daily',
      enabled: true,
      depositAlerts: true,
      redemptionAlerts: true,
      priceChangeThreshold: 5,
    }

    localStorage.setItem(
      `lore_notifications_${address}`,
      JSON.stringify(preferences)
    )

    console.log('[v0] Notification preferences saved for', address)
    console.log('[v0] User should manually subscribe on push.org or use their own email service')
    return true
  } catch (error) {
    console.error('[v0] Failed to subscribe to notifications:', error)
    return false
  }
}

/**
 * Get user's notification preferences
 */
export function getNotificationPreferences(
  address: string
): NotificationPreference | null {
  try {
    const stored = localStorage.getItem(`lore_notifications_${address}`)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error('[v0] Failed to get notification preferences:', error)
    return null
  }
}

/**
 * Update notification preferences
 */
export function updateNotificationPreferences(
  address: string,
  updates: Partial<NotificationPreference>
) {
  try {
    const current = getNotificationPreferences(address) || {
      email: '',
      frequency: 'daily' as const,
      enabled: true,
      depositAlerts: true,
      redemptionAlerts: true,
      priceChangeThreshold: 5,
    }

    const updated = { ...current, ...updates }
    localStorage.setItem(
      `lore_notifications_${address}`,
      JSON.stringify(updated)
    )

    return updated
  } catch (error) {
    console.error('[v0] Failed to update notification preferences:', error)
    return null
  }
}

/**
 * React hook for notification management
 */
export function usePushNotifications() {
  const { address } = useAccount()

  const subscribe = useCallback(
    async (email: string) => {
      if (!address) return false
      return subscribeToPushNotifications(address, email)
    },
    [address]
  )

  const getPreferences = useCallback(() => {
    if (!address) return null
    return getNotificationPreferences(address)
  }, [address])

  const updatePreferences = useCallback(
    (updates: Partial<NotificationPreference>) => {
      if (!address) return null
      return updateNotificationPreferences(address, updates)
    },
    [address]
  )

  return {
    subscribe,
    getPreferences,
    updatePreferences,
  }
}
