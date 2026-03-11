'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'

export interface PortalCapAuth {
  address: string
  signature: string
  message: string
  timestamp: number
}

/**
 * Check if a Discord session is valid (not expired)
 */
function getValidDiscordAuth(): { id: string; username: string } | null {
  try {
    const stored = localStorage.getItem('portal_cap_discord_auth')
    if (!stored) return null
    const data = JSON.parse(stored)
    if (data.expiresAt > Date.now()) {
      return { id: data.id, username: data.username }
    }
    localStorage.removeItem('portal_cap_discord_auth')
  } catch {}
  return null
}

/**
 * Hook to check if user is authenticated (wallet or Discord)
 */
export function useAuthCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authType, setAuthType] = useState<'wallet' | 'discord' | null>(null)
  const [auth, setAuth] = useState<PortalCapAuth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { address } = useAccount()

  useEffect(() => {
    // 1. Check wallet auth
    const walletStored = localStorage.getItem('portal_cap_auth')
    if (walletStored) {
      try {
        const authData = JSON.parse(walletStored) as PortalCapAuth
        if (!address || authData.address.toLowerCase() === address.toLowerCase()) {
          setAuth(authData)
          setIsAuthenticated(true)
          setAuthType('wallet')
          setIsLoading(false)
          return
        }
        // Wallet address changed — clear stale auth
        localStorage.removeItem('portal_cap_auth')
      } catch {
        localStorage.removeItem('portal_cap_auth')
      }
    }

    // 2. Check Discord auth
    const discordAuth = getValidDiscordAuth()
    if (discordAuth) {
      setIsAuthenticated(true)
      setAuthType('discord')
      setIsLoading(false)
      return
    }

    setIsAuthenticated(false)
    setAuthType(null)
    setIsLoading(false)
  }, [address])

  return { isAuthenticated, authType, auth, isLoading }
}

/**
 * Hook to protect authenticated routes — redirects to login if not authenticated
 */
export function useAuthProtected() {
  const { isAuthenticated, isLoading } = useAuthCheck()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  return { isAuthenticated, isLoading }
}

/**
 * Sign out — clears both wallet and Discord sessions
 */
export function logout() {
  localStorage.removeItem('portal_cap_auth')
  localStorage.removeItem('portal_cap_discord_auth')
  window.location.href = '/auth/login'
}
