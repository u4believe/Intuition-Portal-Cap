'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink } from 'lucide-react'

interface PriceData {
  priceUsd: string
  priceChange24h: number | null
  volume24h: number | null
}

function fmtVol(n: number | null) {
  if (n == null) return '—'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

export default function TrustPriceChip() {
  const [data, setData] = useState<PriceData | null>(null)
  const [spinning, setSpinning] = useState(false)

  const refresh = useCallback(async () => {
    setSpinning(true)
    try {
      const res = await fetch('/api/trust-price')
      if (res.ok) setData(await res.json())
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
    <a
      href="https://dexscreener.com/base/0x17f707CF3EDBbd5d9251D4bCDF9Ad70a247D7B84"
      target="_blank"
      rel="noopener noreferrer"
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 transition-colors group text-xs leading-none select-none"
      title="TRUST/USDC on Aerodrome · Base — View on DexScreener"
    >
      {/* Token label */}
      <span className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 transition-colors">TRUST</span>

      {/* Price */}
      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
        {price != null ? '$' + price.toFixed(4) : '···'}
      </span>

      {/* 24h change */}
      {change != null && (
        <span className={`flex items-center gap-0.5 font-semibold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </span>
      )}

      {/* Volume */}
      {data?.volume24h != null && (
        <span className="text-slate-400 dark:text-slate-500 hidden lg:inline">
          Vol {fmtVol(data.volume24h)}
        </span>
      )}

      {/* Divider + icons */}
      <span className="text-slate-300 dark:text-slate-600">·</span>

      <button
        onClick={e => { e.preventDefault(); refresh() }}
        title="Refresh price"
        className="text-slate-400 hover:text-cyan-500 transition-colors cursor-pointer"
      >
        <RefreshCw className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
      </button>

      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 transition-colors" />
    </a>
  )
}
