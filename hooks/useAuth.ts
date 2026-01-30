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
 * Hook to check if user is authenticated
 */
export function useAuthCheck() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [auth, setAuth] = useState<PortalCapAuth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { address } = useAccount()

  useEffect(() => {
    const stored = localStorage.getItem('portal_cap_auth')
    
    if (stored) {
      try {
        const authData = JSON.parse(stored) as PortalCapAuth
        // Verify the stored address matches the connected wallet
        if (address && authData.address.toLowerCase() === address.toLowerCase()) {
          setAuth(authData)
          setIsAuthenticated(true)
        } else if (!address) {
          // Still authenticated even if wallet not currently connected
          setAuth(authData)
          setIsAuthenticated(true)
        } else {
          // Wallet address doesn't match stored auth
          setIsAuthenticated(false)
          localStorage.removeItem('portal_cap_auth')
        }
      } catch (error) {
        console.error('[v0] Failed to parse auth:', error)
        setIsAuthenticated(false)
        localStorage.removeItem('portal_cap_auth')
      }
    } else {
      setIsAuthenticated(false)
    }
    
    setIsLoading(false)
  }, [address])

  return { isAuthenticated, auth, isLoading }
}

/**
 * Hook to protect authenticated routes
 * Redirects to login if not authenticated
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
 * Logout user
 */
export function logout() {
  localStorage.removeItem('lore_auth')
  window.location.href = '/auth/login'
}
