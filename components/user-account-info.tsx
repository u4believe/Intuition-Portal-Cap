'use client'

import { useAccount, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function UserAccountInfo() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  if (!isConnected || !address) {
    return null
  }

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="flex items-center gap-3">
      <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
          {truncateAddress(address)}
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
