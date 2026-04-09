'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink, Database, Users, Info } from 'lucide-react'

interface PriceData {
  priceUsd: string
  priceChange24h: number | null
  volume24h: number | null
  dex: string
  chain: string
}

interface ProtocolStats {
  totalStakedTrust: number | null
  uniqueAddresses: number | null
}

function fmtTrust(n: number | null) {
  if (n == null) return '···'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtAddresses(n: number | null) {
  if (n == null) return '···'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function fmtVol(n: number | null) {
  if (n == null) return '—'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

export default function ProtocolStatsBar() {
  const [price, setPriceData] = useState<PriceData | null>(null)
  const [stats, setStats] = useState<ProtocolStats>({ totalStakedTrust: null, uniqueAddresses: null })
  const [spinning, setSpinning] = useState(false)

  const refresh = useCallback(async () => {
    setSpinning(true)
    try {
      const [priceRes, statsRes] = await Promise.all([
        fetch('/api/trust-price'),
        fetch('/api/protocol-stats'),
      ])
      if (priceRes.ok) setPriceData(await priceRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } finally {
      setTimeout(() => setSpinning(false), 600)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [refresh])

  const priceUsd = price ? parseFloat(price.priceUsd) : null
  const change = price?.priceChange24h ?? null
  const isUp = change != null && change >= 0

  return (
    <div className="w-full border-y border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5">

        {/*
          Mobile  → two stacked rows (protocol row, then price row)
          sm+     → single flex row, protocol left / price right
        */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">

          {/* ── ROW 1 / LEFT: Protocol Stats ── */}
          <div className="flex items-center gap-3 flex-wrap">

            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden sm:block whitespace-nowrap">
              Protocol
            </p>

            <span className="text-slate-300 dark:text-slate-700 hidden sm:block select-none">|</span>

            {/* Total Staked */}
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-cyan-500 flex-shrink-0" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Total Staked</span>

              {/* Info icon + tooltip */}
              <div className="relative group">
                <Info
                  className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                  aria-label="What is Total Staked?"
                />
                {/* Tooltip — appears below the icon */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-56 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-slate-900 dark:bg-slate-950 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl border border-slate-700 dark:border-slate-600">
                    This is the total amount of TRUST staked across all Claims and Identities on the Intuition Portal
                  </div>
                  {/* Arrow */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-950 border-l border-t border-slate-700 dark:border-slate-600 rotate-45" />
                </div>
              </div>

              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {fmtTrust(stats.totalStakedTrust)}
              </span>
              <span className="text-[11px] text-cyan-500 font-semibold">TRUST</span>
            </div>

            <span className="text-slate-300 dark:text-slate-700 select-none">|</span>

            {/* Wallets */}
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-violet-500 flex-shrink-0" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">Wallets</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {fmtAddresses(stats.uniqueAddresses)}
              </span>
            </div>
          </div>

          {/* ── ROW 2 / RIGHT: TRUST Price ── */}
          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap sm:ml-auto">

            {/* Price + change */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-cyan-400 leading-none">T</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">TRUST/USDC</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums font-mono">
                {priceUsd != null ? '$' + priceUsd.toFixed(4) : <span className="text-slate-400">···</span>}
              </span>
              {change != null && (
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                  <span className="text-slate-400 dark:text-slate-500 font-normal ml-0.5">24h</span>
                </span>
              )}
            </div>

            {/* Volume — desktop only */}
            {price?.volume24h != null && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-slate-300 dark:text-slate-700 select-none">|</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Vol 24h</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {fmtVol(price.volume24h)}
                </span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden lg:block capitalize whitespace-nowrap">
                {price?.dex ?? 'aerodrome'} · {price?.chain ?? 'base'}
              </span>
              <button
                onClick={refresh}
                title="Refresh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
              </button>
              <a
                href="https://dexscreener.com/base/0x17f707CF3EDBbd5d9251D4bCDF9Ad70a247D7B84"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-cyan-500 transition-colors"
              >
                DexScreener <ExternalLink className="w-3 h-3" />
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
