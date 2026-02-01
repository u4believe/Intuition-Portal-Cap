'use client'

import { useState } from 'react'
import { Star, ChevronUp, ChevronDown, Eye } from 'lucide-react'
import Link from 'next/link'
import { useTriples } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Button } from '@/components/ui/button'
import WatchPreferencesDialog from '@/components/watch-preferences-dialog'
import { ViewTriplesModal } from '@/components/landing/view-triples-modal'

type SortField = 'label' | 'positionCount' | 'marketCap' | 'totalAssets' | 'totalShares' | 'currentSharePrice' | 'sharePriceChange24h' | 'type'
type SortOrder = 'asc' | 'desc'

export default function TriplesTable() {
  const { data: triples = [], isLoading: loading } = useTriples(1000)
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
      className="flex items-center gap-1 hover:text-primary transition-colors text-slate-900"
    >
      {label}
      {sortField === field &&
        (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
    </button>
  )

  return (
    <>
      <div className="w-full bg-white border-t border-b border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading triples...</div>
        ) : sortedTriples.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No triples found</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="label" label="Triple" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="type" label="Type" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="marketCap" label="Market Cap" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="totalAssets" label="Total Assets" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="totalShares" label="Total Shares" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="currentSharePrice" label="Share Price" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="sharePriceChange24h" label="24h %" />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    <SortHeader field="positionCount" label="Pos." />
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    Watch
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-900">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedTriples.map((triple, idx) => (
                  <tr
                    key={`triple-${idx}`}
                    className="hover:bg-slate-50 transition-colors group border-b border-slate-200 cursor-pointer"
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
                                : 'text-slate-300 hover:text-yellow-400'
                            }`}
                          />
                        </button>
                        {triple.image && (
                          <img src={triple.image || '/placeholder.svg'} alt={triple.label} className="w-5 h-5 rounded-full flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 text-xs truncate hover:text-teal-600 transition-colors">{triple.label}</p>
                          <p className="text-xs text-slate-500 truncate">{triple.subjectLabel}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Link href={`/vault/${triple.termId}`} className="hover:no-underline flex justify-center">
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors truncate">
                          {triple.type}
                        </span>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-900 font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-teal-600 transition-colors">
                        {triple.marketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-900 font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-teal-600 transition-colors">
                        {triple.totalAssets.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-900 font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-teal-600 transition-colors">
                        {triple.totalShares.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-900 font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-teal-600 transition-colors">
                        {triple.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center font-medium text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:no-underline">
                        <span className={triple.sharePriceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {triple.sharePriceChange24h >= 0 ? '+' : ''}{(triple.sharePriceChange24h / 1e18).toFixed(2)}%
                        </span>
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700 text-xs truncate">
                      <Link href={`/vault/${triple.termId}`} className="hover:text-teal-600 transition-colors">
                        {triple.positionCount.toLocaleString('en-US')}
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
                            : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700'
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
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1"
                        title="View Triple Details"
                      >
                        <Eye className="w-4 h-4 text-teal-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
