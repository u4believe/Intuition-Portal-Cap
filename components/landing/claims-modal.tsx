"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronDown } from "lucide-react"

interface Holder {
  accountId: string
  shares: number
}

interface Claim {
  label: string
  image: string | null
  marketCap: number
  positionCount: number
  lastSharePrice: number
  holders: Holder[]
}

interface ClaimsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ClaimsModal({ open, onOpenChange }: ClaimsModalProps) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const fetchClaims = async () => {
      try {
        const response = await fetch("/api/all-claims-holders")
        const data = await response.json()
        setClaims(data.claims || [])
      } catch (error) {
        console.error("[v0] Error fetching claims:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchClaims()
  }, [open])

  const shortenAddress = (address: string) => {
    if (!address) return "Unknown"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">All Claims & Holders</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[calc(90vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading claims...</div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No claims found</div>
          ) : (
            claims.map((claim, idx) => (
              <div key={idx} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                {/* Claim Header */}
                <button
                  onClick={() => setExpandedClaim(expandedClaim === claim.label ? null : claim.label)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {claim.image && (
                      <img src={claim.image || "/placeholder.svg"} alt={claim.label} className="w-8 h-8 rounded-full flex-shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <p className="text-white font-medium truncate">{claim.label}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{claim.positionCount} positions</span>
                        <span>•</span>
                        <span className="text-cyan-400">{claim.marketCap.toFixed(2)}T TRUST</span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                      expandedClaim === claim.label ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Holders List */}
                {expandedClaim === claim.label && (
                  <div className="border-t border-slate-700 bg-slate-800/50">
                    <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                      {claim.holders.length === 0 ? (
                        <div className="text-sm text-slate-400">No holders found</div>
                      ) : (
                        <div className="space-y-2">
                          {claim.holders.map((holder, holderIdx) => (
                            <div key={holderIdx} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                              <span className="text-xs text-slate-300 font-mono">{shortenAddress(holder.accountId)}</span>
                              <span className="text-xs text-cyan-400 font-semibold">{holder.shares.toFixed(2)} shares</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
