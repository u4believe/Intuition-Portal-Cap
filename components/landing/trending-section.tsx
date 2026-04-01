"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, Rocket, Flame, ArrowUpRight, Star } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import WatchPreferencesDialog from "@/components/watch-preferences-dialog"

const ONE_HOUR_MS = 60 * 60 * 1000

export default function TrendingSection() {
  const [trendingAtom, setTrendingAtom] = useState<any>(null)
  const [trendingTriple, setTrendingTriple] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Watch dialog state
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [watchItemName, setWatchItemName] = useState("")
  const [watchItemTermId, setWatchItemTermId] = useState("")

  const { syncWatchedClaimsToServer } = usePushNotifications()

  const loadTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/trending')
      if (!res.ok) throw new Error(`Trending API returned ${res.status}`)
      const { atom, triple } = await res.json()
      setTrendingAtom(atom)
      setTrendingTriple(triple)
    } catch (e) {
      console.error("Failed to load trending data:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrending()

    // Refresh once per hour so the UI stays current without a full page reload
    const interval = setInterval(loadTrending, ONE_HOUR_MS)
    return () => clearInterval(interval)
  }, [loadTrending])

  const handleWatch = (label: string, termId: string) => {
    setWatchItemName(label)
    setWatchItemTermId(termId)
    setWatchDialogOpen(true)
  }

  const handleWatchConfirm = () => {
    setWatchDialogOpen(false)
    setTimeout(() => syncWatchedClaimsToServer(), 200)
  }

  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6 w-full">
          <div className="h-[180px] w-full rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border border-slate-200 dark:border-slate-800" />
          <div className="h-[180px] w-full rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse border border-slate-200 dark:border-slate-800" />
        </div>
      </section>
    )
  }

  // Graceful fallback if completely empty
  if (!trendingAtom && !trendingTriple) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-8 w-full z-10 relative">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary dark:text-cyan-400" />
          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400">Not enough market data to establish trending claims right now. Please check back later!</p>
        </div>
      </section>
    )
  }

  const formatLabel = (v: any) => {
    if (v.term?.atom) return v.term.atom.label
    if (v.term?.triple) {
      const subject = v.term.triple.subject?.label
      const predicate = v.term.triple.predicate?.label
      const object = v.term.triple.object?.label
      return `${subject} ${predicate} ${object}`
    }
    return "Unknown"
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 w-full z-10 relative">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary dark:text-cyan-400" />
        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full">
        {/* Trending Identity */}
        {trendingAtom && (
          <div className="relative group h-full">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-amber-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
            <Card className="relative h-full flex flex-col justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden rounded-xl">
              <div className="absolute top-0 right-0 p-2 opacity-10 dark:opacity-5 pointer-events-none">
                <Flame className="w-16 h-16 md:w-20 md:h-20" />
              </div>
              <div className="flex items-center justify-between p-3 md:p-4 relative w-full">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="uppercase tracking-wider font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-1.5 text-[10px] md:text-xs mb-0.5">
                    <Flame className="w-3 h-3" /> Identity on Fire
                  </div>
                  <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white line-clamp-2 tracking-tight leading-tight" title={formatLabel(trendingAtom)}>
                    {formatLabel(trendingAtom)}
                  </h4>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className={`flex items-center gap-1 text-lg md:text-xl font-black leading-none ${
                    trendingAtom.pctChange < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-green-500 dark:text-green-400'
                  }`}>
                    <ArrowUpRight className={`w-4 h-4 md:w-5 md:h-5 stroke-[3] ${trendingAtom.pctChange < 0 ? 'rotate-90' : ''}`} />
                    {new Intl.NumberFormat('en-US', {
                      notation: Math.abs(trendingAtom.pctChange) > 1000 ? "compact" : "standard",
                      maximumFractionDigits: 1
                    }).format(trendingAtom.pctChange)}%
                  </div>
                  <button
                    onClick={() => handleWatch(formatLabel(trendingAtom), trendingAtom.term_id)}
                    className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-800/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded text-[10px] md:text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Star className="w-3 h-3" /> Watch
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Trending Claim */}
        {trendingTriple && (
          <div className="relative group h-full">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
            <Card className="relative h-full flex flex-col justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden rounded-xl">
              <div className="absolute top-0 right-0 p-2 opacity-10 dark:opacity-5 pointer-events-none">
                <Rocket className="w-16 h-16 md:w-20 md:h-20" />
              </div>
              <div className="flex items-center justify-between p-3 md:p-4 relative w-full">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="uppercase tracking-wider font-semibold text-cyan-500 dark:text-cyan-400 flex items-center gap-1.5 text-[10px] md:text-xs mb-0.5">
                    <Rocket className="w-3 h-3" /> Viral Claim
                  </div>
                  <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white line-clamp-2 tracking-tight leading-tight" title={formatLabel(trendingTriple)}>
                    {formatLabel(trendingTriple)}
                  </h4>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <div className={`flex items-center gap-1 text-lg md:text-xl font-black leading-none ${
                    trendingTriple.pctChange < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-green-500 dark:text-green-400'
                  }`}>
                    <ArrowUpRight className={`w-4 h-4 md:w-5 md:h-5 stroke-[3] ${trendingTriple.pctChange < 0 ? 'rotate-90' : ''}`} />
                    {new Intl.NumberFormat('en-US', {
                      notation: Math.abs(trendingTriple.pctChange) > 1000 ? "compact" : "standard",
                      maximumFractionDigits: 1
                    }).format(trendingTriple.pctChange)}%
                  </div>
                  <button
                    onClick={() => handleWatch(formatLabel(trendingTriple), trendingTriple.term_id)}
                    className="flex items-center gap-1 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-800/50 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded text-[10px] md:text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Star className="w-3 h-3" /> Watch
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        claimLabel={watchItemName}
        termId={watchItemTermId}
        onConfirm={handleWatchConfirm}
        mode="add"
      />
    </section>
  )
}
