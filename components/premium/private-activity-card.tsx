'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EyeOff, Loader2, Lock, Sparkles } from 'lucide-react'
import { billingAuthHeaders } from '@/lib/billing/auth-headers'

interface Status {
  isPremium: boolean
  isWallet: boolean
  hideActivity: boolean
}

/** Premium setting: keep this wallet's deposits/redemptions out of other users' push alerts. */
export default function PrivateActivityCard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/premium/private-activity', { headers: billingAuthHeaders(), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStatus(data))
      .catch(() => {})
  }, [])

  async function toggle() {
    if (!status || saving) return
    const next = !status.hideActivity
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/premium/private-activity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...billingAuthHeaders() },
        body: JSON.stringify({ hideActivity: next }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error?.message ?? 'Could not save the setting.')
      setStatus({ ...status, hideActivity: data.hideActivity })
    } catch (err: any) {
      setError(err?.message || 'Could not save the setting.')
    } finally {
      setSaving(false)
    }
  }

  const locked = status && !status.isPremium
  const noWallet = status?.isPremium && !status.isWallet
  const on = !!status?.hideActivity

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-cyan-500" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Private activity</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Sparkles className="w-2.5 h-2.5" />
            Premium
          </span>
        </div>
        {status && !locked && !noWallet && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Keep my transactions out of other users' alerts"
            onClick={toggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
              on ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        )}
        {!status && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Keep your deposits and redemptions out of other Portal Cap users’ push notifications. You’ll still get alerts about
        your own activity.
      </p>

      {locked && (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          <Lock className="w-3.5 h-3.5" />
          Upgrade to Premium to turn this on
        </Link>
      )}
      {noWallet && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Sign in with your wallet to keep its activity private.</p>
      )}
      {status && !locked && !noWallet && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {on ? 'On — other users aren’t alerted about your transactions.' : 'Off — your transactions can appear in others’ alerts.'}
        </p>
      )}
      <p className="text-[11px] text-slate-400">
        Transactions are public on-chain; this only controls Portal Cap’s alerts.
      </p>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
