'use client'

import { useCallback } from 'react'
import { useCurrentUserId } from './useCurrentUserId'
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
  const userId = useCurrentUserId()

  const getUserPrefs = useCallback(() => {
    if (!userId) return null
    return getUserPreferences(userId)
  }, [userId])

  const saveUserPrefs = useCallback(
    (preferences: UserPreferences) => {
      if (!userId) return false
      return saveUserPreferences(userId, preferences)
    },
    [userId]
  )

  const addWatchedClaim = useCallback(
    (claimLabel: string) => {
      if (!userId) return false
      return addWatched(userId, claimLabel)
    },
    [userId]
  )

  const removeWatchedClaim = useCallback(
    (claimLabel: string) => {
      if (!userId) return false
      return removeWatched(userId, claimLabel)
    },
    [userId]
  )

  const updateNotificationSettings = useCallback(
    (settings: Partial<UserPreferences['notificationSettings']>) => {
      if (!userId) return false
      return updateNotifs(userId, settings)
    },
    [userId]
  )

  const getWatchedClaims = useCallback(() => {
    if (!userId) return []
    return getWatched(userId)
  }, [userId])

  return {
    getUserPrefs,
    saveUserPrefs,
    addWatchedClaim,
    removeWatchedClaim,
    updateNotificationSettings,
    getWatchedClaims,
    isConnected: !!userId,
  }
}
