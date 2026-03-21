'use client'

import { useState, useEffect, useRef } from 'react'
import { Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Search } from 'lucide-react'
import Link from 'next/link'
import { useAtoms } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'

type SortField = 'label' | 'positionCount' | 'marketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice'
type SortOrder = 'asc' | 'desc'

export default function AtomsTable({ targetPage, highlightTermId, onClearHighlight }: { targetPage?: number | null, highlightTermId?: string | null, onClearHighlight?: () => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const highlightRef = useRef<HTMLTableRowElement | HTMLAnchorElement | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { data: result = { atoms: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }, isLoading: loading } = useAtoms(debouncedSearch ? 1 : currentPage, debouncedSearch)
  const { atoms = [], pagination = { page: 1, pageSize: 100, total: 0, totalPages: 0 } } = result
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const { syncWatchedClaimsToServer, removeClaimAlertPref } = usePushNotifications()
  const [sortField, setSortField] = useState<SortField>('marketCap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedClaimForWatch, setSelectedClaimForWatch] = useState<string | null>(null)
  const [selectedClaimTermId, setSelectedClaimTermId] = useState<string>('')

  const watchedClaims = getWatchedClaims()
  const isWatched = (claimLabel: string) => watchedClaims.includes(claimLabel)

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

  const sortedAtoms = [...atoms]
    .sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = (bValue as string).toLowerCase()
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0'
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors whitespace-nowrap text-slate-900 dark:text-slate-100 cursor-pointer"
    >
      {label}
      {sortField === field && (
        sortOrder === 'asc' ? (
          <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" />
        ) : (
          <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
        )
      )}
    </button>
  )

  return (
    <>
      <div className="w-full bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table search bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? (debouncedSearch ? 'Searching…' : 'Loading…') : debouncedSearch ? `${sortedAtoms.length} result${sortedAtoms.length !== 1 ? 's' : ''} for "${debouncedSearch}"` : `${pagination.total.toLocaleString()} identities`}
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Search identities…"
              className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-black dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 w-44 sm:w-60"
            />
            {tableSearch && (
              <button onClick={() => setTableSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading identities...</div>
        ) : sortedAtoms.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            {debouncedSearch ? `No identities match "${debouncedSearch}"` : 'No identities found'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-start">
                        <SortHeader field="label" label="Atom" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">
                        <SortHeader field="marketCap" label="Total Mkt Cap" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">
                        <SortHeader field="totalAssets" label="Total Assets" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">
                        <SortHeader field="totalShares" label="Total Shares" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">
                        <SortHeader field="currentSharePrice" label="Share Price (Exp)" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">
                        <SortHeader field="positionCount" label="Positions" />
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center">Watch</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sortedAtoms.map((atom, idx) => {
                    const isHighlighted = !!highlightTermId && atom.termId === highlightTermId
                    return (
                    <tr
                      key={`atom-${idx}`}
                      ref={isHighlighted ? (el) => { (highlightRef as { current: HTMLTableRowElement | null }).current = el } : undefined}
                      className={`transition-colors group cursor-pointer ${isHighlighted ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400 dark:border-amber-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      <td className="py-2.5 px-3 text-left">
                        <Link href={`/vault/${atom.termId}`} className="flex items-center gap-2 hover:no-underline">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleWatchClick(atom.label, atom.termId)
                            }}
                            className="p-1 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                isWatched(atom.label)
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'
                              }`}
                            />
                          </button>
                          {atom.image && (
                            <img src={atom.image || '/placeholder.svg'} alt={atom.label} className="w-5 h-5 rounded-full flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate hover:text-primary transition-colors">{atom.label}</p>
                              {isHighlighted && (
                                <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                  Search result
                                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearHighlight?.() }} className="hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer">
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{atom.creatorLabel}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${atom.termId}`} className="hover:text-primary transition-colors">
                          {formatNumber(atom.marketCap)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${atom.termId}`} className="hover:text-primary transition-colors">
                          {formatNumber(atom.totalAssets)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${atom.termId}`} className="hover:text-primary transition-colors">
                          {formatNumber(atom.totalShares)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${atom.termId}`} className="hover:text-primary transition-colors">
                          {atom.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-700 dark:text-slate-300 text-sm">
                        <Link href={`/vault/${atom.termId}`} className="hover:text-primary transition-colors">
                          {formatNumber(atom.positionCount)}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleWatchClick(atom.label, atom.termId)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              isWatched(atom.label)
                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600'
                                : 'bg-primary hover:bg-primary/90 text-white'
                            }`}
                          >
                            {isWatched(atom.label) ? 'Watching' : 'Watch'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {sortedAtoms.map((atom, idx) => {
                const isHighlightedMobile = !!highlightTermId && atom.termId === highlightTermId
                return (
                <Link
                  key={`atom-mobile-${idx}`}
                  ref={isHighlightedMobile ? (el) => { (highlightRef as { current: HTMLAnchorElement | null }).current = el } : undefined}
                  href={`/vault/${atom.termId}`}
                  className={`block transition-colors ${isHighlightedMobile ? 'bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleWatchClick(atom.label, atom.termId)
                          }}
                          className="p-0.5 hover:scale-125 transition-transform flex-shrink-0 cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isWatched(atom.label)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </button>
                        {atom.image && (
                          <img src={atom.image || '/placeholder.svg'} alt={atom.label} className="w-6 h-6 rounded-full flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{atom.label}</p>
                            {isHighlightedMobile && (
                              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                Search result
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearHighlight?.() }} className="hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{atom.creatorLabel}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleWatchClick(atom.label, atom.termId)
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0 ml-2 cursor-pointer ${
                          isWatched(atom.label)
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {isWatched(atom.label) ? 'Watching' : 'Watch'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Mkt Cap</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(atom.marketCap)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Assets</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(atom.totalAssets)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Share Price (Exp)</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {atom.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Shares</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(atom.totalShares)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Positions</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{formatNumber(atom.positionCount)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {!debouncedSearch && <div className="flex items-center justify-between py-3 px-3 sm:py-4 sm:px-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <span className="hidden sm:inline">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)</span>
                <span className="sm:hidden">{pagination.page}/{pagination.totalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>}
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
