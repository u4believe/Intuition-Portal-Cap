'use client'

import { useState } from 'react'
import { Star, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useTriples } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'
import { ViewTriplesModal } from '@/components/landing/view-triples-modal'

type SortField = 'label' | 'positionCount' | 'marketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice' | 'sharePriceChange24h'
type SortOrder = 'asc' | 'desc'

export default function TriplesTable() {
  const [currentPage, setCurrentPage] = useState(1)
  const { data: result = { triples: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }, isLoading: loading } = useTriples(currentPage)
  const { triples = [], pagination = { page: 1, pageSize: 100, total: 0, totalPages: 0 } } = result
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const [sortField, setSortField] = useState<SortField>('marketCap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedClaimForWatch, setSelectedClaimForWatch] = useState<string | null>(null)

  const watchedClaims = getWatchedClaims()
  const isWatched = (claimLabel: string) => watchedClaims.includes(claimLabel)
  const [viewTriplesOpen, setViewTriplesOpen] = useState(false)
  const [selectedTripleForView, setSelectedTripleForView] = useState<string>('')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleWatchClick = (claimLabel: string) => {
    if (isWatched(claimLabel)) {
      removeWatchedClaim(claimLabel)
    } else {
      setSelectedClaimForWatch(claimLabel)
      setWatchDialogOpen(true)
    }
  }

  const sortedTriples = [...triples]
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

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors text-black dark:text-white font-semibold"
    >
      {label}
      {sortField === field &&
        (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
    </button>
  )

  return (
    <>
      <div className="w-full bg-white dark:bg-slate-950 border-t border-b border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-200">Loading triples...</div>
        ) : sortedTriples.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-200">No triples found</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="label" label="Triple" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="marketCap" label="Market Cap" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="totalAssets" label="Total Assets" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="totalShares" label="Total Shares" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="currentSharePrice" label="Share Price" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="sharePriceChange24h" label="24h %" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    <SortHeader field="positionCount" label="Pos." />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    Watch
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-black dark:text-white">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                {sortedTriples.map((triple, idx) => (
                  <tr
                    key={`triple-${idx}`}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group border-b border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    <td className="py-2 px-2 min-w-0">
                      <Link href={`/vault/${triple.termId}`} className="flex items-center gap-1 hover:no-underline">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleWatchClick(triple.label)
                          }}
                          className="p-1 hover:scale-125 transition-transform flex-shrink-0"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isWatched(triple.label)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-slate-400 dark:text-slate-500 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                        {triple.image && (
                          <img src={triple.image || '/placeholder.svg'} alt={triple.label} className="w-5 h-5 rounded-full flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-black dark:text-white text-xs truncate hover:text-primary transition-colors">{triple.label}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{triple.subjectLabel}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-black dark:text-white font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-primary transition-colors">
                        {triple.marketCap ? triple.marketCap.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-black dark:text-white font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-primary transition-colors">
                        {triple.totalAssets ? triple.totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-black dark:text-white font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-primary transition-colors">
                        {triple.totalShares ? triple.totalShares.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-black dark:text-white font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-primary transition-colors">
                        {triple.currentSharePrice ? triple.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:no-underline">
                        <span className={triple.sharePriceChange24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {triple.sharePriceChange24h >= 0 ? '+' : ''}{((triple.sharePriceChange24h || 0) / 1e18).toFixed(2)}%
                        </span>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-black dark:text-white text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-primary transition-colors">
                        {triple.positionCount ? triple.positionCount.toLocaleString('en-US') : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleWatchClick(triple.label)
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isWatched(triple.label)
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600'
                            : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white'
                        }`}
                      >
                        {isWatched(triple.label) ? 'Watching' : 'Watch'}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedTripleForView(triple.label)
                          setViewTriplesOpen(true)
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1"
                        title="View Triple Details"
                      >
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between py-4 px-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700">
              <div className="text-sm text-slate-700 dark:text-slate-200">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-slate-400 dark:border-slate-600 text-sm font-medium text-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-slate-400 dark:border-slate-600 text-sm font-medium text-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            </>
        )}
      </div>

      {/* Watch Preferences Dialog */}
      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        claimLabel={selectedClaimForWatch || ''}
        onConfirm={(claimLabel) => {
          addWatchedClaim(claimLabel)
          setWatchDialogOpen(false)
          setSelectedClaimForWatch(null)
        }}
      />
      <ViewTriplesModal
        open={viewTriplesOpen}
        onOpenChange={setViewTriplesOpen}
        tripleLabel={selectedTripleForView}
      />
    </>
  )
}
