'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bell, TrendingDown, TrendingUp, CheckCircle2, Info } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useCurrentUserId } from '@/hooks/useCurrentUserId'

export interface AlertRanges {
  deposits: { enabled: boolean; min: string; max: string }
  redemptions: { enabled: boolean; min: string; max: string }
}

const STORAGE_KEY = 'portal_cap_alert_ranges'

export function loadAlertRanges(): AlertRanges {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    deposits: { enabled: false, min: '0', max: '10000' },
    redemptions: { enabled: false, min: '0', max: '10000' },
  }
}

async function syncAlertRangesToServer(userId: string, ranges: AlertRanges) {
  try {
    const payload = {
      deposits: ranges.deposits.enabled
        ? { enabled: true, min: parseFloat(ranges.deposits.min) || 0, max: parseFloat(ranges.deposits.max) || 10000 }
        : { enabled: false, min: 0, max: 0 },
      redemptions: ranges.redemptions.enabled
        ? { enabled: true, min: parseFloat(ranges.redemptions.min) || 0, max: parseFloat(ranges.redemptions.max) || 10000 }
        : { enabled: false, min: 0, max: 0 },
    }
    await fetch('/api/push-subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userId, alertRanges: payload }),
    })
  } catch (e) {
    console.error('[Alerts] Failed to sync ranges to server:', e)
  }
}

interface AlertsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RangeSection({
  title,
  icon,
  color,
  enabled,
  onToggle,
  min,
  onMinChange,
  max,
  onMaxChange,
}: {
  title: string
  icon: React.ReactNode
  color: string
  enabled: boolean
  onToggle: () => void
  min: string
  onMinChange: (v: string) => void
  max: string
  onMaxChange: (v: string) => void
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${enabled ? 'border-cyan-600/60 bg-slate-800/60' : 'border-slate-700 bg-slate-800/30'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span className="font-semibold text-white text-sm">{title}</span>
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${enabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
          aria-label={`Toggle ${title} alerts`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 mt-2">
          <p className="text-xs text-slate-400">
            Alert when a {title.toLowerCase()} TRUST amount falls within this range
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Min TRUST</Label>
              <Input
                type="number"
                min="0"
                step="10"
                value={min}
                onChange={(e) => onMinChange(e.target.value)}
                placeholder="0"
                className="bg-slate-900 border-slate-600 text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Max TRUST</Label>
              <Input
                type="number"
                min="0"
                step="10"
                value={max}
                onChange={(e) => onMaxChange(e.target.value)}
                placeholder="10000"
                className="bg-slate-900 border-slate-600 text-white h-9 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Notify me when {title.toLowerCase()} amount is between {min || '0'} – {max || '10,000'} TRUST
          </p>
        </div>
      )}
    </div>
  )
}

export default function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const userId = useCurrentUserId()
  const { isSubscribed, isSupported, subscribe, isLoading: pushLoading } = usePushNotifications()
  const [saved, setSaved] = useState(false)

  const [depositsEnabled, setDepositsEnabled] = useState(false)
  const [depositsMin, setDepositsMin] = useState('0')
  const [depositsMax, setDepositsMax] = useState('10000')

  const [redemptionsEnabled, setRedemptionsEnabled] = useState(false)
  const [redemptionsMin, setRedemptionsMin] = useState('0')
  const [redemptionsMax, setRedemptionsMax] = useState('10000')

  // Load saved ranges when dialog opens
  useEffect(() => {
    if (!open) return
    const ranges = loadAlertRanges()
    setDepositsEnabled(ranges.deposits.enabled)
    setDepositsMin(ranges.deposits.min)
    setDepositsMax(ranges.deposits.max)
    setRedemptionsEnabled(ranges.redemptions.enabled)
    setRedemptionsMin(ranges.redemptions.min)
    setRedemptionsMax(ranges.redemptions.max)
    setSaved(false)
  }, [open])

  const handleSave = async () => {
    const ranges: AlertRanges = {
      deposits: { enabled: depositsEnabled, min: depositsMin, max: depositsMax },
      redemptions: { enabled: redemptionsEnabled, min: redemptionsMin, max: redemptionsMax },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges))
    if (userId && isSubscribed) {
      await syncAlertRangesToServer(userId, ranges)
    }
    setSaved(true)
    setTimeout(() => onOpenChange(false), 800)
  }

  const anyEnabled = depositsEnabled || redemptionsEnabled

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            Alerts
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-1">
            Get push notifications when a deposit or redemption matches your TRUST range.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <RangeSection
            title="Deposits"
            icon={<TrendingUp className="w-4 h-4" />}
            color="text-green-400"
            enabled={depositsEnabled}
            onToggle={() => setDepositsEnabled(v => !v)}
            min={depositsMin}
            onMinChange={setDepositsMin}
            max={depositsMax}
            onMaxChange={setDepositsMax}
          />

          <RangeSection
            title="Redemptions"
            icon={<TrendingDown className="w-4 h-4" />}
            color="text-red-400"
            enabled={redemptionsEnabled}
            onToggle={() => setRedemptionsEnabled(v => !v)}
            min={redemptionsMin}
            onMinChange={setRedemptionsMin}
            max={redemptionsMax}
            onMaxChange={setRedemptionsMax}
          />

          {/* Push notifications required notice */}
          {anyEnabled && !isSubscribed && isSupported && (
            <div className="bg-cyan-900/30 border border-cyan-700/40 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-cyan-300 mb-2">
                  Enable push notifications to receive these alerts on your device.
                </p>
                <Button
                  size="sm"
                  onClick={() => subscribe()}
                  disabled={pushLoading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7"
                >
                  <Bell className="w-3 h-3 mr-1" />
                  {pushLoading ? 'Enabling…' : 'Enable Push Notifications'}
                </Button>
              </div>
            </div>
          )}

          {anyEnabled && isSubscribed && (
            <div className="flex items-center gap-2 text-cyan-300 text-xs px-1">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Push notifications are active — you'll receive alerts in real time.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
          >
            {saved ? (
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Saved</span>
            ) : 'Save Alerts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
