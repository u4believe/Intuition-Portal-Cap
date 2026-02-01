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
        <DialogContent className="max-w-7xl max-h-[90vh] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">All Claims</DialogTitle>
          </DialogHeader>

          {/* Table Container */}
          <div className="max-h-[calc(90vh-120px)] overflow-auto">
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading claims...</div>
            ) : sortedClaims.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No claims found</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="text-left py-4 px-4">
                      <SortHeader field="label" label="Claim" />
                    </th>
                    <th className="text-right py-4 px-4">
                      <SortHeader field="positionCount" label="Positions" />
                    </th>
                    <th className="text-right py-4 px-4">
                      <SortHeader field="lastSharePrice" label="Last Share Price" />
                    </th>
                    <th className="text-right py-4 px-4">
                      <SortHeader field="marketCap" label="Market Cap" />
                    </th>
                    <th className="text-center py-4 px-4">
                      <span className="text-slate-300">Watch</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sortedClaims.map((claim, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => setExpandedClaim(expandedClaim === claim.label ? null : claim.label)}
                          className="flex items-center gap-3 group-hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          {claim.image && (
                            <img src={claim.image || "/placeholder.svg"} alt={claim.label} className="w-8 h-8 rounded-full" />
                          )}
                          <span className="font-medium text-white">{claim.label}</span>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-right text-slate-300">
                        {claim.positionCount.toLocaleString("en-US")}
                      </td>
                      <td className="py-4 px-4 text-right text-primary font-medium">
                        {claim.lastSharePrice.toLocaleString("en-US", {
                          maximumFractionDigits: 8,
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-4 text-right text-white font-medium">
                        {claim.marketCap.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleWatchClick(claim.label)}
                          className={`p-2 rounded-lg transition-all ${
                            isWatched(claim.label)
                              ? "bg-primary/20 text-primary hover:bg-primary/30"
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                          }`}
                          title={isWatched(claim.label) ? "Watching this claim" : "Watch this claim"}
                        >
                          {isWatched(claim.label) ? (
                            <Eye className="w-5 h-5" />
                          ) : (
                            <EyeOff className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Expanded Holders Section */}
          {expandedClaim && (
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-sm font-semibold text-white mb-3">
                Top Holders - {expandedClaim}
              </h4>
              <div className="bg-slate-800/30 rounded-lg p-4 max-h-[200px] overflow-y-auto space-y-2">
                {sortedClaims.find((c) => c.label === expandedClaim)?.holders?.length ? (
                  sortedClaims.find((c) => c.label === expandedClaim)?.holders?.map((holder: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-900/50 rounded text-sm">
                      <span className="text-slate-300 font-mono">{holder.accountId?.slice(0, 6)}...{holder.accountId?.slice(-4)}</span>
                      <span className="text-cyan-400 font-semibold">{holder.shares.toFixed(2)} shares</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-sm">No holders data available</div>
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
