'use client'

import { useRecentEvents } from '@/hooks/useIntuitionData'
import { ArrowUpRight, ArrowDownLeft, Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const formatEventTime = (dateString: string | null | undefined) => {
  if (!dateString) return 'Recently'
  
  try {
    // Try parsing ISO format first (e.g., "2024-01-24T15:30:45Z")
    let timestamp = dateString
    
    // If it's a Unix timestamp (number as string), convert it
    if (/^\d+$/.test(dateString)) {
      const numTimestamp = parseInt(dateString, 10)
      // Check if it's in seconds or milliseconds
      if (numTimestamp < 10000000000) {
        timestamp = new Date(numTimestamp * 1000).toISOString()
      } else {
        timestamp = new Date(numTimestamp).toISOString()
      }
    }
    
    const date = new Date(timestamp)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.log('[v0] Invalid date parsed:', dateString)
      return 'Recently'
    }
    
    // Format time
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  } catch (error) {
    console.log('[v0] Error parsing date:', dateString, error)
    return 'Recently'
  }
}

export default function LiveEvents() {
  const { data: events = [], isLoading, error } = useRecentEvents()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  console.log('[v0] Live Events data:', events)
  console.log('[v0] Live Events error:', error)

  const mobileEvents = events.slice(0, 100) // Show last 100 events for mobile
  const desktopEvents = events.slice(0, 10) // Show only the 10 most recent for desktop

  // Auto-scroll animation for mobile
  useEffect(() => {
    if (!scrollContainerRef.current || isPaused || isLoading || mobileEvents.length === 0) return

    const scrollContainer = scrollContainerRef.current
    const autoScroll = () => {
      if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth - scrollContainer.clientWidth - 10) {
        // Reset to beginning for continuous loop
        scrollContainer.scrollLeft = 0
      } else {
        scrollContainer.scrollLeft += 1
      }
    }

    const interval = setInterval(autoScroll, 30) // Smooth scrolling

    return () => clearInterval(interval)
  }, [isPaused, isLoading, mobileEvents.length])

  return (
    <div className="w-full py-2 md:py-4 px-4 md:px-0">
      <div className="space-y-2 md:space-y-4">
        <h2 className="text-base md:text-2xl font-bold text-slate-900 dark:text-white">Live Events</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 text-teal-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">Error loading events</p>
          </div>
        ) : desktopEvents.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 text-sm">No events yet</p>
          </div>
        ) : (
          <>
            {/* Desktop: Vertical scrollable list */}
            <div className="hidden md:block space-y-2 max-h-96 overflow-y-auto">
              {desktopEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {/* Event Icon */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      event.type === 'deposit'
                        ? 'bg-teal-100 dark:bg-teal-900/30'
                        : 'bg-orange-100 dark:bg-orange-900/30'
                    }`}
                  >
                    {event.type === 'deposit' ? (
                      <ArrowDownLeft className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {event.type === 'deposit' ? 'Deposit' : 'Redemption'}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">in {event.atomLabel}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        {event.type === 'deposit'
                          ? `From: ${event.senderId?.slice(0, 8)}...${event.senderId?.slice(-6) || 'Unknown'}`
                          : `To: ${event.receiverId?.slice(0, 8)}...${event.receiverId?.slice(-6) || 'Unknown'}`}
                      </span>
                      <span>{formatEventTime(event.createdAt)}</span>
                    </div>
                  </div>

                  {/* Assets Amount */}
                  <div className="flex-shrink-0 text-right">
                    <p
                      className={`font-semibold text-sm ${
                        event.type === 'deposit'
                          ? 'text-teal-600 dark:text-teal-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {event.assets.toLocaleString('en-US', { maximumFractionDigits: 2 })} TRUST
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile: Auto-scrolling carousel with reduced height */}
            <div 
              className="md:hidden overflow-hidden"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              <div 
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide"
                style={{ scrollBehavior: 'auto' }}
              >
                {mobileEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex-shrink-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    {/* Event Header */}
                    <div className="flex items-start gap-2 mb-2">
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          event.type === 'deposit'
                            ? 'bg-teal-100 dark:bg-teal-900/30'
                            : 'bg-orange-100 dark:bg-orange-900/30'
                        }`}
                      >
                        {event.type === 'deposit' ? (
                          <ArrowDownLeft className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white text-xs">
                          {event.type === 'deposit' ? 'Deposit' : 'Redemption'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          {event.atomLabel}
                        </p>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="space-y-1 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {event.type === 'deposit'
                          ? `From: ${event.senderId?.slice(0, 6)}...`
                          : `To: ${event.receiverId?.slice(0, 6)}...`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        {formatEventTime(event.createdAt)}
                      </p>
                    </div>

                    {/* Assets Amount */}
                    <p
                      className={`font-bold text-xs ${
                        event.type === 'deposit'
                          ? 'text-teal-600 dark:text-teal-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {event.assets.toLocaleString('en-US', { maximumFractionDigits: 1 })} TRUST
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
