import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const search = url.searchParams.get("search")?.trim() || ""
    const pageSize = search ? 200 : 100
    const offset = search ? 0 : (page - 1) * pageSize

    const whereClause = search
      ? `, where: { term: { triple: { _or: [ { subject: { label: { _ilike: $search } } }, { predicate: { label: { _ilike: $search } } }, { object: { label: { _ilike: $search } } } ] } } }`
      : ""
    const queryVars = search
      ? `$limit: Int, $offset: Int, $search: String`
      : `$limit: Int, $offset: Int`

    const TRIPLES_QUERY = `
      query GetTriples(${queryVars}) {
        vaults(limit: $limit, offset: $offset, order_by: {market_cap: desc}${whereClause}) {
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

    const countWhere = search
      ? `, where: { term: { triple: { _or: [ { subject: { label: { _ilike: $search } } }, { predicate: { label: { _ilike: $search } } }, { object: { label: { _ilike: $search } } } ] } } }`
      : ""
    const countVars = search ? `($search: String)` : ""

    const COUNT_QUERY = `
      query GetVaultsCount${countVars} {
        vaults_aggregate${countWhere} {
          aggregate {
            count
          }
        }
      }
    `

    const variables: Record<string, any> = { limit: pageSize, offset }
    if (search) variables.search = `%${search}%`

    const [data, countData] = await Promise.all([
      queryIntuitionGraphQL(TRIPLES_QUERY, variables),
      queryIntuitionGraphQL(COUNT_QUERY, search ? { search: `%${search}%` } : {}),
    ])

    const totalCount = countData?.vaults_aggregate?.aggregate?.count || 0

    const triplesMap = new Map<string, any>()

    ;(data?.vaults || []).forEach((vault: any) => {
      const triple = vault.term?.triple
      if (!triple) return
      const subject = triple?.subject?.label || "Unknown"
      const predicate = triple?.predicate?.label || "Unknown"
      const object = triple?.object?.label || "Unknown"
      const tripleLabel = `${subject} - ${predicate} - ${object}`

      if (!triplesMap.has(tripleLabel)) {
        triplesMap.set(tripleLabel, {
          termId: vault.term?.id || "",
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
