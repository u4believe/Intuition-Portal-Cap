"use client"

import { useEffect, useState, useCallback } from "react"
import { TrendingUp, Flame, Zap } from "lucide-react"

interface TrendingItem {
  term_id: string
  type: "atom" | "triple"
  label: string
  maxSingleDeposit: number
  txCount: number
  score: number
}

const ONE_HOUR_MS = 60 * 60 * 1000

export default function TrendingSection() {
  const [items, setItems] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadTrending = useCallback(async () => {
    try {
      const res = await fetch("/api/trending")
      if (!res.ok) throw new Error(`Trending API returned ${res.status}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      console.error("Failed to load trending data:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrending()
    const interval = setInterval(loadTrending, ONE_HOUR_MS)
    return () => clearInterval(interval)
  }, [loadTrending])

  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
              style={{ width: `${80 + (i % 3) * 40}px` }}
            />
          ))}
        </div>
      </section>
    )
  }

  if (!items.length) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No significant activity in the last 24 hours. Check back soon.
        </p>
      </section>
    )
  }

  const claims = items.filter(i => i.type === "triple")
  const identities = items.filter(i => i.type === "atom")

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          · {items.length} active {items.length === 1 ? "term" : "terms"}
        </span>
      </div>

      {/* Chip rows */}
      <div className="space-y-2.5">
        {/* Claims row */}
        {claims.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-orange-500 dark:text-orange-400 shrink-0 w-16">
              <Flame className="w-3 h-3" /> Claims
            </span>
            {claims.map(item => (
              <div
                key={item.term_id}
                title={item.label}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border
                  bg-orange-50 dark:bg-orange-950/30
                  border-orange-300 dark:border-orange-700/50
                  text-orange-800 dark:text-orange-200
                  shadow-[0_0_10px_rgba(251,146,60,0.2)] dark:shadow-[0_0_10px_rgba(251,146,60,0.15)]
                  hover:shadow-[0_0_14px_rgba(251,146,60,0.4)] dark:hover:shadow-[0_0_14px_rgba(251,146,60,0.3)]
                  transition-shadow cursor-default select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 flex-shrink-0" />
                <span className="truncate max-w-[220px]">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Identities row */}
        {identities.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 shrink-0 w-16">
              <Zap className="w-3 h-3" /> IDs
            </span>
            {identities.map(item => (
              <div
                key={item.term_id}
                title={item.label}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border
                  bg-emerald-50 dark:bg-emerald-950/30
                  border-emerald-300 dark:border-emerald-700/50
                  text-emerald-800 dark:text-emerald-200
                  shadow-[0_0_10px_rgba(52,211,153,0.2)] dark:shadow-[0_0_10px_rgba(52,211,153,0.15)]
                  hover:shadow-[0_0_14px_rgba(52,211,153,0.4)] dark:hover:shadow-[0_0_14px_rgba(52,211,153,0.3)]
                  transition-shadow cursor-default select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 flex-shrink-0" />
                <span className="truncate max-w-[220px]">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
