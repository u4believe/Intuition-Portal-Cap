import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get("limit") || "1000")

    const ATOMS_QUERY = `
      query GetAtoms($limit: Int) {
        vaults(limit: $limit, order_by: {market_cap: desc}) {
          market_cap
          position_count
          total_shares
          total_assets
          current_share_price
          term {
            atom {
              label
              image
              positions {
                account_id
                shares
                total_deposit_assets_after_total_fees
                total_redeem_assets_for_receiver
              }
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

    const data = await queryIntuitionGraphQL(ATOMS_QUERY, { limit })

    // Transform vaults into atoms data, grouping by atom label
    const atomsMap = new Map<string, any>()

    ;(data?.vaults || []).forEach((vault: any) => {
      const atom = vault.term?.atom
      const atomLabel = atom?.label || "Unknown"

      if (!atomsMap.has(atomLabel)) {
        atomsMap.set(atomLabel, {
          label: atomLabel,
          image: atom?.image || "",
          marketCap: 0,
          totalAssets: 0,
          totalShares: 0,
          currentSharePrice: 0,
          positionCount: 0,
          sharePriceChange24h: 0,
          positions: [],
        })
      }

      const atomData = atomsMap.get(atomLabel)!
      atomData.marketCap += vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
      atomData.totalAssets += vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
      atomData.totalShares += vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
      atomData.currentSharePrice = Math.max(
        atomData.currentSharePrice,
        vault.current_share_price ? parseFloat(vault.current_share_price) / 1e18 : 0
      )
      atomData.positionCount += vault.position_count || 0

      const sharePriceChange = vault.term?.share_price_change_stats_daily?.[0]
      if (sharePriceChange) {
        const lastPrice = parseFloat(sharePriceChange.last_share_price || "0") / 1e18
        const firstPrice = parseFloat(sharePriceChange.first_share_price || "0") / 1e18
        if (firstPrice > 0) {
          atomData.sharePriceChange24h = ((lastPrice - firstPrice) / firstPrice) * 100
        }
      }

      atomData.positions.push(...(atom?.positions || []))
    })

    const atoms = Array.from(atomsMap.values())
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 100)

    return NextResponse.json({ atoms })
  } catch (error) {
    console.error("[v0] Error fetching atoms:", error)
    return NextResponse.json({ atoms: [], error: "Failed to fetch atoms" }, { status: 500 })
  }
}
