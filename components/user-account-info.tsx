'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { LogOut, LayoutDashboard, ChevronDown } from 'lucide-react'
import { useDiscordAuth, getDiscordAvatarUrl } from '@/hooks/useDiscordAuth'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

function Dropdown({ onLogout, label, avatar }: {
  onLogout: () => void
  label: string
  avatar?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
      >
        {avatar}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[100px] truncate hidden sm:block">
          {label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-500" />
            Dashboard
          </Link>
          <div className="border-t border-slate-100 dark:border-slate-800" />
          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

export function UserAccountInfo() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { discordUser, logout: discordLogout } = useDiscordAuth()

  // Discord-authenticated user
  if (!isConnected && discordUser) {
    const avatarUrl = getDiscordAvatarUrl(discordUser.id, discordUser.avatar, 64)
    const displayName = discordUser.globalName || discordUser.username

    return (
      <Dropdown
        label={displayName}
        onLogout={() => { discordLogout(); window.location.href = '/auth/login' }}
        avatar={
          <img src={avatarUrl} alt={displayName} width={22} height={22} className="rounded-full flex-shrink-0" />
        }
      />
    )
  }

  // Wallet-authenticated user
  if (isConnected && address) {
    return (
      <Dropdown
        label={`${address.slice(0, 6)}…${address.slice(-4)}`}
        onLogout={() => disconnect()}
        avatar={
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex-shrink-0 inline-block" />
        }
      />
    )
  }

  return null
}
