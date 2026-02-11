import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const pageSize = 100
    const offset = (page - 1) * pageSize

    const CLAIMS_QUERY = `
      query GetAllClaims($limit: Int, $offset: Int) {
        vaults(limit: $limit, offset: $offset, order_by: {market_cap: desc}) {
          market_cap
          position_count
          total_assets
          total_shares
          current_share_price
          term {
            id
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
            positions {
              account_id
              shares
              total_deposit_assets_after_total_fees
              total_redeem_assets_for_receiver
            }
            share_price_change_stats_daily {
              difference
              first_share_price
              last_share_price
              change_count
            }
          }
        }
      }
    `

    // Also get total count
    const COUNT_QUERY = `
      query GetVaultsCount {
        vaults_aggregate {
          aggregate {
            count
          }
        }
      }
    `

    const [data, countData] = await Promise.all([
      queryIntuitionGraphQL(CLAIMS_QUERY, { limit: pageSize, offset }),
      queryIntuitionGraphQL(COUNT_QUERY),
    ])

    const totalCount = countData?.vaults_aggregate?.aggregate?.count || 0

    const claims = (data?.vaults || []).map((vault: any) => {
      const triple = vault.term?.triple
      const subject = triple?.subject?.label || "Unknown"
      const predicate = triple?.predicate?.label || "Unknown"
      const object = triple?.object?.label || "Unknown"

      const marketCap = vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
      const totalAssets = vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
      const totalShares = vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
      const currentSharePrice = vault.current_share_price ? parseFloat(vault.current_share_price) / 1e18 : 0

      let sharePriceChange24h = 0
      const sharePriceChange = vault.term?.share_price_change_stats_daily?.[0]
      if (sharePriceChange) {
        const lastPrice = parseFloat(sharePriceChange.last_share_price || "0") / 1e18
        const firstPrice = parseFloat(sharePriceChange.first_share_price || "0") / 1e18
        if (firstPrice > 0) {
          sharePriceChange24h = ((lastPrice - firstPrice) / firstPrice) * 100
        }
      }

      return {
        termId: vault.term?.id || "",
        label: `${subject} - ${predicate} - ${object}`,
        type: "Triple",
        image: triple?.subject?.image || null,
        subjectLabel: subject,
        subjectType: "",
        predicateLabel: predicate,
        predicateType: "",
        objectLabel: object,
        objectType: "",
        marketCap,
        totalAssets,
        totalShares,
        currentSharePrice,
        positionCount: vault.position_count || 0,
        sharePriceChange24h,
        deposits: [],
        redemptions: [],
        positions: (vault.term?.positions || []).map((pos: any) => ({
          accountId: pos.account_id,
          shares: pos.shares ? parseFloat(pos.shares) / 1e18 : 0,
          totalDepositAssetsAfterTotalFees: pos.total_deposit_assets_after_total_fees ? parseFloat(pos.total_deposit_assets_after_total_fees) / 1e18 : 0,
          totalRedeemAssetsForReceiver: pos.total_redeem_assets_for_receiver ? parseFloat(pos.total_redeem_assets_for_receiver) / 1e18 : 0,
        })),
      }
    })

    return NextResponse.json({ 
      claims,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      }
    })
  } catch (error) {
    console.error("[v0] Error fetching claims:", error)
    return NextResponse.json({ claims: [] })
  }
}
