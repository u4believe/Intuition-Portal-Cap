'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

export interface DiscordUser {
  id: string
  username: string
  globalName: string | null
  avatar: string | null
  authenticatedAt: number
  expiresAt: number
}

const STORAGE_KEY = 'portal_cap_discord_auth'

export function getDiscordAvatarUrl(id: string, avatarHash: string | null, size = 64): string {
  if (!avatarHash) {
    const defaultIndex = (parseInt(id.slice(-4), 16) || 0) % 6
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex % 5}.png`
  }
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'webp'
  return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${ext}?size=${size}`
}

export function useDiscordAuth() {
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check for fresh OAuth callback data in the URL
    const encoded = searchParams.get('discord_auth')
    if (encoded) {
      try {
        const profile: DiscordUser = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
        setDiscordUser(profile)
        // Clean the discord_auth param from the URL without navigation
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('discord_auth')
        window.history.replaceState(null, '', newUrl.toString())
        setIsLoading(false)
        return
      } catch (e) {
        console.error('[Discord Auth] Failed to parse OAuth response:', e)
      }
    }

    // Check stored session
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const user: DiscordUser = JSON.parse(stored)
        if (user.expiresAt > Date.now()) {
          setDiscordUser(user)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch (e) {
      console.error('[Discord Auth] Failed to read stored session:', e)
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsLoading(false)
  }, [searchParams])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setDiscordUser(null)
  }, [])

  return { discordUser, logout, isLoading }
}
