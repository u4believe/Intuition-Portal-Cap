import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const pageSize = 100
    const offset = (page - 1) * pageSize

    const TRIPLES_QUERY = `
      query GetTriples($limit: Int, $offset: Int) {
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

    // Get total count
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
      queryIntuitionGraphQL(TRIPLES_QUERY, { limit: pageSize, offset }),
      queryIntuitionGraphQL(COUNT_QUERY),
    ])

    const totalCount = countData?.vaults_aggregate?.aggregate?.count || 0

    // Transform vaults into triples data, grouping by triple label
    const triplesMap = new Map<string, any>()

    ;(data?.vaults || []).forEach((vault: any) => {
      const triple = vault.term?.triple
      const subject = triple?.subject?.label || "Unknown"
      const predicate = triple?.predicate?.label || "Unknown"
      const object = triple?.object?.label || "Unknown"
      const tripleLabel = `${subject} - ${predicate} - ${object}`

      if (!triplesMap.has(tripleLabel)) {
        triplesMap.set(tripleLabel, {
          termId: vault.term?.id || "", // Use term.id since vault.id doesn't exist
          label: tripleLabel,
          subjectLabel: subject,
          predicateLabel: predicate,
          objectLabel: object,
          image: triple?.subject?.image && triple.subject.image !== 'null' ? triple.subject.image : "",
          marketCap: 0,
          totalAssets: 0,
          totalShares: 0,
          currentSharePrice: 0,
          positionCount: 0,
          sharePriceChange24h: 0,
          positions: [],
        })
      }

      const tripleData = triplesMap.get(tripleLabel)!
      tripleData.marketCap += vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
      tripleData.totalAssets += vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
      tripleData.totalShares += vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
      tripleData.currentSharePrice = Math.max(
        tripleData.currentSharePrice,
        vault.current_share_price ? parseFloat(vault.current_share_price) / 1e18 : 0
      )
      tripleData.positionCount += vault.position_count || 0

      const sharePriceChange = vault.term?.share_price_change_stats_daily?.[0]
      if (sharePriceChange) {
        const lastPrice = parseFloat(sharePriceChange.last_share_price || "0") / 1e18
        const firstPrice = parseFloat(sharePriceChange.first_share_price || "0") / 1e18
        if (firstPrice > 0) {
          tripleData.sharePriceChange24h = ((lastPrice - firstPrice) / firstPrice) * 100
        }
      }

      tripleData.positions.push(...(vault.term?.positions || []))
    })

    const triples = Array.from(triplesMap.values())
      .sort((a, b) => b.marketCap - a.marketCap)

    return NextResponse.json({ 
      triples,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      }
    })
  } catch (error) {
    console.error("[v0] Error fetching triples:", error)
    return NextResponse.json({ triples: [], error: "Failed to fetch triples" }, { status: 500 })
  }
}
