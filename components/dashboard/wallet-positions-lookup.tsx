'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Wallet, ExternalLink, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Position {
  termId: string
  type: 'Claim' | 'Identity'
  label: string
  image: string | null
  curve: 'Linear' | 'Exponential' | 'Unknown'
  curveId: number | null
  shares: number
  sharePrice: number
  createdAt: string
  subject: string | null
  predicate: string | null
  object: string | null
}

function fmt(n: number) {
  if (!n && n !== 0) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function CurveBadge({ curve }: { curve: string }) {
  const styles =
    curve === 'Linear'
      ? 'bg-sky-900/40 text-sky-300 border border-sky-700/50'
      : curve === 'Exponential'
      ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50'
      : 'bg-slate-800 text-slate-400 border border-slate-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles}`}>
      {curve}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const styles =
    type === 'Claim'
      ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
      : 'bg-teal-900/40 text-teal-300 border border-teal-700/50'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles}`}>
      {type}
    </span>
  )
}

interface Props {
  defaultAddress?: string
}

export default function WalletPositionsLookup({ defaultAddress = '' }: Props) {
  const [inputValue, setInputValue] = useState(defaultAddress)
  const [positions, setPositions] = useState<Position[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [filterType, setFilterType] = useState<'All' | 'Claim' | 'Identity'>('All')
  const [filterCurve, setFilterCurve] = useState<'All' | 'Linear' | 'Exponential'>('All')

  const handleSearch = async (addr?: string) => {
    const target = (addr ?? inputValue).trim()
    if (!target) return
    setIsLoading(true)
    setError(null)
    setSearched(false)
    try {
      const res = await fetch(`/api/wallet-positions?address=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      setPositions(data.positions || [])
      setTotal(data.total || 0)
      setSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch positions')
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = positions.filter(p => {
    if (filterType !== 'All' && p.type !== filterType) return false
    if (filterCurve !== 'All' && p.curve !== filterCurve) return false
    return true
  })

  const totalShares = filtered.reduce((s, p) => s + p.shares, 0)

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-cyan-400 flex-shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-white">Portfolio Lookup</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View all claims &amp; identities a wallet holds shares in
          </p>
        </div>
      </div>

      {/* Address input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="0x… wallet address"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
        />
        <Button
          onClick={() => handleSearch()}
          disabled={isLoading || !inputValue.trim()}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 gap-1.5 shrink-0 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          {isLoading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {/* Use connected wallet hint shown via parent passing defaultAddress */}
      {defaultAddress && inputValue === defaultAddress && (
        <p className="text-xs text-slate-500 -mt-2">
          Using your connected wallet address
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Results */}
      {searched && !isLoading && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">{total}</span> position{total !== 1 ? 's' : ''} found
              {filterType !== 'All' || filterCurve !== 'All'
                ? ` · showing ${filtered.length}`
                : ''}
              {total > 0 && (
                <span className="ml-2 text-sky-400 font-semibold">
                  {fmt(totalShares)} total shares
                </span>
              )}
            </p>

            {/* Filters */}
            {total > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-semibold">
                  {(['All', 'Claim', 'Identity'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1.5 transition-colors cursor-pointer ${
                        filterType === t
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-semibold">
                  {(['All', 'Linear', 'Exponential'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setFilterCurve(c)}
                      className={`px-3 py-1.5 transition-colors cursor-pointer ${
                        filterCurve === c
                          ? c === 'Linear'
                            ? 'bg-sky-600 text-white'
                            : c === 'Exponential'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <TrendingUp className="w-8 h-8 text-slate-700 mx-auto" />
              <p className="text-slate-500 text-sm">
                {total === 0
                  ? 'No positions found for this address'
                  : 'No positions match the selected filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 whitespace-nowrap">
                      Claim / Identity
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400">Type</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400">Curve</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-sky-400">Shares</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Share Price</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filtered.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          {p.image && (
                            <img src={p.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover border border-slate-700" />
                          )}
                          <div className="min-w-0">
                            {p.type === 'Claim' && p.subject ? (
                              <p className="text-xs leading-snug flex flex-wrap gap-0.5">
                                <span className="text-blue-400 font-medium">{p.subject}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-orange-400">{p.predicate}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-teal-400">{p.object}</span>
                              </p>
                            ) : (
                              <p className="text-sm text-slate-200 font-medium truncate">{p.label}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <TypeBadge type={p.type} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <CurveBadge curve={p.curve} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sky-400 font-semibold tabular-nums">{fmt(p.shares)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-300 tabular-nums text-xs">{fmt(p.sharePrice)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.termId && (
                          <Link
                            href={`/vault/${p.termId}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                            title="View details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
