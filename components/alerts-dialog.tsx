'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Bell, TrendingDown, TrendingUp, CheckCircle2, AlertCircle,
  Info, Loader2, Send, RefreshCw, Share, Smartphone, ExternalLink,
} from 'lucide-react'
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

function useIOSDetection() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsIOS(ios)
    setIsStandalone(standalone)
  }, [])
  return { isIOS, isStandalone }
}

function useIsInIframe() {
  const [inIframe, setInIframe] = useState(false)
  useEffect(() => {
    try { setInIframe(window.self !== window.top) } catch { setInIframe(true) }
  }, [])
  return inIframe
}

function RangeSection({
  title, icon, color, enabled, onToggle, min, onMinChange, max, onMaxChange,
}: {
  title: string; icon: React.ReactNode; color: string
  enabled: boolean; onToggle: () => void
  min: string; onMinChange: (v: string) => void
  max: string; onMaxChange: (v: string) => void
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
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-3 mt-2">
          <p className="text-xs text-slate-400">Alert when a {title.toLowerCase()} TRUST amount falls within this range</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Min TRUST</Label>
              <Input type="number" min="0" step="10" value={min} onChange={e => onMinChange(e.target.value)} placeholder="0"
                className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Max TRUST</Label>
              <Input type="number" min="0" step="10" value={max} onChange={e => onMaxChange(e.target.value)} placeholder="10000"
                className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Notify me when {title.toLowerCase()} is between {min || '0'} – {max || '10,000'} TRUST
          </p>
        </div>
      )}
    </div>
  )
}

interface AlertsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const userId = useCurrentUserId()
  const {
    isSupported, isSubscribed, isServerSubscribed, permission,
    isLoading: pushLoading, subscribeError,
    subscribe, sendServerTest, refreshServerStatus, resyncToServer,
  } = usePushNotifications()
  const { isIOS, isStandalone } = useIOSDetection()
  const inIframe = useIsInIframe()

  const [saved, setSaved] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  const [depositsEnabled, setDepositsEnabled] = useState(false)
  const [depositsMin, setDepositsMin] = useState('0')
  const [depositsMax, setDepositsMax] = useState('10000')
  const [redemptionsEnabled, setRedemptionsEnabled] = useState(false)
  const [redemptionsMin, setRedemptionsMin] = useState('0')
  const [redemptionsMax, setRedemptionsMax] = useState('10000')

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
    setTestState('idle')
    setTestMessage('')
    setShowIOSSteps(false)
    // Refresh server subscription status when dialog opens
    refreshServerStatus()
  }, [open, refreshServerStatus])

  const handleSave = async () => {
    const ranges: AlertRanges = {
      deposits: { enabled: depositsEnabled, min: depositsMin, max: depositsMax },
      redemptions: { enabled: redemptionsEnabled, min: redemptionsMin, max: redemptionsMax },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges))

    if (userId) {
      // If browser has push sub but server lost it, re-save the subscription row first
      // so the subsequent alert_ranges UPDATE actually has a row to modify.
      if (isSubscribed && !isServerSubscribed) {
        await resyncToServer()
      }
      await syncAlertRangesToServer(userId, ranges)
    }
    setSaved(true)
    setTimeout(() => onOpenChange(false), 800)
  }

  const handleSendTest = async () => {
    setTestState('sending')
    setTestMessage('')
    const result = await sendServerTest()
    setTestState(result.ok ? 'ok' : 'fail')
    setTestMessage(result.message)
  }

  const anyEnabled = depositsEnabled || redemptionsEnabled

  // Determine push status
  const needsIOSInstall = isIOS && !isStandalone && !isSupported
  const isFullyActive = isSubscribed && isServerSubscribed
  const browserHasSubButServerDoesnt = isSubscribed && !isServerSubscribed
  const permissionDenied = permission === 'denied' && !isSubscribed

  // Status badge
  const renderPushStatus = () => {
    if (isFullyActive) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> This device
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Server
            </span>
            <span className="text-slate-400">— Active</span>
          </div>
          <p className="text-xs text-slate-500">Alerts go to this browser only. Enable on each device separately.</p>
        </div>
      )
    }
    if (browserHasSubButServerDoesnt) {
      return (
        <div className="flex items-center gap-2 text-xs text-yellow-400">
          <AlertCircle className="w-3.5 h-3.5" />
          Browser subscribed but server lost sync — click Enable to re-save
        </div>
      )
    }
    if (permissionDenied) {
      return (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          Notifications blocked. Go to your browser settings and allow notifications for this site.
        </div>
      )
    }
    if (needsIOSInstall) {
      return (
        <div className="flex items-center gap-2 text-xs text-cyan-300">
          <Smartphone className="w-3.5 h-3.5" />
          iOS requires adding to Home Screen first
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <AlertCircle className="w-3.5 h-3.5" />
        Push not enabled — alerts won't be delivered
      </div>
    )
  }

  const renderEnableSection = () => {
    // Already working — show test button
    if (isFullyActive) {
      return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-300 font-medium">Push notifications active</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendTest}
              disabled={testState === 'sending'}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs h-7 gap-1"
            >
              {testState === 'sending'
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
                : <><Send className="w-3 h-3" /> Send Test</>}
            </Button>
          </div>
          {testMessage && (
            <p className={`text-xs mt-2 ${testState === 'ok' ? 'text-green-300' : 'text-red-300'}`}>
              {testMessage}
            </p>
          )}
        </div>
      )
    }

    // iOS not installed as PWA
    if (needsIOSInstall) {
      return (
        <div className="bg-cyan-900/30 border border-cyan-700/40 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-cyan-300 font-medium mb-1">iOS requires Home Screen installation</p>
              {!showIOSSteps ? (
                <Button size="sm" onClick={() => setShowIOSSteps(true)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7">
                  Show steps
                </Button>
              ) : (
                <ol className="text-xs text-cyan-200 space-y-1 list-none mt-2">
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    Tap <Share className="w-3.5 h-3.5 inline mx-0.5" /> Share in Safari
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    Tap <strong>Add to Home Screen</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    Open Portal Cap from your Home Screen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    Return here and tap Enable
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>
      )
    }

    // Permission blocked by OS
    if (permissionDenied) {
      return (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-300 font-medium">Notifications blocked by browser</p>
            <p className="text-xs text-red-200 mt-1">
              Go to your browser or OS settings and allow notifications for this site, then reload the page.
            </p>
          </div>
        </div>
      )
    }

    // Browser subscribed but server lost the record — show a Fix button
    if (browserHasSubButServerDoesnt) {
      return (
        <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-yellow-300 font-medium mb-1">Register this account for alerts</p>
              <p className="text-xs text-yellow-200 mb-2">
                Push is enabled in this browser but not yet registered for your current account. Tap the button below to enable alerts for this account on this device.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  const currentRanges: AlertRanges = {
                    deposits: { enabled: depositsEnabled, min: depositsMin, max: depositsMax },
                    redemptions: { enabled: redemptionsEnabled, min: redemptionsMin, max: redemptionsMax },
                  }
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRanges))
                  console.log('[Alerts] Registering push for userId:', userId)
                  subscribe()
                }}
                disabled={pushLoading}
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs h-7"
              >
                {pushLoading
                  ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Registering…</>
                  : <><Bell className="w-3 h-3 mr-1" />Enable Alerts for This Account</>}
              </Button>
              {subscribeError && (
                <p className="text-xs text-red-300 mt-2">{subscribeError}</p>
              )}
            </div>
          </div>
        </div>
      )
    }

    // Iframe context — browser blocks Notification.requestPermission() in iframes
    if (inIframe) {
      return (
        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <ExternalLink className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-cyan-300 font-medium mb-1">Open directly to enable notifications</p>
              <p className="text-xs text-slate-400 mb-2">
                Your browser blocks notification permissions in embedded previews. Open the app in its own tab to enable push alerts.
              </p>
              <Button
                size="sm"
                onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Open in New Tab
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Standard enable button (Android / desktop / iOS PWA)
    return (
      <div className="bg-cyan-900/30 border border-cyan-700/40 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-cyan-300 mb-2">
              Enable push notifications to receive alerts on your device even when the app is closed.
            </p>
            <Button
              size="sm"
              onClick={() => {
                const currentRanges: AlertRanges = {
                  deposits: { enabled: depositsEnabled, min: depositsMin, max: depositsMax },
                  redemptions: { enabled: redemptionsEnabled, min: redemptionsMin, max: redemptionsMax },
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentRanges))
                subscribe()
              }}
              disabled={pushLoading}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7"
            >
              {pushLoading
                ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Enabling…</>
                : <><Bell className="w-3 h-3 mr-1" />Enable Push Notifications</>}
            </Button>
            {subscribeError && (
              <p className="text-xs text-red-300 mt-2">{subscribeError}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            Alerts
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-1">
            Get push notifications when a deposit or redemption matches your TRUST range.
          </p>
          {userId && (
            <p className="text-xs text-slate-600 mt-0.5">
              Account: <span className="text-slate-500 font-mono">
                {userId.startsWith('discord:') ? `Discord ${userId.slice(8, 14)}…` : `${userId.slice(0, 6)}…${userId.slice(-4)}`}
              </span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Push notification status row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Push Status</span>
            {renderPushStatus()}
          </div>

          {/* Enable / fix push section */}
          {renderEnableSection()}

          {/* Range settings */}
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

          {anyEnabled && !isServerSubscribed && (
            <p className="text-xs text-slate-500 px-1">
              ⚠ Enable push notifications above so your alert ranges can be saved to the server.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800">
            Cancel
          </Button>
          <Button onClick={handleSave}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700">
            {saved
              ? <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Saved</span>
              : 'Save Alerts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
