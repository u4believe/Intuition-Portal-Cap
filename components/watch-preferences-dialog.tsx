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

const ALERT_TYPES: { key: keyof Omit<ClaimAlertPref, 'label'>; label: string; desc: string; Icon: React.ElementType }[] = [
  { key: 'deposits', label: 'Deposits', desc: 'Notify when TRUST is deposited into this vault', Icon: ArrowUpRight },
  { key: 'redemptions', label: 'Redemptions', desc: 'Notify when TRUST is redeemed from this vault', Icon: ArrowDownLeft },
  { key: 'marketCap', label: 'Market Cap Change', desc: 'Notify on significant market cap changes (2%+)', Icon: TrendingUp },
  { key: 'positionCount', label: 'Position Count Change', desc: 'Notify when position count changes', Icon: Users },
  { key: 'sharesChange', label: 'Shares Change', desc: 'Notify on significant share movements (2%+)', Icon: BarChart2 },
]

const DEFAULT_PREFS = { deposits: true, redemptions: true, marketCap: true, positionCount: true, sharesChange: true }

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
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPrefs({ ...DEFAULT_PREFS, ...initialPrefs })
  }, [open, claimLabel, initialPrefs])

  const toggle = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      if (termId) {
        await upsertClaimAlertPref(termId, { label: claimLabel, ...prefs })
      }
      onConfirm(claimLabel, termId)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const anySelected = Object.values(prefs).some(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">
            {mode === 'edit' ? 'Edit Alert Preferences' : 'Watch Claim'}
          </DialogTitle>
          <p className="text-sm text-cyan-400 font-medium truncate leading-tight">{claimLabel}</p>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <p className="text-xs text-slate-400 pb-1">Choose which events trigger a push notification:</p>
          {ALERT_TYPES.map(({ key, label, desc, Icon }) => (
            <label
              key={key}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer hover:border-slate-600 transition-colors select-none"
              onClick={() => toggle(key)}
            >
              <Checkbox
                checked={prefs[key]}
                onCheckedChange={() => toggle(key)}
                className="mt-0.5 border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
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
