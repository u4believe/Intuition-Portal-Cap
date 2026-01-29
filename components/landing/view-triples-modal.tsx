'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

interface ViewTriplesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripleLabel: string
}

const VIEW_TRIPLES_QUERY = `
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
        type
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

export function ViewTriplesModal({ open, onOpenChange, tripleLabel }: ViewTriplesModalProps) {
  const [triplesData, setTriplesData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchTriplesData()
    }
  }, [open, tripleLabel])

  const fetchTriplesData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query = `
        query GetTriples {
          vaults(limit: 100, order_by: {market_cap: desc}) {
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
              type
            }
            market_cap
            total_assets
            total_shares
            current_share_price
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
          }
        }
      `

      const result = await queryIntuitionGraphQL(query)
      if (result && result.vaults) {
        setTriplesData(result.vaults)
      } else {
        setError('No data available')
      }
    } catch (err) {
      console.error('Error fetching triples data:', err)
      setError('Failed to fetch triples data')
    } finally {
      setIsLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 flex items-center justify-between p-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Triple Details</h2>
            <p className="text-sm text-slate-600 mt-1">{tripleLabel}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-600">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-600">{error}</div>
            </div>
          ) : triplesData.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-600">No data available</div>
            </div>
          ) : (
            <>
              {/* Market Statistics */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Market Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-600">Average Market Cap</div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${triplesData.reduce((sum, v) => sum + (v.market_cap || 0), 0) / triplesData.length}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-600">Total Assets</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {triplesData.reduce((sum, v) => sum + (v.total_assets || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-slate-600">Total Shares</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {triplesData.reduce((sum, v) => sum + (v.total_shares || 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Positions Table */}
              {triplesData.some((v) => v.positions?.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Positions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Account</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-900">Shares</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-900">Deposit Assets</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-900">Redeem Assets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {triplesData.flatMap((vault) =>
                          vault.positions?.map((pos: any, idx: number) => (
                            <tr key={`${vault.market_cap}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono text-xs text-slate-700">{pos.account_id.slice(0, 10)}...</td>
                              <td className="py-3 px-4 text-right text-slate-900">{(pos.shares || 0).toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-slate-900">
                                ${(pos.total_deposit_assets_after_total_fees || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-900">
                                ${(pos.total_redeem_assets_for_receiver || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Deposits Table */}
              {triplesData.some((v) => v.deposits?.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Deposits</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Date</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-900">Shares</th>
                        </tr>
                      </thead>
                      <tbody>
                        {triplesData.flatMap((vault) =>
                          vault.deposits?.map((dep: any, idx: number) => (
                            <tr key={`dep-${vault.market_cap}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4 text-slate-900">
                                {new Date(dep.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-900">{(dep.shares || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Redemptions Table */}
              {triplesData.some((v) => v.redemptions?.length > 0) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Redemptions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Date</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-900">Shares</th>
                        </tr>
                      </thead>
                      <tbody>
                        {triplesData.flatMap((vault) =>
                          vault.redemptions?.map((red: any, idx: number) => (
                            <tr key={`red-${vault.market_cap}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4 text-slate-900">
                                {new Date(red.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-900">{(red.shares || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
