'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface WatchPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claimLabel: string
  onConfirm: (claimLabel: string) => void
}

export default function WatchPreferencesDialog({
  open,
  onOpenChange,
  claimLabel,
  onConfirm,
}: WatchPreferencesDialogProps) {
  // Market Cap Threshold
  const [marketCapThresholdType, setMarketCapThresholdType] = useState<'percentage' | 'number'>('percentage')
  const [marketCapThresholdValue, setMarketCapThresholdValue] = useState<number>(5)

  // Position Count Threshold
  const [positionThresholdType, setPositionThresholdType] = useState<'percentage' | 'number'>('number')
  const [positionThresholdValue, setPositionThresholdValue] = useState<number>(10)

  // Total Shares Change Threshold
  const [sharesThresholdType, setSharesThresholdType] = useState<'percentage' | 'number'>('percentage')
  const [sharesThresholdValue, setSharesThresholdValue] = useState<number>(5)

  // Deposits Alert Range
  const [depositsMinRange, setDepositsMinRange] = useState<number>(0)
  const [depositsMaxRange, setDepositsMaxRange] = useState<number>(10000)

  // Redemptions Alert Range
  const [redemptionsMinRange, setRedemptionsMinRange] = useState<number>(0)
  const [redemptionsMaxRange, setRedemptionsMaxRange] = useState<number>(10000)

  const handleConfirm = () => {
    // Store thresholds in localStorage for this claim
    const preferences = JSON.parse(localStorage.getItem(`portal_cap_watch_${claimLabel}`) || '{}')
    localStorage.setItem(
      `portal_cap_watch_${claimLabel}`,
      JSON.stringify({
        ...preferences,
        marketCapThreshold: {
          type: marketCapThresholdType,
          value: marketCapThresholdValue,
        },
        positionThreshold: {
          type: positionThresholdType,
          value: positionThresholdValue,
        },
        sharesThreshold: {
          type: sharesThresholdType,
          value: sharesThresholdValue,
        },
        depositsAlertRange: {
          min: depositsMinRange,
          max: depositsMaxRange,
        },
        redemptionsAlertRange: {
          min: redemptionsMinRange,
          max: redemptionsMaxRange,
        },
        watchedAt: new Date().toISOString(),
      })
    )
    onConfirm(claimLabel)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Watch Preferences - {claimLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Market Cap Change Alert Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Market Cap Change Alert Threshold</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMarketCapThresholdType('percentage')}
                  className={`px-3 py-1 text-xs rounded ${
                    marketCapThresholdType === 'percentage'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setMarketCapThresholdType('number')}
                  className={`px-3 py-1 text-xs rounded ${
                    marketCapThresholdType === 'number'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  #
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step={marketCapThresholdType === 'percentage' ? '0.5' : '1'}
                value={marketCapThresholdValue}
                onChange={(e) => setMarketCapThresholdValue(parseFloat(e.target.value) || 0)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {marketCapThresholdType === 'percentage' ? '% change' : 'TRUST change'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Get alerts when market cap changes by more than {marketCapThresholdValue}
              {marketCapThresholdType === 'percentage' ? '%' : ' TRUST'}
            </p>
          </div>

          {/* Position Count Change Alert Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Position Count Change Alert Threshold</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPositionThresholdType('percentage')}
                  className={`px-3 py-1 text-xs rounded ${
                    positionThresholdType === 'percentage'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setPositionThresholdType('number')}
                  className={`px-3 py-1 text-xs rounded ${
                    positionThresholdType === 'number'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  #
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step="1"
                value={positionThresholdValue}
                onChange={(e) => setPositionThresholdValue(parseInt(e.target.value) || 0)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {positionThresholdType === 'percentage' ? '% change' : 'new positions'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Get alerts when position count changes by more than {positionThresholdValue}
              {positionThresholdType === 'percentage' ? '%' : ' positions'}
            </p>
          </div>

          {/* Total Shares Change Alert Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-slate-200">Total Shares Change Alert Threshold</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSharesThresholdType('percentage')}
                  className={`px-3 py-1 text-xs rounded ${
                    sharesThresholdType === 'percentage'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setSharesThresholdType('number')}
                  className={`px-3 py-1 text-xs rounded ${
                    sharesThresholdType === 'number'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  #
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                step={sharesThresholdType === 'percentage' ? '0.5' : '1'}
                value={sharesThresholdValue}
                onChange={(e) => setSharesThresholdValue(parseFloat(e.target.value) || 0)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <span className="text-slate-400 text-sm whitespace-nowrap">
                {sharesThresholdType === 'percentage' ? '% change' : 'shares change'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Get alerts when total shares change by more than {sharesThresholdValue}
              {sharesThresholdType === 'percentage' ? '%' : ' shares'}
            </p>
          </div>

          {/* Deposits Initiated Alert */}
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <Label className="text-slate-200">Deposits Initiated Alert Range</Label>
            <p className="text-xs text-slate-400">
              Get alerted for deposits between {depositsMinRange.toLocaleString()} and {depositsMaxRange.toLocaleString()} TRUST
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-12">Min:</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={depositsMinRange}
                  onChange={(e) => setDepositsMinRange(Math.min(parseInt(e.target.value) || 0, depositsMaxRange))}
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                  placeholder="0"
                />
                <span className="text-xs text-slate-400">TRUST</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-12">Max:</span>
                <Input
                  type="number"
                  min={depositsMinRange}
                  step="100"
                  value={depositsMaxRange}
                  onChange={(e) => setDepositsMaxRange(Math.max(parseInt(e.target.value) || 0, depositsMinRange))}
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                  placeholder="10000"
                />
                <span className="text-xs text-slate-400">TRUST</span>
              </div>
            </div>
          </div>

          {/* Redemptions Initiated Alert */}
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <Label className="text-slate-200">Redemptions Initiated Alert Range</Label>
            <p className="text-xs text-slate-400">
              Get alerted for redemptions between {redemptionsMinRange.toLocaleString()} and {redemptionsMaxRange.toLocaleString()} TRUST
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-12">Min:</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={redemptionsMinRange}
                  onChange={(e) => setRedemptionsMinRange(Math.min(parseInt(e.target.value) || 0, redemptionsMaxRange))}
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                  placeholder="0"
                />
                <span className="text-xs text-slate-400">TRUST</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-12">Max:</span>
                <Input
                  type="number"
                  min={redemptionsMinRange}
                  step="100"
                  value={redemptionsMaxRange}
                  onChange={(e) => setRedemptionsMaxRange(Math.max(parseInt(e.target.value) || 0, redemptionsMinRange))}
                  className="bg-slate-800 border-slate-700 text-white flex-1"
                  placeholder="10000"
                />
                <span className="text-xs text-slate-400">TRUST</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <p className="text-sm text-slate-300">
              <span className="font-semibold">Note:</span> You'll receive signal alerts about {claimLabel} when these thresholds are exceeded. Make sure to set your email preferences in settings to receive email notifications.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-3">
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
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
