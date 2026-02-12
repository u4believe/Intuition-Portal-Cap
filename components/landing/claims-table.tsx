'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Star, Eye } from 'lucide-react'
import Link from 'next/link'
import { useAllClaims } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'
import { ViewClaimsModal } from '@/components/landing/view-claims-modal'

type SortField = 'label' | 'positionCount' | 'marketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice' | 'sharePriceChange24h'
type SortOrder = 'asc' | 'desc'

export default function ClaimsTable() {
  const [currentPage, setCurrentPage] = useState(1)
  const { data: result = { claims: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }, isLoading: loading } = useAllClaims(currentPage)
  const { claims = [], pagination = { page: 1, pageSize: 100, total: 0, totalPages: 0 } } = result
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const [sortField, setSortField] = useState<SortField>('marketCap')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedClaimForWatch, setSelectedClaimForWatch] = useState<string | null>(null)
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)
  const [viewClaimsOpen, setViewClaimsOpen] = useState(false)

  const watchedClaims = getWatchedClaims()
  const isWatched = (claimLabel: string) => watchedClaims.includes(claimLabel)

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

  const sortedClaims = [...claims]
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


  const formatNumber = (num: number | undefined, isMobile: boolean = false) => {
    if (!num) return '0'
    if (isMobile) {
      if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
      if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
      if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
      return num.toFixed(0)
    }
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors text-slate-900"
    >
      {label}
      {sortField === field &&
        (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
    </button>
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <div className="w-full bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shadow-sm">
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading claims...</div>
        ) : sortedClaims.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">No claims found</div>
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
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100 !text-left">
                    <div className="flex justify-start">
                      <SortHeader field="label" label="Vault" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100" title="Market Cap">
                    <div className="flex justify-center">
                      <SortHeader field="marketCap" label="MC" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100" title="Total Assets">
                    <div className="flex justify-center">
                      <SortHeader field="totalAssets" label="TA" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100" title="Total Shares">
                    <div className="flex justify-center">
                      <SortHeader field="totalShares" label="TS" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100" title="Share Price">
                    <div className="flex justify-center">
                      <SortHeader field="currentSharePrice" label="SP" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex justify-center">
                      <SortHeader field="sharePriceChange24h" label="24h %" />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex justify-center">
                      <SortHeader field="positionCount" label="Pos." />
                    </div>
                  </th>
                  <th className="text-center py-3 px-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex justify-center">W</div>
                  </th>
                  <th className="text-center py-3 px-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex justify-center">V</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedClaims.map((claim, idx) => (
                  <tr
                    key={`vault-${idx}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    <td className="py-2 px-2 text-left">
                      <Link href={`/vault/${claim.termId}`} className="flex items-center gap-1 hover:no-underline">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleWatchClick(claim.label)
                          }}
                          className="p-1 hover:scale-125 transition-transform flex-shrink-0"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isWatched(claim.label)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-slate-300 dark:text-slate-600 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                        {claim.image && (
                          <img src={claim.image || '/placeholder.svg'} alt={claim.label} className="w-5 h-5 rounded-full flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 text-xs truncate hover:text-primary transition-colors">{claim.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{claim.subjectLabel}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-900 dark:text-slate-100 font-medium text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                        {formatNumber(claim.marketCap, true)}
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-900 dark:text-slate-100 font-medium text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                        {formatNumber(claim.totalAssets, true)}
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-900 dark:text-slate-100 font-medium text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                        {formatNumber(claim.totalShares, true)}
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-900 dark:text-slate-100 font-medium text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                        {claim.currentSharePrice ? claim.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center font-medium text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:no-underline">
                        <span className={claim.sharePriceChange24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {claim.sharePriceChange24h >= 0 ? '+' : ''}{((claim.sharePriceChange24h || 0) / 1e18).toFixed(1)}%
                        </span>
                      </Link>
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-700 dark:text-slate-300 text-xs truncate">
                      <Link href={`/vault/${claim.termId}`} className="hover:text-primary transition-colors">
                        {formatNumber(claim.positionCount, true)}
                      </Link>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleWatchClick(claim.label)
                        }}
                        className={`px-1 py-0.5 rounded text-xs font-medium transition-all whitespace-nowrap ${
                          isWatched(claim.label)
                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600'
                            : 'bg-primary hover:bg-primary/90 text-white'
                        }`}
                        title={isWatched(claim.label) ? 'Remove from watch' : 'Add to watch'}
                      >
                        {isWatched(claim.label) ? '★' : '✓'}
                      </button>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setViewClaimsOpen(true)
                        }}
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors inline-flex items-center"
                        title="View Claim Details"
                      >
                        <Eye className="w-3 h-3 text-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between py-4 px-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </>
  )
}
