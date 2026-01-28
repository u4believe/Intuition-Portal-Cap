"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SignInPromptDialog from "./sign-in-prompt-dialog"
import ClaimsModal from "./claims-modal"

interface ClaimData {
  id: string
  label: string
  image: string
  market_cap: number
  last_share_price: number
  position_count: number
  rank: number
}

export default function TopClaimsDisplay() {
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [loading, setLoading] = useState(true)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<ClaimData | null>(null)
  const [showClaimsModal, setShowClaimsModal] = useState(false)

  useEffect(() => {
    async function fetchTopClaims() {
      try {
        const response = await fetch("/api/top-triples")
        if (!response.ok) throw new Error("Failed to fetch triples")
        const data = await response.json()
        setClaims(data.triples || [])
      } catch (error) {
        console.error("[v0] Error fetching top triples:", error)
        setClaims(generateMockClaims())
      } finally {
        setLoading(false)
      }
    }

    fetchTopClaims()
    const interval = setInterval(fetchTopClaims, 5000)
    return () => clearInterval(interval)
  }, [])

  function handleWatchClick(claim: ClaimData) {
    setSelectedClaim(claim)
    setShowSignInPrompt(true)
  }

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Card key={i} className="bg-slate-900 border-slate-700 animate-pulse">
            <CardContent className="pt-6 h-32"></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {claims.map((claim) => (
            <Card
              key={claim.id}
              className="bg-slate-900 border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer group"
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
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-white">#{claim.rank}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                          {claim.label}
                        </h3>
                        <p className="text-xs text-slate-500">{claim.position_count} positions</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Market Cap</p>
                      <p className="font-semibold text-white">
                        {(claim.market_cap ?? 0).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2,
                        })}{" "}
                        TRUST
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Last Share Price</p>
                      <p className="font-semibold text-cyan-400">
                        {(claim.last_share_price ?? 0).toLocaleString("en-US", {
                          maximumFractionDigits: 8,
                          minimumFractionDigits: 2,
                        })}{" "}
                        TRUST
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/50 bg-transparent"
                    onClick={() => handleWatchClick(claim)}
                  >
                    Watch This Claim
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View All Claims Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => setShowClaimsModal(true)}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
          >
            View All Claims & Holders
          </Button>
        </div>
      </div>

      {/* Sign-in prompt dialog */}
      <SignInPromptDialog
        isOpen={showSignInPrompt}
        onClose={() => setShowSignInPrompt(false)}
        title={`Subscribe to ${selectedClaim?.label} Alerts`}
        description={`Get instant notifications for price changes, market cap movements, and position updates for ${selectedClaim?.label}.`}
        action={`Watch ${selectedClaim?.label}`}
      />

      {/* Claims modal */}
      <ClaimsModal open={showClaimsModal} onOpenChange={setShowClaimsModal} />
    </>
  )
}

function generateMockClaims(): ClaimData[] {
  const mockLabels = [
    "AI Token",
    "DeFi Protocol",
    "Web3 Identity",
    "NFT Platform",
    "DAO Treasury",
    "Staking Service",
    "Oracle Network",
    "Bridge Protocol",
    "Governance Token",
    "Liquidity Pool",
  ]

  return mockLabels.map((label, i) => ({
    id: `claim-${i}`,
    label,
    image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${label}`,
    market_cap: 1e6 * Math.random() * 100,
    last_share_price: Math.random() * 1000,
    position_count: Math.floor(Math.random() * 10000) + 100,
    rank: i + 1,
  }))
}
