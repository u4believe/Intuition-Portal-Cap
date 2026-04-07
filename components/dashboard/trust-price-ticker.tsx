'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink } from 'lucide-react'

interface PriceData {
  priceUsd: string
  priceChange24h: number | null
  liquidity: number | null
  volume24h: number | null
  dex: string
  chain: string
  updatedAt: string
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(decimals)
}

export default function TrustPriceTicker() {
  const [data, setData] = useState<PriceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetch_price = useCallback(async () => {
    try {
      const res = await fetch('/api/trust-price')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_price()
    const interval = setInterval(fetch_price, 30_000) // refresh every 30s
    return () => clearInterval(interval)
  }, [fetch_price])

  const price = data ? parseFloat(data.priceUsd) : null
  const change = data?.priceChange24h ?? null
  const isUp = change != null && change >= 0

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <span className="text-xs font-bold text-cyan-400">T</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">TRUST / USDC</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">
              {data?.dex ?? 'aerodrome'} · {data?.chain ?? 'base'}
            </p>
          </div>
        </div>
        <button
          onClick={fetch_price}
          title="Refresh"
          className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Price */}
      {isLoading && !data ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-slate-800 rounded w-32" />
          <div className="h-4 bg-slate-800 rounded w-20" />
        </div>
      ) : error && !data ? (
        <p className="text-sm text-red-400">Price unavailable</p>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-white tabular-nums">
              ${price != null ? price.toFixed(4) : '—'}
            </p>
            {change != null && (
              <div className={`flex items-center gap-1 mb-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span className="text-xs text-slate-500">24h</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Liquidity</p>
              <p className="text-sm font-semibold text-slate-200">{fmt(data?.liquidity)}</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Volume 24h</p>
              <p className="text-sm font-semibold text-slate-200">{fmt(data?.volume24h)}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {lastRefresh && (
              <p className="text-xs text-slate-600">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}
            <a
              href="https://dexscreener.com/base/0x17f707CF3EDBbd5d9251D4bCDF9Ad70a247D7B84"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
            >
              DexScreener <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
