'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Bell, CheckCircle2 } from 'lucide-react'

interface WatchPreferences {
  marketCapThreshold: { type: 'percentage' | 'number'; value: number }
  positionThreshold: { type: 'percentage' | 'number'; value: number }
  sharesThreshold: { type: 'percentage' | 'number'; value: number }
  depositsAlertRange: { min: number; max: number }
  redemptionsAlertRange: { min: number; max: number }
  watchedAt?: string
}

interface WatchPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claimLabel: string
  onConfirm: (claimLabel: string) => void
  mode?: 'add' | 'edit'
}

function loadPreferences(claimLabel: string): WatchPreferences | null {
  try {
    const raw = localStorage.getItem(`portal_cap_watch_${claimLabel}`)
    if (!raw) return null
    return JSON.parse(raw) as WatchPreferences
  } catch {
    return null
  }
}

// Parse a string input to a positive number, returns undefined if empty/invalid
function parseNum(val: string, isFloat = false): number {
  const n = isFloat ? parseFloat(val) : parseInt(val, 10)
  return isNaN(n) || n < 0 ? 0 : n
}

export default function WatchPreferencesDialog({
  open,
  onOpenChange,
  claimLabel,
  onConfirm,
  mode = 'add',
}: WatchPreferencesDialogProps) {
  const { isSupported, isSubscribed, subscribe: enablePushNotifications, isLoading: pushLoading } = usePushNotifications()
  const [pushPermissionRequested, setPushPermissionRequested] = useState(false)

  // Use string state so users can type freely (no forced "0" when clearing the field)
  const [marketCapThresholdType, setMarketCapThresholdType] = useState<'percentage' | 'number'>('percentage')
  const [marketCapValue, setMarketCapValue] = useState('5')

  const [positionThresholdType, setPositionThresholdType] = useState<'percentage' | 'number'>('number')
  const [positionValue, setPositionValue] = useState('10')

  const [sharesThresholdType, setSharesThresholdType] = useState<'percentage' | 'number'>('percentage')
  const [sharesValue, setSharesValue] = useState('5')

  const [depositsMin, setDepositsMin] = useState('0')
  const [depositsMax, setDepositsMax] = useState('10000')

  const [redemptionsMin, setRedemptionsMin] = useState('0')
  const [redemptionsMax, setRedemptionsMax] = useState('10000')

  // Load existing preferences when dialog opens
  useEffect(() => {
    if (!open || !claimLabel) return
    const existing = loadPreferences(claimLabel)
    if (existing) {
      setMarketCapThresholdType(existing.marketCapThreshold?.type || 'percentage')
      setMarketCapValue(String(existing.marketCapThreshold?.value ?? 5))
      setPositionThresholdType(existing.positionThreshold?.type || 'number')
      setPositionValue(String(existing.positionThreshold?.value ?? 10))
      setSharesThresholdType(existing.sharesThreshold?.type || 'percentage')
      setSharesValue(String(existing.sharesThreshold?.value ?? 5))
      setDepositsMin(String(existing.depositsAlertRange?.min ?? 0))
      setDepositsMax(String(existing.depositsAlertRange?.max ?? 10000))
      setRedemptionsMin(String(existing.redemptionsAlertRange?.min ?? 0))
      setRedemptionsMax(String(existing.redemptionsAlertRange?.max ?? 10000))
    }
  }, [open, claimLabel])

  const handleEnablePushNotifications = async () => {
    const success = await enablePushNotifications()
    setPushPermissionRequested(true)
    if (!success) console.log('[v0] Push notifications not enabled')
  }

  const handleConfirm = () => {
    const existing = JSON.parse(localStorage.getItem(`portal_cap_watch_${claimLabel}`) || '{}')
    localStorage.setItem(
      `portal_cap_watch_${claimLabel}`,
      JSON.stringify({
        ...existing,
        marketCapThreshold: { type: marketCapThresholdType, value: parseNum(marketCapValue, true) },
        positionThreshold: { type: positionThresholdType, value: parseNum(positionValue) },
        sharesThreshold: { type: sharesThresholdType, value: parseNum(sharesValue, true) },
        depositsAlertRange: { min: parseNum(depositsMin), max: parseNum(depositsMax) },
        redemptionsAlertRange: { min: parseNum(redemptionsMin), max: parseNum(redemptionsMax) },
        watchedAt: existing.watchedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    )
    onConfirm(claimLabel)
  }

  const ThresholdToggle = ({
    type,
    onChange,
  }: {
    type: 'percentage' | 'number'
    onChange: (t: 'percentage' | 'number') => void
  }) => (
    <div className="flex gap-1">
      <button
        onClick={() => onChange('percentage')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          type === 'percentage'
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        %
      </button>
      <button
        onClick={() => onChange('number')}
        className={`px-3 py-1 text-xs rounded transition-colors ${
          type === 'number'
            ? 'bg-cyan-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        #
      </button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'edit' ? 'Edit Preferences — ' : 'Watch — '}
            <span className="text-cyan-400">{claimLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Market Cap Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Market Cap Change</Label>
              <ThresholdToggle type={marketCapThresholdType} onChange={setMarketCapThresholdType} />
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step={marketCapThresholdType === 'percentage' ? '0.5' : '1'}
                value={marketCapValue}
                onChange={(e) => setMarketCapValue(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {marketCapThresholdType === 'percentage' ? '% change' : 'TRUST change'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Alert when market cap changes by more than {marketCapValue || '0'}
              {marketCapThresholdType === 'percentage' ? '%' : ' TRUST'}
            </p>
          </div>

          {/* Position Count Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Position Count Change</Label>
              <ThresholdToggle type={positionThresholdType} onChange={setPositionThresholdType} />
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step="1"
                value={positionValue}
                onChange={(e) => setPositionValue(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {positionThresholdType === 'percentage' ? '% change' : 'new positions'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Alert when position count changes by more than {positionValue || '0'}
              {positionThresholdType === 'percentage' ? '%' : ' positions'}
            </p>
          </div>

          {/* Total Shares Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Total Shares Change</Label>
              <ThresholdToggle type={sharesThresholdType} onChange={setSharesThresholdType} />
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step={sharesThresholdType === 'percentage' ? '0.5' : '1'}
                value={sharesValue}
                onChange={(e) => setSharesValue(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {sharesThresholdType === 'percentage' ? '% change' : 'shares change'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Alert when shares change by more than {sharesValue || '0'}
              {sharesThresholdType === 'percentage' ? '%' : ' shares'}
            </p>
          </div>

          {/* Deposits Range */}
          <div className="space-y-2 border-t border-slate-700 pt-4">
            <Label className="text-slate-200">Deposits Alert Range (TRUST)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-8 flex-shrink-0">Min</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={depositsMin}
                  onChange={(e) => setDepositsMin(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-8 flex-shrink-0">Max</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={depositsMax}
                  onChange={(e) => setDepositsMax(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          {/* Redemptions Range */}
          <div className="space-y-2">
            <Label className="text-slate-200">Redemptions Alert Range (TRUST)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-8 flex-shrink-0">Min</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={redemptionsMin}
                  onChange={(e) => setRedemptionsMin(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-8 flex-shrink-0">Max</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={redemptionsMax}
                  onChange={(e) => setRedemptionsMax(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          {/* Push Notifications */}
          {isSupported && (
            <div className="bg-cyan-900/30 rounded-lg p-4 border border-cyan-700/50">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-cyan-300 mb-1">Push Notifications</p>
                  <p className="text-sm text-cyan-200/80 mb-3">
                    Receive instant device alerts when thresholds are exceeded for this claim.
                  </p>
                  {!isSubscribed && !pushPermissionRequested ? (
                    <Button
                      onClick={handleEnablePushNotifications}
                      disabled={pushLoading}
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
                    >
                      <Bell className="w-4 h-4" />
                      {pushLoading ? 'Enabling…' : 'Enable Push Notifications'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-cyan-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">Push notifications enabled</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

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
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
          >
            {mode === 'edit' ? 'Save Changes' : 'Save & Watch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
