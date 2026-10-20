'use client'

import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Check, Link2, Loader2, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletConnectButton } from '@/components/wallet-connect-button'
import { buildLinkMessage } from '@/lib/account/link-message'

const DISMISS_KEY = 'portal_cap_link_wallet_dismissed_until'
const DISMISS_DAYS = 7

const BENEFITS = [
  'See your positions and PnL without typing your address',
  'Let the AI Analyst answer questions about your wallet',
  'Use Premium private activity to hide your transactions from others’ alerts',
]

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * Recommends linking a wallet to an account that signed in another way
 * (Discord), and walks through connect → sign → linked.
 *
 * variant "banner" can be dismissed for a week; "inline" is a compact button
 * for places where a wallet is required for a feature.
 */
export default function LinkWalletPrompt({
  discordId,
  onLinked,
  variant = 'banner',
}: {
  discordId: string
  onLinked: (address: string) => void
  variant?: 'banner' | 'inline'
}) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [open, setOpen] = useState(variant === 'banner')
  const [step, setStep] = useState<'idle' | 'signing' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (variant !== 'banner') return
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
      setDismissed(until > Date.now())
    } catch {}
  }, [variant])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {}
    setDismissed(true)
  }

  async function link() {
    if (!address) return
    setError(null)
    setStep('signing')
    try {
      const timestamp = Date.now()
      const signature = await signMessageAsync({ message: buildLinkMessage(discordId, address, timestamp) })
      const res = await fetch('/api/account/wallet-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, timestamp }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message ?? 'Could not link the wallet.')
      setStep('done')
      onLinked(data.linkedWallet)
    } catch (err: any) {
      setStep('idle')
      // A rejected signature in the wallet isn't an error worth shouting about.
      const msg = String(err?.shortMessage || err?.message || '')
      setError(/reject|denied/i.test(msg) ? 'Signature cancelled.' : msg || 'Could not link the wallet.')
    }
  }

  if (variant === 'banner' && dismissed) return null

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
        <Check className="w-4 h-4" />
        Wallet {address ? shortAddress(address) : ''} linked to your account.
      </div>
    )
  }

  const flow = (
    <div className="space-y-3">
      {!isConnected ? (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">Choose your wallet:</p>
          <WalletConnectButton />
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={link}
            disabled={step === 'signing'}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0"
          >
            {step === 'signing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {step === 'signing' ? 'Confirm in your wallet…' : `Link ${shortAddress(address!)}`}
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            You’ll sign a message to prove you own it — no transaction, no gas.
          </span>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )

  if (variant === 'inline') {
    return open ? (
      flow
    ) : (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 bg-transparent">
        <Wallet className="w-3.5 h-3.5" />
        Link your wallet
      </Button>
    )
  }

  return (
    <div className="relative rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        title="Not now"
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
          <Wallet className="w-4 h-4" />
        </span>
        <div className="space-y-3 min-w-0">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Link your wallet to your account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You signed in with Discord. Linking your wallet lets Portal Cap:
            </p>
          </div>
          <ul className="space-y-1">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-cyan-500" />
                {b}
              </li>
            ))}
          </ul>
          {flow}
        </div>
      </div>
    </div>
  )
}
