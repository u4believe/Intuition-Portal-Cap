"use client"

import { useRef } from "react"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Flame, TrendingUp, LogIn, LogOut } from "lucide-react"
import { getEventIcon } from "@/utils/eventIcons" // Assuming this is where getEventIcon is declared

interface Event {
  type: "deposit" | "redemption"
  tripleName: string
  senderId?: string
  receiverId?: string
  timestamp: string
}

export default function RecentEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch("/api/recent-events")
        const data = await response.json()
        const sortedEvents = (data.events || []).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        setEvents(sortedEvents)
      } catch (error) {
        console.error("[v0] Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
    const interval = setInterval(fetchEvents, 10000)
    return () => clearInterval(interval)
  }, [])

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
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "deposit":
        return "bg-green-500/20 text-green-300"
      case "redemption":
        return "bg-red-500/20 text-red-300"
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
      <div className="h-[320px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 animate-pulse" />
    )
  }

  return (
    <div className="relative h-[320px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10"></div>

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Live Events</h3>
          <Badge variant="secondary" className="ml-auto bg-cyan-500/20 text-cyan-300 text-xs">
            Real-time
          </Badge>
        </div>

        {/* Fixed Height Events Container with Auto-Scroll - Pausable on Hover */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto mt-3 group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div ref={contentRef} className="space-y-2">
            {events.map((event, index) => (
              <div
                key={`${event.tripleName}-${event.timestamp}-${index}`}
                className="p-2 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-cyan-500/30 hover:bg-slate-900/70 transition-all duration-300"
              >
                {/* Compact Event Layout */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-white truncate">{event.tripleName}</p>
                      <Badge className={`text-xs whitespace-nowrap h-5 ${getEventColor(event.type)}`}>
                        {getEventLabel(event.type)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="truncate">
                        {event.type === "deposit"
                          ? `Sent by ${event.senderId?.slice(0, 6)}...${event.senderId?.slice(-4)}`
                          : `Received by ${event.receiverId?.slice(0, 6)}...${event.receiverId?.slice(-4)}`}
                      </span>
                      <span>{formatTime(event.timestamp)}</span>
                    </div>
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
