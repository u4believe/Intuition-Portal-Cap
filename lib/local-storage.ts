/**
 * Decentralized localStorage utilities for Lore
 * Stores user preferences, watched claims, and notification settings locally
 */

export interface UserPreferences {
  watchedClaims: string[]
  notificationSettings: {
    email: string
    enabled: boolean
    frequency: 'instant' | 'daily' | 'weekly'
  }
  theme: 'dark' | 'light'
  lastUpdated: number
}

const STORAGE_KEY_PREFIX = 'lore_'

function getStorageKey(address: string, key: string): string {
  return `${STORAGE_KEY_PREFIX}${address}_${key}`
}

export function getUserPreferences(address: string): UserPreferences {
  try {
    const stored = localStorage.getItem(getStorageKey(address, 'preferences'))
    if (!stored) {
      return getDefaultPreferences()
    }
    return JSON.parse(stored)
  } catch (error) {
    console.error('[v0] Failed to get user preferences:', error)
    return getDefaultPreferences()
  }
}

export function getDefaultPreferences(): UserPreferences {
  return {
    watchedClaims: [],
    notificationSettings: {
      email: '',
      enabled: false,
      frequency: 'daily',
    },
    theme: 'dark',
    lastUpdated: Date.now(),
  }
}

export function saveUserPreferences(address: string, preferences: UserPreferences): boolean {
  try {
    preferences.lastUpdated = Date.now()
    localStorage.setItem(getStorageKey(address, 'preferences'), JSON.stringify(preferences))
    return true
  } catch (error) {
    console.error('[v0] Failed to save user preferences:', error)
    return false
  }
}

export function addWatchedClaim(address: string, claimLabel: string): boolean {
  try {
    const prefs = getUserPreferences(address)
    if (!prefs.watchedClaims.includes(claimLabel)) {
      prefs.watchedClaims.push(claimLabel)
      return saveUserPreferences(address, prefs)
    }
    return true
  } catch (error) {
    console.error('[v0] Failed to add watched claim:', error)
    return false
  }
}

export function removeWatchedClaim(address: string, claimLabel: string): boolean {
  try {
    const prefs = getUserPreferences(address)
    prefs.watchedClaims = prefs.watchedClaims.filter((claim) => claim !== claimLabel)
    return saveUserPreferences(address, prefs)
  } catch (error) {
    console.error('[v0] Failed to remove watched claim:', error)
    return false
  }
}

export function updateNotificationSettings(
  address: string,
  settings: Partial<UserPreferences['notificationSettings']>
): boolean {
  try {
    const prefs = getUserPreferences(address)
    prefs.notificationSettings = { ...prefs.notificationSettings, ...settings }
    return saveUserPreferences(address, prefs)
  } catch (error) {
    console.error('[v0] Failed to update notification settings:', error)
    return false
  }
}

export function getWatchedClaims(address: string): string[] {
  try {
    const prefs = getUserPreferences(address)
    return prefs.watchedClaims
  } catch (error) {
    console.error('[v0] Failed to get watched claims:', error)
    return []
  }
}

export function clearUserData(address: string): boolean {
  try {
    const keys = Object.keys(localStorage)
    const prefix = `${STORAGE_KEY_PREFIX}${address}_`
    keys.forEach((key) => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key)
      }
    })
    return true
  } catch (error) {
    console.error('[v0] Failed to clear user data:', error)
    return false
  }
}
