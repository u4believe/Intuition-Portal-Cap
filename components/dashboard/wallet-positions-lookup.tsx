'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Wallet, ExternalLink, TrendingUp, Pencil, X, Check, Tag } from 'lucide-react'
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
  totalDeposited: number
  totalRedeemed: number
  currentValue: number
  redeemableValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  realizedPnl: number | null
  realizedPnlPct: number | null
  subject: string | null
  predicate: string | null
  object: string | null
}

interface SavedAddress {
  address: string
  name: string
}

const STORAGE_KEY = 'intuition-wallet-address-book'

function fmt(n: number) {
  if (!n && n !== 0) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function truncateAddr(addr: string) {
  return addr.length > 13 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

function CurveBadge({ curve }: { curve: string }) {
  const styles =
    curve === 'Linear'
      ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700/50'
      : curve === 'Exponential'
      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles}`}>
      {curve}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const styles =
    type === 'Claim'
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50'
      : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/50'
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
  const [activeAddress, setActiveAddress] = useState('')
  const [positions, setPositions] = useState<Position[]>([])
  const [total, setTotal] = useState(0)
  const [allPositionShares, setAllPositionShares] = useState(0)
  const [portfolioValue, setPortfolioValue] = useState(0)
  const [portfolioUnrealizedPnl, setPortfolioUnrealizedPnl] = useState(0)
  const [portfolioUnrealizedPnlPct, setPortfolioUnrealizedPnlPct] = useState(0)
  const [portfolioRealizedPnl, setPortfolioRealizedPnl] = useState(0)
  const [portfolioRealizedPnlPct, setPortfolioRealizedPnlPct] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [filterType, setFilterType] = useState<'All' | 'Claim' | 'Identity'>('All')
  const [filterCurve, setFilterCurve] = useState<'All' | 'Linear' | 'Exponential'>('All')

  // Address book
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSavedAddresses(JSON.parse(stored))
    } catch {}
  }, [])

  const persist = (list: SavedAddress[]) => {
    setSavedAddresses(list)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch {}
  }

  const getNameFor = (addr: string) =>
    savedAddresses.find(s => s.address.toLowerCase() === addr.toLowerCase())?.name ?? null

  const commitName = (addr: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const idx = savedAddresses.findIndex(s => s.address.toLowerCase() === addr.toLowerCase())
    const updated = [...savedAddresses]
    if (idx >= 0) updated[idx] = { address: addr, name: trimmed }
    else updated.push({ address: addr, name: trimmed })
    persist(updated)
    setEditingAddress(null)
    setShowSaveInput(false)
    setNameInput('')
  }

  const removeAddress = (addr: string) => {
    persist(savedAddresses.filter(s => s.address.toLowerCase() !== addr.toLowerCase()))
    if (editingAddress?.toLowerCase() === addr.toLowerCase()) setEditingAddress(null)
  }

  const startEditing = (addr: string, currentName: string) => {
    setEditingAddress(addr)
    setNameInput(currentName)
    setShowSaveInput(false)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const startSaving = () => {
    setShowSaveInput(true)
    setNameInput('')
    setEditingAddress(null)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const DISPLAY_LIMIT = 100

  const handleSearch = async (addr?: string) => {
    const target = (addr ?? inputValue).trim()
    if (!target) return
    setActiveAddress(target)
    setInputValue(target)
    setShowSaveInput(false)
    setEditingAddress(null)
    setIsLoading(true)
    setError(null)
    setSearched(false)
    try {
      const res = await fetch(`/api/wallet-positions?address=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      setPositions(data.positions || [])
      setTotal(data.total || 0)
      setAllPositionShares(data.totalShares || 0)
      setPortfolioValue(data.totalValue || 0)
      setPortfolioUnrealizedPnl(data.totalUnrealizedPnl || 0)
      setPortfolioUnrealizedPnlPct(data.totalUnrealizedPnlPct || 0)
      setPortfolioRealizedPnl(data.totalRealizedPnl || 0)
      setPortfolioRealizedPnlPct(data.totalRealizedPnlPct || 0)
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

  const displayedPositions = filtered.slice(0, DISPLAY_LIMIT)
  const isCapped = filtered.length > DISPLAY_LIMIT
  const currentName = activeAddress ? getNameFor(activeAddress) : null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-cyan-500 dark:text-cyan-400 flex-shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Portfolio Lookup</h2>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
            View all claims &amp; identities a wallet holds shares in
          </p>
        </div>
      </div>

      {/* Saved addresses */}
      {savedAddresses.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Saved</p>
          <div className="flex flex-wrap gap-2">
            {savedAddresses.map(s => (
              <div
                key={s.address}
                className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-2.5 pr-1 py-1"
              >
                {editingAddress === s.address ? (
                  <>
                    <input
                      ref={nameInputRef}
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitName(s.address, nameInput)
                        if (e.key === 'Escape') setEditingAddress(null)
                      }}
                      className="w-28 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <button
                      onClick={() => commitName(s.address, nameInput)}
                      className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingAddress(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSearch(s.address)}
                      className="flex items-center gap-1.5 cursor-pointer group"
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        {s.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {truncateAddr(s.address)}
                      </span>
                    </button>
                    <button
                      onClick={() => startEditing(s.address, s.name)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeAddress(s.address)}
                      className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="0x… wallet address"
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
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

      {defaultAddress && inputValue === defaultAddress && (
        <p className="text-xs text-slate-500 -mt-2">
          Using your connected wallet address
        </p>
      )}

      {/* Name label for searched address */}
      {searched && activeAddress && (
        <div className="-mt-2">
          {editingAddress === activeAddress ? (
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitName(activeAddress, nameInput)
                  if (e.key === 'Escape') setEditingAddress(null)
                }}
                placeholder="Enter a name…"
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 w-48"
              />
              <button
                onClick={() => commitName(activeAddress, nameInput)}
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={() => setEditingAddress(null)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : currentName ? (
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{currentName}</span>
              <button
                onClick={() => startEditing(activeAddress, currentName)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                onClick={() => removeAddress(activeAddress)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          ) : showSaveInput ? (
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitName(activeAddress, nameInput)
                  if (e.key === 'Escape') setShowSaveInput(false)
                }}
                placeholder="Enter a name…"
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 w-48"
              />
              <button
                onClick={() => commitName(activeAddress, nameInput)}
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={() => setShowSaveInput(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startSaving}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors"
            >
              <Tag className="w-3 h-3" /> Name this address
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Results */}
      {searched && !isLoading && (
        <>
          {/* Portfolio summary */}
          {total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Value</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">{fmt(portfolioValue)} <span className="text-xs font-normal text-slate-400">TRUST</span></p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Unrealized PnL</p>
                <p className={`text-base font-semibold tabular-nums ${portfolioUnrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {portfolioUnrealizedPnl >= 0 ? '+' : ''}{fmt(portfolioUnrealizedPnl)} <span className="text-xs font-normal opacity-70">TRUST</span>
                </p>
                <p className={`text-xs tabular-nums mt-0.5 ${portfolioUnrealizedPnlPct >= 0 ? 'text-emerald-500/70 dark:text-emerald-500/60' : 'text-red-400/70 dark:text-red-400/60'}`}>
                  {portfolioUnrealizedPnlPct >= 0 ? '+' : ''}{portfolioUnrealizedPnlPct.toFixed(2)}%
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Realized PnL</p>
                <p className={`text-base font-semibold tabular-nums ${portfolioRealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {portfolioRealizedPnl >= 0 ? '+' : ''}{fmt(portfolioRealizedPnl)} <span className="text-xs font-normal opacity-70">TRUST</span>
                </p>
                <p className={`text-xs tabular-nums mt-0.5 ${portfolioRealizedPnlPct >= 0 ? 'text-emerald-500/70 dark:text-emerald-500/60' : 'text-red-400/70 dark:text-red-400/60'}`}>
                  {portfolioRealizedPnlPct >= 0 ? '+' : ''}{portfolioRealizedPnlPct.toFixed(2)}%
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total PnL</p>
                {(() => {
                  const totalPnl = portfolioUnrealizedPnl + portfolioRealizedPnl
                  return (
                    <p className={`text-base font-semibold tabular-nums ${totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)} <span className="text-xs font-normal opacity-70">TRUST</span>
                    </p>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="text-slate-900 dark:text-white font-semibold">{total}</span> position{total !== 1 ? 's' : ''} found
              {filterType !== 'All' || filterCurve !== 'All'
                ? ` · showing ${Math.min(filtered.length, DISPLAY_LIMIT)} of ${filtered.length}`
                : ''}
              {total > 0 && (
                <span className="ml-2 text-sky-600 dark:text-sky-400 font-semibold">
                  {fmt(allPositionShares)} total shares
                </span>
              )}
            </p>

            {/* Filters */}
            {total > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold">
                  {(['All', 'Claim', 'Identity'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1.5 transition-colors cursor-pointer ${
                        filterType === t
                          ? 'bg-amber-500 dark:bg-amber-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold">
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
                            : 'bg-slate-500 dark:bg-slate-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:text-white'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isCapped && (
            <p className="text-xs text-amber-700 dark:text-amber-400/80 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
              Showing top {DISPLAY_LIMIT} positions by shares. This wallet holds {filtered.length} total positions matching the current filter.
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-slate-500 dark:text-slate-500 text-sm">
                {total === 0
                  ? 'No positions found for this address'
                  : 'No positions match the selected filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Claim / Identity
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Type</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Curve</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-sky-600 dark:text-sky-400">Shares</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Share Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Value (TRUST)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Unrealized PnL</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {displayedPositions.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          {p.image && (
                            <img src={p.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700" />
                          )}
                          <div className="min-w-0">
                            {p.type === 'Claim' && p.subject ? (
                              <p className="text-xs leading-snug flex flex-wrap gap-0.5">
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{p.subject}</span>
                                <span className="text-slate-400">·</span>
                                <span className="text-orange-600 dark:text-orange-400">{p.predicate}</span>
                                <span className="text-slate-400">·</span>
                                <span className="text-teal-600 dark:text-teal-400">{p.object}</span>
                              </p>
                            ) : (
                              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium truncate">{p.label}</p>
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
                        <span className="text-sky-600 dark:text-sky-400 font-semibold tabular-nums">{fmt(p.shares)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums text-xs">{fmt(p.sharePrice)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums text-xs">{fmt(p.currentValue)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`tabular-nums text-xs font-semibold ${p.unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {p.unrealizedPnl >= 0 ? '+' : ''}{fmt(p.unrealizedPnl)}
                          </span>
                          <span className={`tabular-nums text-xs ${p.unrealizedPnlPct >= 0 ? 'text-emerald-500/70 dark:text-emerald-500/60' : 'text-red-400/70 dark:text-red-400/60'}`}>
                            {p.unrealizedPnlPct >= 0 ? '+' : ''}{p.unrealizedPnlPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.termId && (
                          <Link
                            href={`/vault/${p.termId}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
