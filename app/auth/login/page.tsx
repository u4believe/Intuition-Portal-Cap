'use client'

import type React from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WalletConnectButton } from '@/components/wallet-connect-button'
import { useAuthCheck } from '@/hooks/useAuth'

export default function LoginPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, router])

  // Auto-sign when wallet connects if not already authenticated
  useEffect(() => {
    if (isConnected && address && !isAuthenticated && !loading) {
      handleWalletLogin()
    }
  }, [isConnected, address, isAuthenticated, loading])

  async function handleWalletLogin() {
    if (!address) return
    setError('')
    setLoading(true)

    try {
      // Sign a message to prove wallet ownership
      const message = `Sign this message to authenticate with Intuition Portal Cap\n\nWallet: ${address}\nTimestamp: ${Date.now()}`
      const signature = await signMessageAsync({ message })

      // Store authentication in localStorage
      localStorage.setItem('portal_cap_auth', JSON.stringify({
        address,
        message,
        signature,
        timestamp: Date.now(),
      }))

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to sign message')
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-400">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Intuition Portal Cap</CardTitle>
          <CardDescription>Sign in with your wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!isConnected ? (
              <WalletConnectButton />
            ) : (
              <>
                <div className="p-3 bg-slate-800 rounded-lg text-sm">
                  <p className="text-slate-400">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>

                <Button
                  onClick={handleWalletLogin}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Signing...' : 'Sign and Login'}
                </Button>
              </>
            )}

            {error && <div className="text-sm text-destructive text-center">{error}</div>}

            <p className="text-sm text-center text-muted-foreground">
              Connect your wallet to get started
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
