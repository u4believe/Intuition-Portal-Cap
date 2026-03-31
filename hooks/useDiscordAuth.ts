'use client'

import { useCallback, useEffect, useState } from 'react'

export interface DiscordUser {
  id: string
  username: string
  globalName: string | null
  avatar: string | null
  authenticatedAt: number
  expiresAt: number
}

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

  useEffect(() => {
    let mounted = true

    async function verifySession() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user) {
            if (data.user.expiresAt > Date.now()) {
              if (mounted) setDiscordUser(data.user)
            }
          }
        }
      } catch (error) {
        console.error('[Discord Auth] Failed to verify session:', error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    verifySession()

    return () => { mounted = false }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('[Discord Auth] Logout failed:', e)
    }
    setDiscordUser(null)
  }, [])

  return { discordUser, logout, isLoading }
}
