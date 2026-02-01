'use client'

import { useRecentEvents } from '@/hooks/useIntuitionData'
import { ArrowUpRight, ArrowDownLeft, Loader } from 'lucide-react'

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

  console.log('[v0] Live Events data:', events)
  console.log('[v0] Live Events error:', error)

  const recentEvents = events.slice(0, 10) // Show only the 10 most recent events

  return (
    <div className="w-full space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Live Events</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 text-teal-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600">Error loading events</p>
        </div>
      ) : recentEvents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-slate-600">No events yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {/* Event Icon */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  event.type === 'deposit'
                    ? 'bg-green-100'
                    : 'bg-orange-100'
                }`}
              >
                {event.type === 'deposit' ? (
                  <ArrowDownLeft className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-orange-600" />
                )}
              </div>

              {/* Event Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    style={{ 
                      color: event.type === 'deposit' ? '#16a34a' : '#ea580c',
                      fontWeight: '600'
                    }}
                  >
                    {event.type === 'deposit' ? 'Deposit' : 'Redemption'}
                  </span>
                  <span className="text-sm text-slate-600">in {event.atomLabel}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
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
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}
                >
                  {event.assets.toLocaleString('en-US', { maximumFractionDigits: 2 })} TRUST
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
