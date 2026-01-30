'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { useAllClaims } from '@/hooks/useIntuitionData'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { Button } from '@/components/ui/button'

export default function VaultDetailsPage({ params }: { params: { id: string } }) {
  const { data: claims = [], isLoading } = useAllClaims(1000)
  const { getWatchedClaims, addWatchedClaim, removeWatchedClaim } = useUserPreferences()
  const [claim, setClaim] = useState<any>(null)

  useEffect(() => {
    const foundClaim = claims.find((c) => c.termId === params.id)
    setClaim(foundClaim)
  }, [claims, params.id])

  const watchedClaims = getWatchedClaims()
  const isWatched = claim ? watchedClaims.includes(claim.label) : false

  const handleWatchClick = () => {
    if (claim) {
      if (isWatched) {
        removeWatchedClaim(claim.label)
      } else {
        addWatchedClaim(claim.label, 'PROFIT')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-6xl mx-auto text-center text-slate-500">
          Loading vault details...
        </div>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2 mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="text-center text-slate-500">Vault not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 sticky top-0 z-50 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Vaults
            </Button>
          </Link>
          <button
            onClick={handleWatchClick}
            className="p-2 hover:scale-125 transition-transform"
          >
            <Star
              className={`w-6 h-6 ${
                isWatched ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300 hover:text-yellow-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Vault Header */}
        <div className="flex items-center gap-6 pb-6 border-b border-slate-200">
          {claim.image && (
            <img src={claim.image || "/placeholder.svg"} alt={claim.label} className="w-16 h-16 rounded-full" />
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-slate-900">{claim.label}</h1>
            <p className="text-slate-600 mt-1">Term ID: {claim.termId}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              {claim.type}
            </span>
          </div>
        </div>

        {/* Triple Information */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Triple Information</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Subject</p>
              <p className="text-lg font-semibold text-slate-900">{claim.subjectLabel}</p>
              <p className="text-xs text-slate-500 mt-2">Type: {claim.subjectType}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Predicate</p>
              <p className="text-lg font-semibold text-slate-900">{claim.predicateLabel}</p>
              <p className="text-xs text-slate-500 mt-2">Type: {claim.predicateType}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Object</p>
              <p className="text-lg font-semibold text-slate-900">{claim.objectLabel}</p>
              <p className="text-xs text-slate-500 mt-2">Type: {claim.objectType}</p>
            </div>
          </div>
        </div>

        {/* Market Statistics */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Market Statistics</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Market Cap (TRUST)</p>
              <p className="text-3xl font-bold text-slate-900">
                {claim.marketCap.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Total Assets (TRUST)</p>
              <p className="text-3xl font-bold text-slate-900">
                {claim.totalAssets.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Total Shares</p>
              <p className="text-3xl font-bold text-slate-900">
                {claim.totalShares.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Current Share Price (TRUST)</p>
              <p className="text-3xl font-bold text-slate-900">
                {claim.currentSharePrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">Positions</p>
              <p className="text-3xl font-bold text-slate-900">
                {claim.positionCount.toLocaleString('en-US')}
              </p>
            </div>
            <div className={`bg-gradient-to-br p-6 rounded-lg border ${
              claim.sharePriceChange24h >= 0
                ? 'from-green-50 to-green-100 border-green-200'
                : 'from-red-50 to-red-100 border-red-200'
            }`}>
              <p className="text-sm text-slate-600 mb-2">Share Price Change (24h)</p>
              <p className={`text-3xl font-bold ${claim.sharePriceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {claim.sharePriceChange24h >= 0 ? '+' : ''}{(claim.sharePriceChange24h / 1e18).toFixed(3)}%
              </p>
            </div>
          </div>
        </div>

        {/* Deposits Section */}
        {claim.deposits && claim.deposits.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Deposits ({claim.deposits.length})</h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Deposit ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claim.deposits.map((deposit: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">
                          {deposit.id.slice(0, 12)}...{deposit.id.slice(-8)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-teal-600">
                          {deposit.shares.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(deposit.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Redemptions Section */}
        {claim.redemptions && claim.redemptions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Redemptions ({claim.redemptions.length})</h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Redemption ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claim.redemptions.map((redemption: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">
                          {redemption.id.slice(0, 12)}...{redemption.id.slice(-8)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-600">
                          {redemption.shares.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(redemption.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Positions Section */}
        {claim.positions && claim.positions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Positions ({claim.positions.length})</h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Account Address</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Deposit Assets After Total Fees (TRUST)</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Redeem Assets For Receiver (TRUST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claim.positions.map((position: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-slate-700 break-all">
                          <span title={position.accountId} className="cursor-help">
                            {position.accountId.slice(0, 12)}...{position.accountId.slice(-10)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">
                          {position.shares.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-teal-600 font-semibold text-center">
                          {position.totalDepositAssetsAfterTotalFees.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-orange-600 font-semibold text-center">
                          {position.totalRedeemAssetsForReceiver.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
