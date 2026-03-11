'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { useEffect, useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { WalletConnectButton } from '@/components/wallet-connect-button'
import { useAuthCheck } from '@/hooks/useAuth'
import Link from 'next/link'
import Image from 'next/image'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.018.01.034.021.046a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMethod, setActiveMethod] = useState<'wallet' | 'discord' | null>(null)

  // Translate URL error params to user-friendly messages
  const urlError = searchParams.get('error')
  const errorMessages: Record<string, string> = {
    discord_cancelled: 'Discord sign-in was cancelled.',
    discord_not_configured: 'Discord sign-in is not yet configured.',
    discord_token_failed: 'Discord sign-in failed — please try again.',
    discord_profile_failed: 'Could not retrieve your Discord profile.',
    discord_failed: 'Discord sign-in failed — please try again.',
  }

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/')
    }
  }, [isAuthenticated, authLoading, router])

  async function handleWalletLogin() {
    if (!address) return
    setError('')
    setLoading(true)
    setActiveMethod('wallet')

    try {
      const message = `Sign this message to authenticate with Portal Cap\n\nWallet: ${address}\nTimestamp: ${Date.now()}`
      const signature = await signMessageAsync({ message })

      localStorage.setItem('portal_cap_auth', JSON.stringify({
        address,
        message,
        signature,
        timestamp: Date.now(),
      }))

      router.push('/')
    } catch (err: any) {
      setError(err.message || 'Failed to sign message')
    } finally {
      setLoading(false)
      setActiveMethod(null)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayError = error || (urlError ? errorMessages[urlError] : '')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
      {/* Logo */}
      <Link href="/" className="mb-8 hover:opacity-80 transition-opacity">
        <img src="/logo.jpg" alt="Portal Cap" className="h-14 w-14 rounded-full" />
      </Link>

      <div className="w-full max-w-md space-y-3">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Sign in to Portal Cap</h1>
          <p className="text-slate-400 text-sm">Choose how you want to sign in</p>
        </div>

        {displayError && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3 text-center">
            {displayError}
          </div>
        )}

        {/* Wallet Option */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Crypto Wallet</p>
              <p className="text-xs text-slate-400">MetaMask, WalletConnect &amp; more</p>
            </div>
          </div>

          {!isConnected ? (
            <WalletConnectButton />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <p className="text-sm font-mono text-slate-300 truncate">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </p>
              </div>
              <Button
                onClick={handleWalletLogin}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                disabled={loading && activeMethod === 'wallet'}
              >
                {loading && activeMethod === 'wallet' ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing…
                  </span>
                ) : (
                  'Sign &amp; Continue'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-slate-800" />
          <span className="text-xs text-slate-600 uppercase tracking-wider">or</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>

        {/* Discord Option */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <DiscordIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Discord</p>
              <p className="text-xs text-slate-400">Sign in with your Discord account</p>
            </div>
          </div>

          <a href="/api/auth/discord">
            <Button
              className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white gap-2"
            >
              <DiscordIcon className="w-4 h-4" />
              Continue with Discord
            </Button>
          </a>
        </div>

        <p className="text-center text-xs text-slate-600 pt-2">
          By signing in, you agree to use this app for monitoring Intuition blockchain data.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
