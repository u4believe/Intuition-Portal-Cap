"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTopClaims } from "@/hooks/useIntuitionData"
import ClaimsModal from "./claims-modal"
import SignInPromptDialog from "./sign-in-prompt-dialog"

export default function TopClaimsDisplay() {
  const { data: claims = [], isLoading: loading } = useTopClaims()
  const [showClaimsModal, setShowClaimsModal] = useState(false)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false) // Declare showSignInPrompt
  const [selectedClaim, setSelectedClaim] = useState(null) // Declare selectedClaim

  const handleWatchClick = (claim) => {
    setSelectedClaim(claim)
    setShowSignInPrompt(true)
  } // Declare handleWatchClick function

  return (
    <>
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-slate-900 border-slate-700 animate-pulse">
                <CardContent className="pt-6 h-32"></CardContent>
              </Card>
            ))
          ) : claims.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-400">No claims found</div>
          ) : (
            claims.map((claim, idx) => (
              <Card
                key={idx}
                className="bg-slate-900 border-slate-700 hover:border-primary/50 transition-colors cursor-pointer group"
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3 flex-1">
                        {claim.image ? (
                          <img
                            src={claim.image || "/placeholder.svg"}
                            alt={claim.label}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">#{idx + 1}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white group-hover:text-primary transition-colors truncate">
                            {claim.label}
                          </h3>
                          <p className="text-xs text-slate-500">{claim.positionCount} positions</p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Market Cap</p>
                        <p className="font-semibold text-white">
                          {claim.marketCap.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}{" "}
                          TRUST
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Last Share Price</p>
                        <p className="font-semibold text-primary">
                          {claim.lastSharePrice.toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                            minimumFractionDigits: 2,
                          })}{" "}
                          TRUST
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* View All Claims Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => setShowClaimsModal(true)}
            className="bg-primary hover:bg-primary/90"
          >
            View All Claims & Holders
          </Button>
        </div>
      </div>

      {/* Claims modal */}
      <ClaimsModal open={showClaimsModal} onOpenChange={setShowClaimsModal} />

      {/* Sign In Prompt Dialog */}
      <SignInPromptDialog
        isOpen={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        title={`Subscribe to ${selectedClaim?.label || 'Claim'} Alerts`}
        description={`Get instant notifications about market cap changes, price movements, and position updates for ${selectedClaim?.label || 'this claim'}.`}
        action={`Watch ${selectedClaim?.label || 'This Claim'}`}
      />
    </>
  )
}
