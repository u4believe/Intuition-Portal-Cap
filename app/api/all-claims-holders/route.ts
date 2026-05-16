import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const CLAIMS_FIELDS = `
  position_count
  total_assets
  total_shares
  current_share_price
  term {
    id
    total_market_cap
    triple {
      term_id
      counter_term_id
      subject { label image }
      predicate { label }
      object { label }
    }
    vaults {
      curve_id
      current_share_price
      market_cap
    }
    share_price_change_stats_daily(order_by: { bucket: desc }, limit: 1) {
      bucket
      first_share_price
      last_share_price
    }
  }
`

// Filter to Lin vaults only (curve_id=1) so each triple appears once.
// Atom vaults dominate market_cap without the triple filter — zero claims would load.
const CLAIMS_BROWSE_QUERY = `
  query GetAllClaims($limit: Int, $offset: Int) {
    vaults(
      limit: $limit
      offset: $offset
      where: {
        term: { triple: { subject: { label: { _is_null: false } } } }
        curve_id: { _eq: 1 }
      }
      order_by: { market_cap: desc_nulls_last }
    ) {
      ${CLAIMS_FIELDS}
    }
  }
`

const CLAIMS_SEARCH_QUERY = `
  query SearchClaims($search: String!, $limit: Int) {
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
        curve_id: { _eq: 1 }
      }
      limit: $limit
      order_by: { market_cap: desc_nulls_last }
    ) {
      ${CLAIMS_FIELDS}
    }
  }
`

const CLAIMS_COUNT_QUERY = `
  query GetClaimsCount {
    triples_aggregate {
      aggregate { count }
    }
  }
`

const CLAIMS_SEARCH_COUNT_QUERY = `
  query SearchClaimsCount($search: String!) {
    triples_aggregate(
      where: {
        _or: [
          { subject: { label: { _ilike: $search } } }
          { predicate: { label: { _ilike: $search } } }
          { object: { label: { _ilike: $search } } }
        ]
      }
    ) {
      aggregate { count }
    }
  }
`

function mapClaim(vault: any) {
  const triple = vault.term?.triple
  const subject = triple?.subject?.label || "Unknown"
  const predicate = triple?.predicate?.label || "Unknown"
  const object = triple?.object?.label || "Unknown"
  const totalMarketCap = vault.term?.total_market_cap ? parseFloat(vault.term.total_market_cap) / 1e18 : 0
  const totalAssets = vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
  const totalShares = vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0

  const termVaults: any[] = vault.term?.vaults || []
  const linVault = termVaults.find((tv: any) => Number(tv.curve_id) === 1) ?? null
  const expVault = termVaults.find((tv: any) => Number(tv.curve_id) === 2) ?? null
  const sharePriceLin = linVault?.current_share_price ? parseFloat(linVault.current_share_price) / 1e18 : 0
  const sharePriceExp = expVault?.current_share_price ? parseFloat(expVault.current_share_price) / 1e18 : 0
  const marketCap = linVault?.market_cap ? parseFloat(linVault.market_cap) / 1e18 : 0

  const latestActivity = vault.term?.share_price_change_stats_daily?.[0]?.bucket ?? null

  let sharePriceChange24h = 0
  const spc = vault.term?.share_price_change_stats_daily?.[0]
  if (spc) {
    const last = parseFloat(spc.last_share_price || "0") / 1e18
    const first = parseFloat(spc.first_share_price || "0") / 1e18
    if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
  }

  return {
    termId: triple?.term_id || vault.term?.id || "",
    opposeTermId: triple?.counter_term_id || "",
    label: `${subject} - ${predicate} - ${object}`,
    type: "Triple",
    image: triple?.subject?.image && triple.subject.image !== "null" ? triple.subject.image : null,
    subjectLabel: subject,
    subjectType: "",
    predicateLabel: predicate,
    predicateType: "",
    objectLabel: object,
    objectType: "",
    marketCap,
    totalMarketCap,
    totalAssets,
    totalShares,
    sharePriceLin,
    sharePriceExp,
    positionCount: vault.position_count || 0,
    sharePriceChange24h,
    latestActivity,
    deposits: [],
    redemptions: [],
    positions: [],
    triplePositions: [],
  }
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
        queryIntuitionGraphQL(CLAIMS_SEARCH_QUERY, vars),
        queryIntuitionGraphQL(CLAIMS_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(CLAIMS_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(CLAIMS_COUNT_QUERY, {}),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    }

    const claims = vaultsData
      .filter((v: any) => v.term?.triple)
      .map(mapClaim)
      .sort((a: any, b: any) => {
        if (a.latestActivity && b.latestActivity) return b.latestActivity.localeCompare(a.latestActivity)
        if (a.latestActivity) return -1
        if (b.latestActivity) return 1
        return b.totalMarketCap - a.totalMarketCap
      })

    return NextResponse.json({
      claims,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[all-claims-holders] Error fetching claims:", error)
    return NextResponse.json({ claims: [], error: "Failed to fetch claims" }, { status: 500 })
  }
}
