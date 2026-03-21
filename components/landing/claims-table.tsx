'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Star, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useAllClaims } from '@/hooks/useIntuitionData'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'

type SortField = 'label' | 'positionCount' | 'totalMarketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice'
type SortOrder = 'asc' | 'desc'

export default function ClaimsTable({ targetPage, highlightTermId, onClearHighlight }: { targetPage?: number | null, highlightTermId?: string | null, onClearHighlight?: () => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { data: result = { claims: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }, isLoading: loading } = useAllClaims(debouncedSearch ? 1 : currentPage, debouncedSearch)
  const { claims = [], pagination = { page: 1, pageSize: 100, total: 0, totalPages: 0 } } = result
  const { removeClaimAlertPref, getClaimAlertPrefs } = usePushNotifications()

  const [sortField, setSortField] = useState<SortField>('totalMarketCap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [tableSearch, setTableSearch] = useState('')

  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [watchedTermIds, setWatchedTermIds] = useState<Set<string>>(new Set())

  const loadWatchedTermIds = useCallback(async () => {
    try {
      const prefs = await getClaimAlertPrefs()
      setWatchedTermIds(new Set(Object.keys(prefs)))
    } catch {}
  }, [getClaimAlertPrefs])

  useEffect(() => { loadWatchedTermIds() }, [loadWatchedTermIds])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(tableSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [tableSearch])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('desc') }
  }

  const openWatchDialog = (termId: string, label: string) => {
    setSelectedTermId(termId)
    setSelectedLabel(label)
    setWatchDialogOpen(true)
  }

  const handleUnwatch = async (termId: string) => {
    await removeClaimAlertPref(termId)
    setWatchedTermIds(prev => { const next = new Set(prev); next.delete(termId); return next })
  }

  const handleWatchConfirm = (termId: string) => {
    setWatchedTermIds(prev => new Set(prev).add(termId))
    setWatchDialogOpen(false)
  }

  const sortedClaims = [...claims].sort((a, b) => {
    let aVal: any = a[sortField], bVal: any = b[sortField]
    if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal as string).toLowerCase() }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const fmt = (n?: number) => {
    if (!n) return '0'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 hover:text-primary transition-colors text-slate-900 dark:text-slate-100 whitespace-nowrap cursor-pointer ${className || ''}`}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.length > 8 ? label.split(' ').map(w => w[0]).join('') : label}</span>
      {sortField === field && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />)}
    </button>
  )

  const WatchButton = ({ termId, side, claimLabel }: { termId: string; side: 'support' | 'oppose'; claimLabel: string }) => {
    if (!termId) return null
    const watched = watchedTermIds.has(termId)
    const isSupport = side === 'support'
    const dialogLabel = `${claimLabel} (${isSupport ? 'Support' : 'Oppose'})`
    return (
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); watched ? handleUnwatch(termId) : openWatchDialog(termId, dialogLabel) }}
        title={watched ? `Remove ${isSupport ? 'Support' : 'Oppose'} alert` : `Watch ${isSupport ? 'Support' : 'Oppose'} side`}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
          watched
            ? isSupport
              ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        <Star className={`w-3 h-3 flex-shrink-0 ${watched ? 'fill-current' : ''}`} />
        <span>{isSupport ? 'For' : 'Against'}</span>
      </button>
    )
  }

  return (
    <>
      <div className="w-full bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? (debouncedSearch ? 'Searching…' : 'Loading…') : debouncedSearch ? `${sortedClaims.length} result${sortedClaims.length !== 1 ? 's' : ''} for "${debouncedSearch}"` : `${pagination.total.toLocaleString()} vaults`}
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Search vaults…"
              className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-black dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 w-44 sm:w-60"
            />
            {tableSearch && (
              <button onClick={() => setTableSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading claims...</div>
        ) : sortedClaims.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            {debouncedSearch ? `No vaults match "${debouncedSearch}"` : 'No claims found'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <SortHeader field="label" label="Vault" />
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center"><SortHeader field="totalMarketCap" label="Total Mkt Cap" /></div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center"><SortHeader field="totalAssets" label="Total Assets" /></div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center"><SortHeader field="totalShares" label="Total Shares" /></div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center"><SortHeader field="currentSharePrice" label="Share Price (Exp)" /></div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center"><SortHeader field="positionCount" label="Positions" /></div>
                    </th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex justify-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">For</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="text-rose-600 dark:text-rose-400">Against</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sortedClaims.map((claim, idx) => (
                    <tr
                      key={`vault-${idx}`}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${highlightTermId && claim.termId === highlightTermId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-left">
                        <Link href={`/vault/${claim.termId}`} className="flex items-center gap-2 hover:no-underline">
                          {claim.image && (
                            <img src={claim.image || '/placeholder.svg'} alt={claim.label} className="w-5 h-5 rounded-full flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate hover:text-primary transition-colors">{claim.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{claim.subjectLabel}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">{fmt(claim.totalMarketCap ?? claim.marketCap)}</Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">{fmt(claim.totalAssets)}</Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">{fmt(claim.totalShares)}</Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-900 dark:text-slate-100 font-medium text-sm">
                        <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                          {claim.currentSharePrice ? claim.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-700 dark:text-slate-300 text-sm">
                        <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">{fmt(claim.positionCount)}</Link>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <WatchButton termId={claim.termId} side="support" claimLabel={claim.label} />
                          {claim.opposeTermId && (
                            <WatchButton termId={claim.opposeTermId} side="oppose" claimLabel={claim.label} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {sortedClaims.map((claim, idx) => (
                <Link
                  key={`vault-mobile-${idx}`}
                  href={`/vault/${claim.termId}`}
                  className="block hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {claim.image && (
                          <img src={claim.image || '/placeholder.svg'} alt={claim.label} className="w-6 h-6 rounded-full flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{claim.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{claim.subjectLabel}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <WatchButton termId={claim.termId} side="support" claimLabel={claim.label} />
                        {claim.opposeTermId && <WatchButton termId={claim.opposeTermId} side="oppose" claimLabel={claim.label} />}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Mkt Cap</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{fmt(claim.totalMarketCap ?? claim.marketCap)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Assets</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{fmt(claim.totalAssets)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Share Price (Exp)</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {claim.currentSharePrice ? claim.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Total Shares</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{fmt(claim.totalShares)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Positions</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{fmt(claim.positionCount)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {!debouncedSearch && (
              <div className="flex items-center justify-between py-3 px-3 sm:py-4 sm:px-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
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
              </div>
            )}
          </>
        )}
      </div>

      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={open => { if (!open) setWatchDialogOpen(false) }}
        claimLabel={selectedLabel}
        termId={selectedTermId}
        onConfirm={() => handleWatchConfirm(selectedTermId)}
      />
    </>
  )
}
