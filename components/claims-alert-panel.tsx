'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Star, RefreshCw } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import type { ClaimAlertPref } from '@/lib/push-notifications'

type BooleanPrefKey = 'deposits' | 'redemptions' | 'marketCap' | 'positionCount' | 'sharesChange'

const BADGE_CONFIG: { key: BooleanPrefKey; label: (p: ClaimAlertPref) => string; activeClass: string }[] = [
  {
    key: 'deposits',
    label: p => {
      const min = p.depositsMin ?? 0
      const max = p.depositsMax ?? 10000
      const maxStr = max >= 10000 ? '∞' : max >= 1000 ? `${(max / 1000).toFixed(0)}k` : String(max)
      return `Dep ${min}-${maxStr}`
    },
    activeClass: 'bg-green-900/60 text-green-300 border-green-700/50',
  },
  {
    key: 'redemptions',
    label: p => {
      const min = p.redemptionsMin ?? 0
      const max = p.redemptionsMax ?? 10000
      const maxStr = max >= 10000 ? '∞' : max >= 1000 ? `${(max / 1000).toFixed(0)}k` : String(max)
      return `Rdm ${min}-${maxStr}`
    },
    activeClass: 'bg-red-900/60 text-red-300 border-red-700/50',
  },
  {
    key: 'marketCap',
    label: p => `Mkt ≥${p.marketCapMin ?? 2}%`,
    activeClass: 'bg-blue-900/60 text-blue-300 border-blue-700/50',
  },
  {
    key: 'positionCount',
    label: () => 'Positions',
    activeClass: 'bg-amber-900/60 text-amber-300 border-amber-700/50',
  },
  {
    key: 'sharesChange',
    label: p => `Shares ≥${p.sharesChangeMin ?? 2}%`,
    activeClass: 'bg-purple-900/60 text-purple-300 border-purple-700/50',
  },
]

interface ClaimAlertsPanelProps {
  refreshTrigger?: number
}

export default function ClaimAlertsPanel({ refreshTrigger }: ClaimAlertsPanelProps) {
  const { getClaimAlertPrefs, removeClaimAlertPref, upsertClaimAlertPref } = usePushNotifications()
  const [prefs, setPrefs] = useState<Record<string, ClaimAlertPref>>({})
  const [loading, setLoading] = useState(false)

  const fetchPrefs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getClaimAlertPrefs()
      setPrefs(data)
    } finally {
      setLoading(false)
    }
  }, [getClaimAlertPrefs])

  useEffect(() => {
    fetchPrefs()
  }, [fetchPrefs, refreshTrigger])

  const handleRemoveClaim = async (termId: string) => {
    await removeClaimAlertPref(termId)
    setPrefs(prev => {
      const next = { ...prev }
      delete next[termId]
      return next
    })
  }

  const handleToggleType = async (termId: string, typeKey: BooleanPrefKey) => {
    const pref = prefs[termId]
    if (!pref) return
    const updated: ClaimAlertPref = { ...pref, [typeKey]: !pref[typeKey] }
    const allOff = !updated.deposits && !updated.redemptions && !updated.marketCap && !updated.positionCount && !updated.sharesChange
    if (allOff) {
      await handleRemoveClaim(termId)
      return
    }
    await upsertClaimAlertPref(termId, updated)
    setPrefs(prev => ({ ...prev, [termId]: updated }))
  }

  const entries = Object.entries(prefs)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
          <Star className="w-3 h-3" />
          Watched Claims
        </span>
        <button
          onClick={fetchPrefs}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && entries.length === 0 ? (
        <p className="text-xs text-slate-500 px-1">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-slate-700 p-3 bg-slate-800/30">
          <p className="text-xs text-slate-500 text-center">
            No claim alerts configured. Click the ★ star on any vault to set up per-claim alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(([termId, pref]) => (
            <div key={termId} className="rounded-lg border border-slate-700 bg-slate-800/30 p-2.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-slate-200 truncate flex-1 leading-tight" title={pref.label}>
                  {pref.label}
                </p>
                <button
                  onClick={() => handleRemoveClaim(termId)}
                  className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                  title="Remove all alerts for this claim"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {BADGE_CONFIG.map(({ key, label, activeClass }) => {
                  const active = pref[key]
                  return (
                    <button
                      key={key}
                      onClick={() => handleToggleType(termId, key)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                        active
                          ? activeClass
                          : 'bg-slate-800 text-slate-600 border-slate-700 hover:text-slate-400'
                      }`}
                      title={active ? `Disable ${key} alerts` : `Enable ${key} alerts`}
                    >
                      {active ? label(pref) : key}
                      {active && <X className="w-2.5 h-2.5 opacity-70" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
