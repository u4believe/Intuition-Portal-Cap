'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink } from 'lucide-react'

interface PriceData {
  priceUsd: string
  priceChange24h: number | null
  volume24h: number | null
  dex: string
  chain: string
}

function fmtVol(n: number | null) {
  if (n == null) return '—'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

export default function ProtocolStatsBar() {
  const [data, setData] = useState<PriceData | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setSpinning(true)
    try {
      const res = await fetch('/api/trust-price')
      if (res.ok) {
        setData(await res.json())
        setLastUpdated(new Date())
      }
    } finally {
      setTimeout(() => setSpinning(false), 600)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  const price = data ? parseFloat(data.priceUsd) : null
  const change = data?.priceChange24h ?? null
  const isUp = change != null && change >= 0

  return (
    <div className="w-full border-y border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">

        {/* Left label */}
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden sm:block">
          Live Protocol Stats
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-6 flex-wrap">

          {/* TRUST price */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-cyan-400 leading-none">T</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">TRUST/USDC</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums font-mono">
              {price != null ? '$' + price.toFixed(4) : <span className="text-slate-400">···</span>}
            </span>
            {change != null && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isUp ? '+' : ''}{change.toFixed(2)}%
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-0.5">24h</span>
              </span>
            )}
          </div>

          {/* Divider */}
          <span className="text-slate-300 dark:text-slate-700 hidden sm:block">|</span>

          {/* Volume */}
          {data?.volume24h != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Vol 24h</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {fmtVol(data.volume24h)}
              </span>
            </div>
          )}

          {/* Source badge */}
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden md:block capitalize">
            {data?.dex ?? 'aerodrome'} · {data?.chain ?? 'base'}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          {lastUpdated && (
            <span className="text-xs text-slate-400 dark:text-slate-600 hidden lg:block">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            title="Refresh"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="https://dexscreener.com/base/0x17f707CF3EDBbd5d9251D4bCDF9Ad70a247D7B84"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-cyan-500 transition-colors"
          >
            DexScreener <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>
    </div>
  )
}
