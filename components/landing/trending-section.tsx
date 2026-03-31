"use client"

import { useEffect, useState } from "react"
import { queryIntuitionGraphQL, ALL_CLAIMS_QUERY, convertWeiToEther } from "@/lib/intuition-graphql"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { TrendingUp, Rocket, Flame, ArrowUpRight, Star } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import WatchPreferencesDialog from "@/components/watch-preferences-dialog"

export default function TrendingSection() {
  const [trendingAtom, setTrendingAtom] = useState<any>(null)
  const [trendingTriple, setTrendingTriple] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Watch dialog state
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [watchItemName, setWatchItemName] = useState("")
  const [watchItemTermId, setWatchItemTermId] = useState("")

  const { syncWatchedClaimsToServer } = usePushNotifications()

  useEffect(() => {
    async function loadTrending() {
      try {
        const data = await queryIntuitionGraphQL(ALL_CLAIMS_QUERY, { limit: 200 })
        const vaults = data?.vaults || []

        let bestAtom: any = null
        let bestAtomPct = -Infinity

        let bestTriple: any = null
        let bestTriplePct = -Infinity

        for (const v of vaults) {
          const stats = v.share_price_change_stats_daily?.[0]
          if (!stats) continue

          const first = parseFloat(stats.first_share_price || "0")
          const last = parseFloat(stats.last_share_price || "0")
          if (first === 0) continue

          const pctChange = ((last - first) / first) * 100

          // Must have at least a baseline market cap or shares to avoid spam/empty vaults trending
          if (convertWeiToEther(v.market_cap) < 1) continue

          if (v.term?.atom) {
            if (pctChange > bestAtomPct) {
              bestAtomPct = pctChange
              bestAtom = { ...v, pctChange }
            }
          } else if (v.term?.triple) {
            if (pctChange > bestTriplePct) {
              bestTriplePct = pctChange
              bestTriple = { ...v, pctChange }
            }
          }
        }

        setTrendingAtom(bestAtom)
        setTrendingTriple(bestTriple)
      } catch (e) {
        console.error("Failed to load trending data:", e)
      } finally {
        setLoading(false)
      }
    }
    loadTrending()
  }, [])

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
          <div className="h-[180px] w-full rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-[180px] w-full rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </section>
    )
  }

  // If we couldn't find any trending data (which shouldn't happen but just in case)
  if (!trendingAtom && !trendingTriple) return null

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
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary dark:text-cyan-400" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Trending on Intuition (24h)</h3>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 w-full">
        {/* Trending Identity */}
        {trendingAtom && (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <Card className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-2xl flex flex-col h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
                <Flame className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-2 text-xs">
                  <Flame className="w-3.5 h-3.5" /> Identity on Fire
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={formatLabel(trendingAtom)}>
                  {formatLabel(trendingAtom)}
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-auto pt-4 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-2xl font-black text-green-500 dark:text-green-400">
                    <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                    {trendingAtom.pctChange.toFixed(1)}%
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Growth in 24 hours</p>
                </div>
                <button
                  onClick={() => handleWatch(formatLabel(trendingAtom), trendingAtom.term_id)}
                  className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-800/50 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  <Star className="w-4 h-4" /> Watch
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trending Claim */}
        {trendingTriple && (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <Card className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-2xl flex flex-col h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
                <Rocket className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider font-semibold text-cyan-500 dark:text-cyan-400 flex items-center gap-2 text-xs">
                  <Rocket className="w-3.5 h-3.5" /> Viral Claim
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={formatLabel(trendingTriple)}>
                  {formatLabel(trendingTriple)}
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-auto pt-4 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-2xl font-black text-green-500 dark:text-green-400">
                    <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                    {trendingTriple.pctChange.toFixed(1)}%
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Growth in 24 hours</p>
                </div>
                <button
                  onClick={() => handleWatch(formatLabel(trendingTriple), trendingTriple.term_id)}
                  className="flex items-center gap-1.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-800/50 text-cyan-700 dark:text-cyan-300 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  <Star className="w-4 h-4" /> Watch
                </button>
              </CardContent>
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
