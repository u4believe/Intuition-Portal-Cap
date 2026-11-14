'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import MarketChart from '@/components/markets/market-chart'
import { MARKET_CATEGORIES, type MarketCategoryId } from '@/lib/markets'

export default function MarketsSection() {
  const [categoryId, setCategoryId] = useState<MarketCategoryId>(MARKET_CATEGORIES[0].id)
  // Remember the last instrument viewed in each category.
  const [selected, setSelected] = useState<Partial<Record<MarketCategoryId, string>>>({})
  const { resolvedTheme } = useTheme()
  // The theme is only known in the browser; wait so the chart isn't built twice.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const category = MARKET_CATEGORIES.find((c) => c.id === categoryId) ?? MARKET_CATEGORIES[0]
  const instrument = category.instruments.find((i) => i.id === selected[category.id]) ?? category.instruments[0]

  return (
    <section id="markets" className="w-full border-t border-slate-200 dark:border-slate-800/50 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Global markets</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A market overview across crypto, FX, stocks, commodities and indices. Charts and prices by TradingView.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          {/* Asset classes */}
          <div
            role="tablist"
            aria-label="Asset class"
            className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-2 sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {MARKET_CATEGORIES.map((c) => {
              const active = c.id === category.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                    active
                      ? 'border-primary text-primary dark:border-cyan-400 dark:text-cyan-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          {/* Instruments in the chosen class */}
          <div className="flex gap-2 overflow-x-auto px-3 sm:px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {category.instruments.map((i) => {
              const active = i.id === instrument.id
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={active}
                  title={i.name}
                  onClick={() => setSelected((prev) => ({ ...prev, [category.id]: i.id }))}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {i.label}
                </button>
              )
            })}
          </div>

          <div className="h-[460px] md:h-[620px] border-t border-slate-200 dark:border-slate-800">
            {mounted && (
              <MarketChart
                instrumentId={instrument.id}
                theme={resolvedTheme === 'light' ? 'light' : 'dark'}
                height="100%"
              />
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          Market data is provided by TradingView for reference only and may be delayed for some exchanges. It is not Intuition data and not financial advice.
        </p>
      </div>
    </section>
  )
}
