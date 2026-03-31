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

// Removed synchronous getValidDiscordAuth since auth is now secure and asynchronous

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
    let mounted = true
    setIsLoading(true)

    async function checkAuth() {
      // 1. Check wallet auth
      const walletStored = localStorage.getItem('portal_cap_auth')
      if (walletStored) {
        try {
          const authData = JSON.parse(walletStored) as PortalCapAuth
          if (!address || authData.address.toLowerCase() === address.toLowerCase()) {
            if (mounted) {
              setAuth(authData)
              setIsAuthenticated(true)
              setAuthType('wallet')
              setIsLoading(false)
            }
            return
          }
          // Wallet address changed — clear stale auth
          localStorage.removeItem('portal_cap_auth')
        } catch {
          localStorage.removeItem('portal_cap_auth')
        }
      }

      // 2. Check secure Discord session via Server
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated && data.user && data.user.expiresAt > Date.now()) {
            if (mounted) {
              setIsAuthenticated(true)
              setAuthType('discord')
              setIsLoading(false)
            }
            return
          }
        }
      } catch (error) {
        console.error('[Auth Check] Failed to verify discord session:', error)
      }

      if (mounted) {
        setIsAuthenticated(false)
        setAuthType(null)
        setIsLoading(false)
      }
    }

    checkAuth()

    return () => { mounted = false }
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
export async function logout() {
  localStorage.removeItem('portal_cap_auth')
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch (err) {
    console.error('Failed to logout of Discord securely', err)
  }
  window.location.href = '/auth/login'
}
