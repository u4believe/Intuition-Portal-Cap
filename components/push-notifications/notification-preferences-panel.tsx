'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, TrendingUp, TrendingDown, Pause, Play, Settings, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentUserId } from '@/hooks/useCurrentUserId'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { loadAlertRanges, AlertRanges } from '@/components/alerts-dialog'

const STORAGE_KEY = 'portal_cap_alert_ranges'

async function patchAlertRanges(userId: string, ranges: AlertRanges) {
  const payload = {
    deposits: {
      enabled: ranges.deposits.enabled,
      min: parseFloat(ranges.deposits.min) || 0,
      max: parseFloat(ranges.deposits.max) || 10000,
    },
    redemptions: {
      enabled: ranges.redemptions.enabled,
      min: parseFloat(ranges.redemptions.min) || 0,
      max: parseFloat(ranges.redemptions.max) || 10000,
    },
  }
  await fetch('/api/push-subscriptions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: userId, alertRanges: payload }),
  })
}

interface ToggleRowProps {
  icon: React.ReactNode
  label: string
  description: string
  paused: boolean
  range: { min: string; max: string }
  onToggle: () => void
  saving: boolean
  accentClass: string
}

function ToggleRow({ icon, label, description, paused, range, onToggle, saving, accentClass }: ToggleRowProps) {
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${!paused ? `border-cyan-600/50 bg-slate-800/60` : 'border-slate-700/60 bg-slate-800/30'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg ${!paused ? 'bg-slate-700' : 'bg-slate-800'}`}>
            <span className={!paused ? accentClass : 'text-slate-500'}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${!paused ? 'text-white' : 'text-slate-500'}`}>{label}</p>
            <p className="text-xs text-slate-500 truncate">
              {!paused ? `${range.min}–${range.max} TRUST` : 'Paused'}
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          disabled={saving}
          title={paused ? `Resume ${label}` : `Pause ${label}`}
          className={`ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
            ${!paused
              ? 'border-cyan-600/40 bg-cyan-900/20 text-cyan-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-500/40'
              : 'border-slate-600/40 bg-slate-700/30 text-slate-400 hover:bg-cyan-900/20 hover:text-cyan-400 hover:border-cyan-500/40'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : paused ? (
            <Play className="w-3 h-3" />
          ) : (
            <Pause className="w-3 h-3" />
          )}
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  )
}

interface NotificationPreferencesPanelProps {
  onOpenSettings: () => void
}

export default function NotificationPreferencesPanel({ onOpenSettings }: NotificationPreferencesPanelProps) {
  const userId = useCurrentUserId()
  const { isServerSubscribed, isSupported } = usePushNotifications()

  const [ranges, setRanges] = useState<AlertRanges>(() => loadAlertRanges())
  const [savingDeposits, setSavingDeposits] = useState(false)
  const [savingRedemptions, setSavingRedemptions] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    setRanges(loadAlertRanges())
  }, [isServerSubscribed])

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  const toggleDeposits = useCallback(async () => {
    if (!userId) return
    setSavingDeposits(true)
    const next: AlertRanges = {
      ...ranges,
      deposits: { ...ranges.deposits, enabled: !ranges.deposits.enabled },
    }
    setRanges(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    try {
      await patchAlertRanges(userId, next)
      showFeedback('ok', `Deposit alerts ${next.deposits.enabled ? 'resumed' : 'paused'}`)
    } catch {
      showFeedback('err', 'Failed to save — please try again')
      setRanges(ranges)
    } finally {
      setSavingDeposits(false)
    }
  }, [userId, ranges])

  const toggleRedemptions = useCallback(async () => {
    if (!userId) return
    setSavingRedemptions(true)
    const next: AlertRanges = {
      ...ranges,
      redemptions: { ...ranges.redemptions, enabled: !ranges.redemptions.enabled },
    }
    setRanges(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    try {
      await patchAlertRanges(userId, next)
      showFeedback('ok', `Redemption alerts ${next.redemptions.enabled ? 'resumed' : 'paused'}`)
    } catch {
      showFeedback('err', 'Failed to save — please try again')
      setRanges(ranges)
    } finally {
      setSavingRedemptions(false)
    }
  }, [userId, ranges])

  if (!isSupported || !userId) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Push Alerts</span>
        </div>
        <div className="flex items-center gap-2">
          {isServerSubscribed ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          ) : (
            <span className="text-xs text-slate-500 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded-full">
              Not set up
            </span>
          )}
          <button
            onClick={onOpenSettings}
            title="Notification settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isServerSubscribed ? (
        <div className="space-y-2">
          <ToggleRow
            icon={<TrendingUp className="w-4 h-4" />}
            label="Deposits"
            description="deposit alerts"
            paused={!ranges.deposits.enabled}
            range={{ min: ranges.deposits.min, max: ranges.deposits.max }}
            onToggle={toggleDeposits}
            saving={savingDeposits}
            accentClass="text-emerald-400"
          />
          <ToggleRow
            icon={<TrendingDown className="w-4 h-4" />}
            label="Redemptions"
            description="redemption alerts"
            paused={!ranges.redemptions.enabled}
            range={{ min: ranges.redemptions.min, max: ranges.redemptions.max }}
            onToggle={toggleRedemptions}
            saving={savingRedemptions}
            accentClass="text-rose-400"
          />

          {feedback && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              feedback.type === 'ok'
                ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-900/20 text-red-400 border border-red-500/30'
            }`}>
              {feedback.type === 'ok'
                ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                : <AlertCircle className="w-3 h-3 flex-shrink-0" />
              }
              {feedback.msg}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 text-center">
          <Bell className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 mb-3">Enable push notifications to get alerts for deposits and redemptions.</p>
          <Button
            size="sm"
            onClick={onOpenSettings}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7 px-3"
          >
            Enable Notifications
          </Button>
        </div>
      )}
    </div>
  )
}
