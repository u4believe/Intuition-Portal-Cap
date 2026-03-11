'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { X, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PushNotificationBanner() {
  const { isSupported, permission, subscribe, isLoading } = usePushNotifications()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Show banner only if push is supported and user hasn't granted permission yet
    setShown(isSupported && permission !== 'granted')
  }, [isSupported, permission])

  if (!shown || !isSupported) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg shadow-lg p-4 border border-cyan-500 z-40 animate-in slide-in-from-bottom-4 duration-300">
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
            {isLoading ? 'Enabling...' : 'Enable Now'}
          </Button>
        </div>
        <button
          onClick={() => setShown(false)}
          className="flex-shrink-0 text-cyan-200 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
