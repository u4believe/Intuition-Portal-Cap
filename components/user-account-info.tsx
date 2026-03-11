'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useDiscordAuth, getDiscordAvatarUrl } from '@/hooks/useDiscordAuth'
import { logout as globalLogout } from '@/hooks/useAuth'
import Image from 'next/image'

export function UserAccountInfo() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { discordUser, logout: discordLogout } = useDiscordAuth()

  // Discord-authenticated user (no wallet)
  if (!isConnected && discordUser) {
    const avatarUrl = getDiscordAvatarUrl(discordUser.id, discordUser.avatar, 64)
    const displayName = discordUser.globalName || discordUser.username

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <img
            src={avatarUrl}
            alt={displayName}
            width={22}
            height={22}
            className="rounded-full"
          />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
            {displayName}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            discordLogout()
            window.location.href = '/auth/login'
          }}
          className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    )
  }

  // Wallet-authenticated user
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
            {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnect()}
          className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    )
  }

  return null
}
