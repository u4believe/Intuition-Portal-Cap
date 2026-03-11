'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useAccount } from 'wagmi'
import { X, Bell, Share, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

function useIOSDetection() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsIOS(ios)
    setIsStandalone(standalone)
  }, [])

  return { isIOS, isStandalone }
}

export function PushNotificationBanner() {
  const { isSupported, permission, subscribe, isLoading } = usePushNotifications()
  const { isConnected } = useAccount()
  const { isIOS, isStandalone } = useIOSDetection()
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState<'prompt' | 'ios-instructions'>('prompt')

  const shouldShow =
    !dismissed &&
    isConnected &&
    permission !== 'granted' &&
    // On iOS: show if not yet in standalone (PWA) mode
    // On other platforms: show if push is supported
    (isIOS ? !isStandalone : isSupported)

  if (!shouldShow) return null

  // iOS — not yet added to home screen
  if (isIOS && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-cyan-700 to-cyan-600 text-white rounded-xl shadow-xl p-4 border border-cyan-400/40 z-40 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex gap-3 items-start">
          <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {step === 'prompt' ? (
              <>
                <p className="font-semibold text-sm mb-1">Get Push Notifications on iOS</p>
                <p className="text-xs text-cyan-100 mb-3">
                  Add Portal Cap to your Home Screen to receive claim alerts
                </p>
                <Button
                  onClick={() => setStep('ios-instructions')}
                  size="sm"
                  className="bg-white text-cyan-700 hover:bg-cyan-50 text-xs font-semibold"
                >
                  Show me how
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm mb-2">Add to Home Screen</p>
                <ol className="text-xs text-cyan-100 space-y-1.5 list-none">
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    Tap the <Share className="w-3.5 h-3.5 inline mx-0.5" /> Share button in Safari
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    Scroll down and tap <strong>Add to Home Screen</strong>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    Open Portal Cap from your Home Screen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-cyan-500/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    Tap <strong>Enable Now</strong> to allow notifications
                  </li>
                </ol>
              </>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 text-cyan-200 hover:text-white transition-colors -mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Standard push notification prompt (Android, desktop)
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-xl shadow-xl p-4 border border-cyan-500/40 z-40 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex gap-3 items-start">
        <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">Enable Push Notifications</p>
          <p className="text-xs text-cyan-100 mb-3">
            Get instant alerts on your device when your watched claims change
          </p>
          <Button
            onClick={() => subscribe()}
            disabled={isLoading}
            size="sm"
            className="bg-white text-cyan-700 hover:bg-cyan-50 text-xs font-semibold"
          >
            {isLoading ? 'Enabling…' : 'Enable Now'}
          </Button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-cyan-200 hover:text-white transition-colors -mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
