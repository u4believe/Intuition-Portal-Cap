"use client"

import { useRef } from "react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Flame } from "lucide-react"
import { useRecentEvents } from "@/hooks/useIntuitionData"

export default function RecentEvents() {
  const { data: events = [], isLoading: loading } = useRecentEvents()
  const [isHovered, setIsHovered] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isHovered && scrollContainerRef.current && contentRef.current) {
      const container = scrollContainerRef.current
      const content = contentRef.current

      // Auto-scroll logic
      const scrollSpeed = 1 // pixels per interval
      const scrollInterval = setInterval(() => {
        if (isHovered) return

        container.scrollTop += scrollSpeed
        // When reaching near the bottom, reset to top for infinite loop
        if (container.scrollTop >= content.scrollHeight - container.clientHeight - 10) {
          container.scrollTop = 0
        }
      }, 50)

      return () => clearInterval(scrollInterval)
    }
  }, [isHovered, events])

  const formatTime = (timestamp: string) => {
    try {
      // Handle ISO format timestamps
      const date = new Date(timestamp)
      
      if (isNaN(date.getTime())) {
        return "Recently"
      }
      
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return "just now"
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return date.toLocaleDateString()
    } catch {
      return "Recently"
    }
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "deposit":
        return "bg-teal-500/20 text-teal-300"
      case "redemption":
        return "bg-orange-500/20 text-orange-300"
      default:
        return "bg-blue-500/20 text-blue-300"
    }
  }

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "deposit":
        return "Deposit"
      case "redemption":
        return "Redemption"
      default:
        return "Update"
    }
  }

  if (loading) {
    return (
      <div className="h-[320px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-6 animate-pulse" />
    )
  }

  return (
    <div className="relative h-[320px] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10"></div>

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-300 dark:border-slate-700">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-black dark:text-white">Live Events</h3>
          <Badge variant="secondary" className="ml-auto bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-xs">
            Real-time
          </Badge>
        </div>

        {/* Fixed Height Events Container with Auto-Scroll - Pausable on Hover */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto mt-3 group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div ref={contentRef} className="space-y-2">
              {events.map((event, index) => (
                <div key={`${event.id}-${index}`} className="p-2 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-cyan-500/30 dark:hover:border-cyan-500/30 hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-all duration-300">
                {/* Compact Event Layout */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-white truncate">{event.atomLabel}</p>
                      <Badge className={`text-xs whitespace-nowrap h-5 ${getEventColor(event.type)}`}>
                        {getEventLabel(event.type)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-xs text-slate-400">
                      <span className="truncate">
                        {event.type === "deposit"
                          ? `From ${event.senderId?.slice(0, 6)}...${event.senderId?.slice(-4)}`
                          : `To ${event.receiverId?.slice(0, 6)}...${event.receiverId?.slice(-4)}`}
                      </span>
                      <span className="whitespace-nowrap">{formatTime(event.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-xs font-semibold ${event.type === 'deposit' ? 'text-teal-300' : 'text-orange-300'}`}>
                      {event.assets ? event.assets.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'} TRUST
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {events.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">No recent events</div>
        )}
      </div>
    </div>
  )
}
