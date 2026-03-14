'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Bell, CheckCircle2, TrendingUp, Users, BarChart2, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import type { ClaimAlertPref } from '@/lib/push-notifications'

interface WatchPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claimLabel: string
  termId: string
  onConfirm: (claimLabel: string, termId: string) => void
  mode?: 'add' | 'edit'
  initialPrefs?: Partial<ClaimAlertPref>
}

interface PrefState {
  deposits: boolean
  depositsMin: string
  depositsMax: string
  redemptions: boolean
  redemptionsMin: string
  redemptionsMax: string
  marketCap: boolean
  marketCapMin: string
  positionCount: boolean
  sharesChange: boolean
  sharesChangeMin: string
}

const DEFAULT_STATE: PrefState = {
  deposits: true,
  depositsMin: '0',
  depositsMax: '10000',
  redemptions: true,
  redemptionsMin: '0',
  redemptionsMax: '10000',
  marketCap: true,
  marketCapMin: '2',
  positionCount: true,
  sharesChange: true,
  sharesChangeMin: '2',
}

function toState(p?: Partial<ClaimAlertPref>): PrefState {
  if (!p) return DEFAULT_STATE
  return {
    deposits: p.deposits ?? true,
    depositsMin: String(p.depositsMin ?? 0),
    depositsMax: String(p.depositsMax ?? 10000),
    redemptions: p.redemptions ?? true,
    redemptionsMin: String(p.redemptionsMin ?? 0),
    redemptionsMax: String(p.redemptionsMax ?? 10000),
    marketCap: p.marketCap ?? true,
    marketCapMin: String(p.marketCapMin ?? 2),
    positionCount: p.positionCount ?? true,
    sharesChange: p.sharesChange ?? true,
    sharesChangeMin: String(p.sharesChangeMin ?? 2),
  }
}

function toPref(label: string, s: PrefState): ClaimAlertPref {
  return {
    label,
    deposits: s.deposits,
    depositsMin: parseFloat(s.depositsMin) || 0,
    depositsMax: parseFloat(s.depositsMax) || 10000,
    redemptions: s.redemptions,
    redemptionsMin: parseFloat(s.redemptionsMin) || 0,
    redemptionsMax: parseFloat(s.redemptionsMax) || 10000,
    marketCap: s.marketCap,
    marketCapMin: parseFloat(s.marketCapMin) || 2,
    positionCount: s.positionCount,
    sharesChange: s.sharesChange,
    sharesChangeMin: parseFloat(s.sharesChangeMin) || 2,
  }
}

function RangeRow({
  label,
  minVal,
  maxVal,
  unit,
  onMinChange,
  onMaxChange,
}: {
  label?: string
  minVal: string
  maxVal?: string
  unit: string
  onMinChange: (v: string) => void
  onMaxChange?: (v: string) => void
}) {
  return (
    <div className="ml-8 mt-1.5 flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs text-slate-500 w-full mb-0.5">{label}</span>}
      <span className="text-xs text-slate-500">Min</span>
      <input
        type="number"
        value={minVal}
        min="0"
        onChange={e => onMinChange(e.target.value)}
        className="w-20 h-6 px-1.5 text-xs rounded bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:border-cyan-500"
      />
      {maxVal !== undefined && onMaxChange && (
        <>
          <span className="text-xs text-slate-500">Max</span>
          <input
            type="number"
            value={maxVal}
            min="0"
            onChange={e => onMaxChange(e.target.value)}
            className="w-24 h-6 px-1.5 text-xs rounded bg-slate-700 border border-slate-600 text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </>
      )}
      <span className="text-xs text-slate-400">{unit}</span>
    </div>
  )
}

export default function WatchPreferencesDialog({
  open,
  onOpenChange,
  claimLabel,
  termId,
  onConfirm,
  mode = 'add',
  initialPrefs,
}: WatchPreferencesDialogProps) {
  const { isSubscribed, subscribe: enablePushNotifications, isLoading: pushLoading, upsertClaimAlertPref } = usePushNotifications()
  const [prefs, setPrefs] = useState<PrefState>(DEFAULT_STATE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPrefs(toState(initialPrefs))
  }, [open, claimLabel, initialPrefs])

  const set = (key: keyof PrefState, val: string | boolean) =>
    setPrefs(prev => ({ ...prev, [key]: val }))

  const handleConfirm = async () => {
    setSaving(true)
    try {
      if (termId) {
        await upsertClaimAlertPref(termId, toPref(claimLabel, prefs))
      }
      onConfirm(claimLabel, termId)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const anySelected = prefs.deposits || prefs.redemptions || prefs.marketCap || prefs.positionCount || prefs.sharesChange

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-base">
            {mode === 'edit' ? 'Edit Alert Preferences' : 'Watch Claim'}
          </DialogTitle>
          <p className="text-sm text-cyan-400 font-medium truncate leading-tight">{claimLabel}</p>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <p className="text-xs text-slate-400 pb-1">Choose which events trigger a push notification:</p>

          {/* Deposits */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none" onClick={() => set('deposits', !prefs.deposits)}>
              <Checkbox
                checked={prefs.deposits}
                onCheckedChange={() => set('deposits', !prefs.deposits)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Deposits</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Notify when TRUST is deposited into this vault</p>
              </div>
            </label>
            {prefs.deposits && (
              <RangeRow
                label="Alert range (TRUST amount):"
                minVal={prefs.depositsMin}
                maxVal={prefs.depositsMax}
                unit="TRUST"
                onMinChange={v => set('depositsMin', v)}
                onMaxChange={v => set('depositsMax', v)}
              />
            )}
          </div>

          {/* Redemptions */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none" onClick={() => set('redemptions', !prefs.redemptions)}>
              <Checkbox
                checked={prefs.redemptions}
                onCheckedChange={() => set('redemptions', !prefs.redemptions)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Redemptions</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Notify when TRUST is redeemed from this vault</p>
              </div>
            </label>
            {prefs.redemptions && (
              <RangeRow
                label="Alert range (TRUST amount):"
                minVal={prefs.redemptionsMin}
                maxVal={prefs.redemptionsMax}
                unit="TRUST"
                onMinChange={v => set('redemptionsMin', v)}
                onMaxChange={v => set('redemptionsMax', v)}
              />
            )}
          </div>

          {/* Market Cap */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none" onClick={() => set('marketCap', !prefs.marketCap)}>
              <Checkbox
                checked={prefs.marketCap}
                onCheckedChange={() => set('marketCap', !prefs.marketCap)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Market Cap Change</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Notify on significant market cap changes</p>
              </div>
            </label>
            {prefs.marketCap && (
              <RangeRow
                label="Minimum % change to trigger:"
                minVal={prefs.marketCapMin}
                unit="%"
                onMinChange={v => set('marketCapMin', v)}
              />
            )}
          </div>

          {/* Position Count */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none" onClick={() => set('positionCount', !prefs.positionCount)}>
              <Checkbox
                checked={prefs.positionCount}
                onCheckedChange={() => set('positionCount', !prefs.positionCount)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Position Count Change</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Notify when the number of positions changes</p>
              </div>
            </label>
          </div>

          {/* Shares Change */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <label className="flex items-start gap-3 cursor-pointer select-none" onClick={() => set('sharesChange', !prefs.sharesChange)}>
              <Checkbox
                checked={prefs.sharesChange}
                onCheckedChange={() => set('sharesChange', !prefs.sharesChange)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">Shares Change</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Notify on significant share movements</p>
              </div>
            </label>
            {prefs.sharesChange && (
              <RangeRow
                label="Minimum % change to trigger:"
                minVal={prefs.sharesChangeMin}
                unit="%"
                onMinChange={v => set('sharesChangeMin', v)}
              />
            )}
          </div>
        </div>

        {!isSubscribed && (
          <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-700/50 flex items-start gap-2 mt-1">
            <Bell className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-cyan-200">Push notifications are not yet enabled</p>
              <Button
                size="sm"
                className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-7"
                disabled={pushLoading}
                onClick={() => enablePushNotifications()}
              >
                {pushLoading ? 'Enabling…' : 'Enable Push Notifications'}
              </Button>
            </div>
          </div>
        )}

        {isSubscribed && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Push notifications enabled
          </div>
        )}

        <DialogFooter className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !anySelected}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Save & Watch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
