'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDiscordAuth } from '@/hooks/useDiscordAuth'

/**
 * For users signed in with Discord: which wallet (if any) is linked to their
 * account. `needsWallet` is true when we should recommend linking one.
 * Wallet sign-ins never need this.
 */
export function useWalletLink() {
  const { discordUser, isLoading: discordLoading } = useDiscordAuth()
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/wallet-link', { cache: 'no-store' })
      if (res.ok) setLinkedWallet((await res.json()).linkedWallet ?? null)
    } catch {
      // Leave as unknown; the prompt simply won't show.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (discordUser) refresh()
  }, [discordUser, refresh])

  // A wallet sign-in in this browser means they already have a wallet identity.
  let walletSignIn = false
  try {
    walletSignIn = typeof window !== 'undefined' && !!localStorage.getItem('portal_cap_auth')
  } catch {}

  return {
    discordUser,
    linkedWallet,
    isLoading: discordLoading || (!!discordUser && !loaded),
    needsWallet: !!discordUser && loaded && !linkedWallet && !walletSignIn,
    setLinkedWallet,
    refresh,
  }
}
