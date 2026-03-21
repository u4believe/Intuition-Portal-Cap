import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const TRIPLES_FIELDS = `
  market_cap
  position_count
  total_assets
  total_shares
  current_share_price
  term {
    id
    vaults {
      position_count
      current_share_price
    }
    triple {
      subject { label image }
      predicate { label }
      object { label }
      counter_term {
        type
        vaults {
          total_shares
          market_cap
          total_assets
          position_count
          current_share_price
          share_price_change_stats_daily {
            difference
            first_share_price
            last_share_price
            change_count
          }
        }
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
`

const TRIPLES_BROWSE_QUERY = `
  query GetTriples($limit: Int, $offset: Int) {
    vaults(
      limit: $limit
      offset: $offset
      order_by: { market_cap: desc }
    ) {
      ${TRIPLES_FIELDS}
    }
  }
`

const TRIPLES_SEARCH_QUERY = `
  query SearchTriples($search: String!, $limit: Int) {
    vaults(
      where: {
        term: {
          triple: {
            _or: [
              { subject: { label: { _ilike: $search } } }
              { predicate: { label: { _ilike: $search } } }
              { object: { label: { _ilike: $search } } }
            ]
          }
        }
      }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      ${TRIPLES_FIELDS}
    }
  }
`

const TRIPLES_COUNT_QUERY = `
  query GetTriplesCount {
    vaults_aggregate {
      aggregate { count }
    }
  }
`

const TRIPLES_SEARCH_COUNT_QUERY = `
  query SearchTriplesCount($search: String!) {
    vaults_aggregate(
      where: {
        term: {
          triple: {
            _or: [
              { subject: { label: { _ilike: $search } } }
              { predicate: { label: { _ilike: $search } } }
              { object: { label: { _ilike: $search } } }
            ]
          }
        }
      }
    ) {
      aggregate { count }
    }
  }
`

function buildTriples(vaults: any[]) {
  const triplesMap = new Map<string, any>()
  for (const vault of vaults) {
    const triple = vault.term?.triple
    if (!triple) continue
    const subject = triple.subject?.label || "Unknown"
    const predicate = triple.predicate?.label || "Unknown"
    const object = triple.object?.label || "Unknown"
    const key = `${subject} - ${predicate} - ${object}`
    if (!triplesMap.has(key)) {
      triplesMap.set(key, {
        termId: vault.term?.id || "",
        label: key,
        subjectLabel: subject,
        predicateLabel: predicate,
        objectLabel: object,
        image: triple.subject?.image && triple.subject.image !== "null" ? triple.subject.image : "",
        marketCap: 0,
        totalAssets: 0,
        totalShares: 0,
        currentSharePrice: 0,
        positionCount: 0,
        sharePriceChange24h: 0,
        positions: [],
        opposeMarketCap: 0,
        opposeTotalAssets: 0,
        opposeTotalShares: 0,
        opposeSharePrice: 0,
        opposePositionCount: 0,
        opposeSharePriceChange24h: 0,
        hasOppose: false,
      })
    }
    const d = triplesMap.get(key)!
    d.marketCap += vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
    d.totalAssets += vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
    d.totalShares += vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
    // Sum position_count and share price across all term vaults (Linear + Exponential) for the support side
    const termVaults: any[] = vault.term?.vaults || []
    if (termVaults.length > 0) {
      d.positionCount = termVaults.reduce((sum: number, tv: any) => sum + (tv.position_count || 0), 0)
      d.currentSharePrice = termVaults.reduce((sum: number, tv: any) => sum + (tv.current_share_price ? parseFloat(tv.current_share_price) / 1e18 : 0), 0)
    }
    const spc = vault.term?.share_price_change_stats_daily?.[0]
    if (spc) {
      const last = parseFloat(spc.last_share_price || "0") / 1e18
      const first = parseFloat(spc.first_share_price || "0") / 1e18
      if (first > 0) d.sharePriceChange24h = ((last - first) / first) * 100
    }
    d.positions.push(...(vault.term?.positions || []))

    // Aggregate counter_term (oppose) vault data
    const counterVaults: any[] = triple.counter_term?.vaults || []
    if (counterVaults.length > 0) {
      d.hasOppose = true
      for (const cv of counterVaults) {
        d.opposeMarketCap += cv.market_cap ? parseFloat(cv.market_cap) / 1e18 : 0
        d.opposeTotalAssets += cv.total_assets ? parseFloat(cv.total_assets) / 1e18 : 0
        d.opposeTotalShares += cv.total_shares ? parseFloat(cv.total_shares) / 1e18 : 0
        d.opposeSharePrice += cv.current_share_price ? parseFloat(cv.current_share_price) / 1e18 : 0
        d.opposePositionCount += cv.position_count || 0
        const cspc = cv.share_price_change_stats_daily?.[0]
        if (cspc) {
          const last = parseFloat(cspc.last_share_price || "0") / 1e18
          const first = parseFloat(cspc.first_share_price || "0") / 1e18
          if (first > 0) d.opposeSharePriceChange24h = ((last - first) / first) * 100
        }
      }
    }
  }
  return Array.from(triplesMap.values()).sort((a, b) => b.marketCap - a.marketCap)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const search = url.searchParams.get("search")?.trim() || ""
    const pageSize = search ? 200 : 100
    const offset = (page - 1) * pageSize

    let vaultsData: any[]
    let totalCount = 0

    if (search) {
      const vars = { search: `%${search}%`, limit: pageSize }
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(TRIPLES_SEARCH_QUERY, vars),
        queryIntuitionGraphQL(TRIPLES_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.vaults_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(TRIPLES_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(TRIPLES_COUNT_QUERY, {}),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.vaults_aggregate?.aggregate?.count || 0
    }

    const triples = buildTriples(vaultsData)

    return NextResponse.json({
      triples,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[v0] Error fetching triples:", error)
    return NextResponse.json({ triples: [], error: "Failed to fetch triples" }, { status: 500 })
  }
}
