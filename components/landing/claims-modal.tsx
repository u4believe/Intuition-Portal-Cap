"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react"
import { useAllClaims } from "@/hooks/useIntuitionData"
import { useUserPreferences } from "@/hooks/useUserPreferences"
import { Button } from "@/components/ui/button"
import WatchPreferencesDialog from "@/components/watch-preferences-dialog"

interface ClaimsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SortField = "label" | "positionCount" | "lastSharePrice" | "marketCap"
type SortOrder = "asc" | "desc"

export default function ClaimsModal({ open, onOpenChange }: ClaimsModalProps) {
  const { data: claims = [], isLoading: loading } = useAllClaims()
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const [sortField, setSortField] = useState<SortField>("marketCap")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)
  const [watchDialogOpen, setWatchDialogOpen] = useState(false)
  const [selectedClaimForWatch, setSelectedClaimForWatch] = useState<string | null>(null)

  const watchedClaims = getWatchedClaims()
  const isWatched = (claimLabel: string) => watchedClaims.includes(claimLabel)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
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

  const sortedClaims = [...claims].sort((a, b) => {
    let aValue: any = a[sortField]
    let bValue: any = b[sortField]

    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase()
      bValue = (bValue as string).toLowerCase()
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1
    return 0
  })

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      {sortField === field && (
        sortOrder === "asc" ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )
      )}
    </button>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">All Claims</DialogTitle>
          </DialogHeader>

          {/* Table Container */}
          <div className="max-h-[calc(90vh-120px)] overflow-auto">
            {loading ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">Loading claims...</div>
            ) : sortedClaims.length === 0 ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">No claims found</div>
            ) : (
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700">
                  <tr>
                    <th className="text-left py-4 px-4">
                      <div className="flex justify-start">
                        <SortHeader field="label" label="Claim" />
                      </div>
                    </th>
                    <th className="text-right py-4 px-4">
                      <div className="flex justify-end">
                        <SortHeader field="positionCount" label="Positions" />
                      </div>
                    </th>
                    <th className="text-right py-4 px-4">
                      <div className="flex justify-end">
                        <SortHeader field="lastSharePrice" label="Last Share Price" />
                      </div>
                    </th>
                    <th className="text-right py-4 px-4">
                      <div className="flex justify-end">
                        <SortHeader field="marketCap" label="Market Cap" />
                      </div>
                    </th>
                    <th className="text-center py-4 px-4">
                      <div className="flex justify-center">
                        <span className="text-slate-300">Watch</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                  {sortedClaims.map((claim, idx) => (
                    <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="py-4 px-4 text-left">
                        <div className="flex justify-start">
                          <button
                            onClick={() => setExpandedClaim(expandedClaim === claim.label ? null : claim.label)}
                            className="flex items-center gap-3 group-hover:text-primary transition-colors cursor-pointer text-slate-900 dark:text-white"
                          >
                            {claim.image && (
                              <img src={claim.image || "/placeholder.svg"} alt={claim.label} className="w-8 h-8 rounded-full" />
                            )}
                            <span className="font-medium">{claim.label}</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-700 dark:text-slate-300">
                        <div className="flex justify-end">
                          {claim.positionCount.toLocaleString("en-US")}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-blue-600 dark:text-blue-400 font-medium">
                        <div className="flex justify-end">
                          {claim.lastSharePrice.toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-900 dark:text-slate-100 font-medium">
                        <div className="flex justify-end">
                          {claim.marketCap.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleWatchClick(claim.label)}
                            className={`p-2 rounded-lg transition-all ${
                              isWatched(claim.label)
                                ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-300"
                            }`}
                            title={isWatched(claim.label) ? "Watching this claim" : "Watch this claim"}
                          >
                            {isWatched(claim.label) ? (
                              <Eye className="w-5 h-5" />
                            ) : (
                              <EyeOff className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Expanded Holders Section */}
          {expandedClaim && (
            <div className="border-t border-slate-300 dark:border-slate-700 pt-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Top Holders - {expandedClaim}
              </h4>
              <div className="bg-slate-100 dark:bg-slate-800/30 rounded-lg p-4 max-h-[200px] overflow-y-auto space-y-2">
                {sortedClaims.find((c) => c.label === expandedClaim)?.holders?.length ? (
                  sortedClaims.find((c) => c.label === expandedClaim)?.holders?.map((holder: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900/50 rounded text-sm border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-700 dark:text-slate-300 font-mono">{holder.accountId?.slice(0, 6)}...{holder.accountId?.slice(-4)}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{holder.shares.toFixed(2)} shares</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-600 dark:text-slate-400 text-sm">No holders data available</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Watch Preferences Dialog */}
      <WatchPreferencesDialog
        open={watchDialogOpen}
        onOpenChange={setWatchDialogOpen}
        claimLabel={selectedClaimForWatch || ""}
        onConfirm={(claimLabel) => {
          addWatchedClaim(claimLabel)
          setWatchDialogOpen(false)
          setSelectedClaimForWatch(null)
        }}
      />
    </>
  )
}
