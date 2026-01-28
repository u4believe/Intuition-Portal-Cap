'use client'

import { useAccount } from 'wagmi'
import { useCallback } from 'react'
import {
  getUserPreferences,
  saveUserPreferences,
  addWatchedClaim as addWatched,
  removeWatchedClaim as removeWatched,
  updateNotificationSettings as updateNotifs,
  getWatchedClaims as getWatched,
  UserPreferences,
} from '@/lib/local-storage'

export function useUserPreferences() {
  const { address } = useAccount()

  const getUserPrefs = useCallback(() => {
    if (!address) return null
    return getUserPreferences(address)
  }, [address])

  const saveUserPrefs = useCallback(
    (preferences: UserPreferences) => {
      if (!address) return false
      return saveUserPreferences(address, preferences)
    },
    [address]
  )

  const addWatchedClaim = useCallback(
    (claimLabel: string) => {
      if (!address) return false
      return addWatched(address, claimLabel)
    },
    [address]
  )

  const removeWatchedClaim = useCallback(
    (claimLabel: string) => {
      if (!address) return false
      return removeWatched(address, claimLabel)
    },
    [address]
  )

  const updateNotificationSettings = useCallback(
    (settings: Partial<UserPreferences['notificationSettings']>) => {
      if (!address) return false
      return updateNotifs(address, settings)
    },
    [address]
  )

  const getWatchedClaims = useCallback(() => {
    if (!address) return []
    return getWatched(address)
  }, [address])

  return {
    getUserPrefs,
    saveUserPrefs,
    addWatchedClaim,
    removeWatchedClaim,
    updateNotificationSettings,
    getWatchedClaims,
    isConnected: !!address,
  }
}
