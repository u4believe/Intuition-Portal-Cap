'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

interface ViewClaimsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  claimLabel: string
}

interface VaultData {
  market_cap?: number
  total_assets?: number
  total_shares?: number
  current_share_price?: number
  share_price_change_stats_daily?: {
    difference?: number
    first_share_price?: number
    last_share_price?: number
    change_count?: number
  }
  deposits?: Array<{
    id: string
    created_at: string
    shares: number
  }>
  redemptions?: Array<{
    id: string
    created_at: string
    shares: number
  }>
  term?: {
    triple?: {
      subject?: {
        label?: string
        image?: string
      }
      predicate?: {
        label?: string
      }
      object?: {
        label?: string
      }
    }
  }
  positions?: Array<{
    account_id?: string
    shares?: number
    total_deposit_assets_after_total_fees?: number
    total_redeem_assets_for_receiver?: number
  }>
}

const VIEW_CLAIMS_QUERY = `
  subscription Term {
    vaults {
      term {
        triple {
          subject {
            label
            image
          }
          predicate {
            label
          }
          object {
            label
          }
        }
      }
      market_cap
      total_assets
      total_shares
      positions {
        account_id
        shares
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
      }
      deposits {
        id
        created_at
        shares
      }
      redemptions {
        id
        created_at
        shares
      }
      share_price_change_stats_daily {
        difference
        first_share_price
        last_share_price
        change_count
      }
      current_share_price
    }
  }
`

export function ViewClaimsModal({ open, onOpenChange, claimLabel }: ViewClaimsModalProps) {
  const [claimsData, setClaimsData] = useState<VaultData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchClaimsData()
    }
  }, [open, claimLabel])

  const fetchClaimsData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query = `
        query GetClaims {
          vaults(limit: 100, order_by: {market_cap: desc}) {
            market_cap
            total_assets
            total_shares
            current_share_price
            share_price_change_stats_daily {
              difference
              first_share_price
              last_share_price
              change_count
            }
            deposits(limit: 10) {
              id
              created_at
              shares
            }
            redemptions(limit: 10) {
              id
              created_at
              shares
            }
            term {
              triple {
                subject {
                  label
                  image
                }
                predicate {
                  label
                }
                object {
                  label
                }
              }
            }
            positions {
              account_id
              shares
              total_deposit_assets_after_total_fees
              total_redeem_assets_for_receiver
            }
          }
        }
      `
      
      const result = await queryIntuitionGraphQL(query)
      if (result?.data?.vaults) {
        setClaimsData(result.data.vaults)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch claims data')
    } finally {
      setIsLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Claims Details - {claimLabel}</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {isLoading && <div className="text-center text-slate-500">Loading claims data...</div>}

          {error && <div className="text-center text-red-600">{error}</div>}

          {!isLoading && !error && claimsData.length > 0 && (
            <>
              {/* Market Statistics */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Market Statistics</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">Average Market Cap</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(claimsData.reduce((sum, c) => sum + (c.market_cap || 0), 0) / claimsData.length).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">Average Total Assets</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(claimsData.reduce((sum, c) => sum + (c.total_assets || 0), 0) / claimsData.length).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">Average Total Shares</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(claimsData.reduce((sum, c) => sum + (c.total_shares || 0), 0) / claimsData.length).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              {claimsData.some((c) => c.positions && c.positions.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">All Positions</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Claim</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Account Address</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Deposit Assets (TRUST)</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Redeem Assets (TRUST)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimsData.flatMap((claim) =>
                            (claim.positions || []).map((position: any, idx: number) => (
                              <tr key={`${claim.term?.triple?.subject?.label}-${idx}`} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                  {claim.term?.triple?.subject?.label}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-700 break-all">
                                  <span title={position.account_id} className="cursor-help">
                                    {position.account_id.slice(0, 12)}...{position.account_id.slice(-10)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-center">
                                  {parseFloat(position.shares).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-teal-600 font-semibold text-center">
                                  {parseFloat(position.total_deposit_assets_after_total_fees).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-orange-600 font-semibold text-center">
                                  {parseFloat(position.total_redeem_assets_for_receiver).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposits Table */}
              {claimsData.some((c) => c.deposits && c.deposits.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">Recent Deposits</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Claim</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Deposit ID</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimsData.flatMap((claim) =>
                            (claim.deposits || []).map((deposit: any, idx: number) => (
                              <tr key={`${claim.term?.triple?.subject?.label}-dep-${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                  {claim.term?.triple?.subject?.label}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-700">
                                  {deposit.id.slice(0, 12)}...{deposit.id.slice(-8)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-teal-600 text-center">
                                  {parseFloat(deposit.shares).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {new Date(deposit.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Redemptions Table */}
              {claimsData.some((c) => c.redemptions && c.redemptions.length > 0) && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900">Recent Redemptions</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Claim</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Redemption ID</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-900">Shares</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-900">Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {claimsData.flatMap((claim) =>
                            (claim.redemptions || []).map((redemption: any, idx: number) => (
                              <tr key={`${claim.term?.triple?.subject?.label}-red-${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                  {claim.term?.triple?.subject?.label}
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-slate-700">
                                  {redemption.id.slice(0, 12)}...{redemption.id.slice(-8)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-red-600 text-center">
                                  {parseFloat(redemption.shares).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {new Date(redemption.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!isLoading && !error && claimsData.length === 0 && (
            <div className="text-center text-slate-500">No claims data available</div>
          )}
        </div>
      </div>
    </div>
  )
}
