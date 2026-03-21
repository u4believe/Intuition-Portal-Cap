'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Search, TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { useTriples } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'

type SortField = 'label' | 'positionCount' | 'marketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice'
type SortOrder = 'asc' | 'desc'
type SideMode = 'support' | 'oppose'

export default function TriplesTable({ targetPage, highlightTermId, onClearHighlight }: { targetPage?: number | null, highlightTermId?: string | null, onClearHighlight?: () => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sideMode, setSideMode] = useState<SideMode>('support')
  const highlightRef = useRef<HTMLTableRowElement | HTMLAnchorElement | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { data: result = { triples: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }, isLoading: loading } = useTriples(debouncedSearch ? 1 : currentPage, debouncedSearch)
  const { triples = [], pagination = { page: 1, pageSize: 100, total: 0, totalPages: 0 } } = result
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const { syncWatchedClaimsToServer, removeClaimAlertPref } = usePushNotifications()
  const [sortField, setSortField] = useState<SortField>('marketCap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedClaimForWatch, setSelectedClaimForWatch] = useState<string | null>(null)
  const [selectedClaimTermId, setSelectedClaimTermId] = useState<string>('')

  const watchedClaims = getWatchedClaims()
  const isWatched = (claimLabel: string) => watchedClaims.includes(claimLabel)

  const isSupport = sideMode === 'support'
  const accentBg = isSupport ? 'bg-emerald-500' : 'bg-rose-500'
  const accentText = isSupport ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
  const accentBorder = isSupport ? 'border-l-emerald-400 dark:border-l-emerald-500' : 'border-l-rose-400 dark:border-l-rose-500'

  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage)
    }
  }, [targetPage])

  useEffect(() => {
    if (!loading && highlightTermId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }, [loading, highlightTermId])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleWatchClick = (claimLabel: string, termId: string = '') => {
    if (isWatched(claimLabel)) {
      removeWatchedClaim(claimLabel)
      syncWatchedClaimsToServer()
      if (termId) removeClaimAlertPref(termId)
    } else {
      setSelectedClaimForWatch(claimLabel)
      setSelectedClaimTermId(termId)
      setWatchDialogOpen(true)
    }
  }

  const [tableSearch, setTableSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(tableSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [tableSearch])

  const getVal = (triple: any, field: SortField) => {
    if (sideMode === 'oppose') {
      if (field === 'marketCap') return triple.opposeMarketCap ?? 0
      if (field === 'totalAssets') return triple.opposeTotalAssets ?? 0
      if (field === 'totalShares') return triple.opposeTotalShares ?? 0
      if (field === 'currentSharePrice') return triple.opposeSharePrice ?? 0
      if (field === 'positionCount') return triple.opposePositionCount ?? 0
    }
    return triple[field]
  }

  const sortedTriples = [...triples]
    .sort((a, b) => {
      let aValue: any = getVal(a, sortField)
      let bValue: any = getVal(b, sortField)
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = (bValue as string).toLowerCase()
      }
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  const fmt = (num: number | undefined) => {
    if (!num && num !== 0) return '0'
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const fmtPrice = (num: number | undefined) => {
    if (!num) return '0'
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors text-slate-900 dark:text-slate-100 whitespace-nowrap cursor-pointer"
    >
      {label}
      {sortField === field && (
        sortOrder === 'asc'
          ? <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          : <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      )}
    </button>
  )

  return (
    <>
      <div className="w-full bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              {loading
                ? (debouncedSearch ? 'Searching…' : 'Loading…')
                : debouncedSearch
                  ? `${sortedTriples.length} result${sortedTriples.length !== 1 ? 's' : ''} for "${debouncedSearch}"`
                  : `${pagination.total.toLocaleString()} claims`}
            </span>
            {/* Support / Oppose toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold shrink-0">
              <button
                onClick={() => setSideMode('support')}
                className={`px-3 py-1.5 transition-colors cursor-pointer ${
                  isSupport
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600'
                }`}
              >
                For
              </button>
              <button
                onClick={() => setSideMode('oppose')}
                className={`px-3 py-1.5 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${
                  !isSupport
                    ? 'bg-rose-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600'
                }`}
              >
                Against
              </button>
            </div>
          </div>
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Search Subject, Predicate, Object…"
              className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-black dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 w-52 sm:w-72"
            />
            {tableSearch && (
              <button onClick={() => setTableSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading claims…</div>
        ) : sortedTriples.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            {debouncedSearch ? `No claims match "${debouncedSearch}"` : 'No claims found'}
          </div>
        ) : (
          <>
            {/* ── Desktop Table ── */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-3 px-3 text-xs font-semibold">
                      <SortHeader field="label" label="Claim" />
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold">
                      <div className="flex justify-end">
                        <SortHeader field="marketCap" label="Total Mkt Cap" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold">
                      <div className="flex justify-end">
                        <SortHeader field="totalAssets" label="Total Assets" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold">
                      <div className="flex justify-end">
                        <SortHeader field="totalShares" label="Total Shares" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold">
                      <div className="flex justify-end">
                        <SortHeader field="currentSharePrice" label="Total Share Price" />
                      </div>
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold">
                      <div className="flex justify-end">
                        <SortHeader field="positionCount" label="Total Positions" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Watch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {sortedTriples.map((triple, idx) => {
                    const isHighlighted = !!highlightTermId && triple.termId === highlightTermId
                    const price = getVal(triple, 'currentSharePrice') as number
                    const positions = getVal(triple, 'positionCount') as number
                    const noOppose = sideMode === 'oppose' && !triple.hasOppose
                    return (
                      <tr
                        key={`triple-${idx}`}
                        ref={isHighlighted ? (el) => { (highlightRef as { current: HTMLTableRowElement | null }).current = el } : undefined}
                        className={`transition-colors group ${
                          isHighlighted
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 dark:border-amber-500'
                            : noOppose
                              ? 'opacity-50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 min-w-0 max-w-xs">
                          <Link href={`/vault/${triple.termId}`} className="flex items-center gap-2 hover:no-underline">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWatchClick(triple.label, triple.termId) }}
                              className="p-1 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer"
                            >
                              <Star className={`w-3.5 h-3.5 ${isWatched(triple.label) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'}`} />
                            </button>
                            {triple.image && (
                              <img src={triple.image} alt="" className="w-5 h-5 rounded-full flex-shrink-0 object-cover" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-primary transition-colors">{triple.label}</p>
                                {isHighlighted && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                    Match
                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearHighlight?.() }} className="cursor-pointer">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{triple.subjectLabel}</p>
                            </div>
                          </Link>
                        </td>

                        {/* Numeric cells */}
                        {[
                          fmt(getVal(triple, 'marketCap') as number),
                          fmt(getVal(triple, 'totalAssets') as number),
                          fmt(getVal(triple, 'totalShares') as number),
                        ].map((val, i) => (
                          <td key={i} className="py-2.5 px-3 text-right">
                            <Link href={`/vault/${triple.termId}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-primary transition-colors tabular-nums">
                              {val}
                            </Link>
                          </td>
                        ))}

                        <td className="py-2.5 px-3 text-right">
                          <Link href={`/vault/${triple.termId}`} className={`text-sm font-semibold tabular-nums hover:opacity-80 transition-opacity ${accentText}`}>
                            {fmtPrice(price)}
                          </Link>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <Link href={`/vault/${triple.termId}`} className={`text-sm font-semibold tabular-nums hover:opacity-80 transition-opacity ${accentText}`}>
                            {fmt(positions)}
                          </Link>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWatchClick(triple.label, triple.termId) }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              isWatched(triple.label)
                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600'
                                : 'bg-primary hover:bg-primary/90 text-white'
                            }`}
                          >
                            {isWatched(triple.label) ? 'Watching' : 'Watch'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Card Layout ── */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/70">
              {sortedTriples.map((triple, idx) => {
                const isHighlightedMobile = !!highlightTermId && triple.termId === highlightTermId
                const noOppose = sideMode === 'oppose' && !triple.hasOppose
                const price = getVal(triple, 'currentSharePrice') as number
                const positions = getVal(triple, 'positionCount') as number
                return (
                  <Link
                    key={`triple-mobile-${idx}`}
                    ref={isHighlightedMobile ? (el) => { (highlightRef as { current: HTMLAnchorElement | null }).current = el } : undefined}
                    href={`/vault/${triple.termId}`}
                    className={`block transition-colors ${
                      isHighlightedMobile
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400'
                        : noOppose
                          ? 'opacity-50'
                          : `border-l-4 ${accentBorder} hover:bg-slate-50 dark:hover:bg-slate-800/40`
                    }`}
                  >
                    <div className="p-3 space-y-2.5">
                      {/* Card header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWatchClick(triple.label, triple.termId) }}
                            className="p-0.5 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer"
                          >
                            <Star className={`w-4 h-4 ${isWatched(triple.label) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 dark:text-slate-600'}`} />
                          </button>
                          {triple.image && (
                            <img src={triple.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">{triple.label}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{triple.subjectLabel}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleWatchClick(triple.label, triple.termId) }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                            isWatched(triple.label)
                              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                              : 'bg-primary text-white'
                          }`}
                        >
                          {isWatched(triple.label) ? 'Watching' : 'Watch'}
                        </button>
                      </div>

                      {/* Stat grid */}
                      <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 mb-0.5">Total Mkt Cap</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(getVal(triple, 'marketCap') as number)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 mb-0.5">Total Assets</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(getVal(triple, 'totalAssets') as number)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 mb-0.5">Total Shares</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(getVal(triple, 'totalShares') as number)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 mb-0.5">Total Share Price</p>
                          <p className={`font-bold tabular-nums ${accentText}`}>{fmtPrice(price)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 dark:text-slate-500 mb-0.5">Total Positions</p>
                          <p className={`font-bold tabular-nums ${accentText}`}>{fmt(positions)}</p>
                        </div>
                        <div className="flex items-end">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isSupport
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                          }`}>
                            {isSupport ? 'For' : 'Against'}
                          </span>
                        </div>
                      </div>

                      {isHighlightedMobile && (
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                            Search result
                          </span>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearHighlight?.() }}
                            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Pagination */}
            {!debouncedSearch && (
              <div className="flex items-center justify-between py-3 px-3 sm:py-4 sm:px-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  <span className="hidden sm:inline">Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)</span>
                  <span className="sm:hidden">{pagination.page} / {pagination.totalPages}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page === pagination.totalPages}
                    className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        claimLabel={selectedClaimForWatch || ''}
        termId={selectedClaimTermId}
        onConfirm={(claimLabel) => {
          addWatchedClaim(claimLabel)
          setSelectedClaimForWatch(null)
          setSelectedClaimTermId('')
          setTimeout(() => syncWatchedClaimsToServer(), 200)
        }}
      />
    </>
  )
}
