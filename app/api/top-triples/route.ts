import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const TERM_VAULT_FIELDS = `
  curve_id
  position_count
  current_share_price
  total_shares
  market_cap
`

const TERM_STATS_FIELDS = `
  id
  total_market_cap
  total_assets
  vaults {
    ${TERM_VAULT_FIELDS}
  }
  share_price_change_stats_daily(order_by: { bucket: desc }, limit: 14) {
    bucket
    curve_id
    first_share_price
    last_share_price
  }
`

// Browse: query Lin vaults of triples ordered by market_cap desc.
// vaults(order_by: market_cap: desc) with triple filter is ~1s vs. triples(order_by: term.total_market_cap) which times out.
const TRIPLES_BROWSE_QUERY = `
  query GetTriples($limit: Int, $offset: Int) {
    vaults(
      limit: $limit
      offset: $offset
      where: {
        term: { triple: { subject: { label: { _is_null: false } } } }
        curve_id: { _eq: 1 }
      }
      order_by: { market_cap: desc_nulls_last }
    ) {
      term {
        ${TERM_STATS_FIELDS}
        triple {
          term_id
          counter_term_id
          subject { label image }
          predicate { label }
          object { label }
          counter_term {
            ${TERM_STATS_FIELDS}
          }
        }
      }
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
        curve_id: { _eq: 1 }
      }
      limit: $limit
      order_by: { market_cap: desc_nulls_last }
    ) {
      term {
        ${TERM_STATS_FIELDS}
        triple {
          term_id
          counter_term_id
          subject { label image }
          predicate { label }
          object { label }
          counter_term {
            ${TERM_STATS_FIELDS}
          }
        }
      }
    }
  }
`

const TRIPLES_COUNT_QUERY = `
  query GetTriplesCount {
    triples_aggregate {
      aggregate { count }
    }
  }
`

const TRIPLES_SEARCH_COUNT_QUERY = `
  query SearchTriplesCount($search: String!) {
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

function parseE18(v: any): number {
  if (!v) return 0
  return parseFloat(v) / 1e18
}

function computeTermStats(termVaults: any[], termDaily: any[]) {
  const linBuckets = termDaily.filter((s: any) => Number(s.curve_id) === 1)
  const expBuckets = termDaily.filter((s: any) => Number(s.curve_id) === 2)

  let lin7dChange: number | null = null
  let exp7dChange: number | null = null
  let sharePriceChange24h = 0

  if (linBuckets.length >= 1) {
    const open  = parseE18(linBuckets[linBuckets.length - 1].first_share_price)
    const close = parseE18(linBuckets[0].last_share_price)
    if (open > 0) lin7dChange = ((close - open) / open) * 100
  }
  if (expBuckets.length >= 1) {
    const open  = parseE18(expBuckets[expBuckets.length - 1].first_share_price)
    const close = parseE18(expBuckets[0].last_share_price)
    if (open > 0) exp7dChange = ((close - open) / open) * 100
  }

  const recentBucket = (expBuckets.length > 0 ? expBuckets : linBuckets)[0]
  if (recentBucket) {
    const last  = parseE18(recentBucket.last_share_price)
    const first = parseE18(recentBucket.first_share_price)
    if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
  }

  const linVault = termVaults.find((tv: any) => Number(tv.curve_id) === 1) ?? null
  const expVault = termVaults.find((tv: any) => Number(tv.curve_id) === 2) ?? null
  const sharePriceLin = parseE18((linVault ?? termVaults[0])?.current_share_price)
  const sharePriceExp = parseE18(expVault?.current_share_price)
  const positionCount = termVaults.reduce((s: number, tv: any) => s + (tv.position_count ?? 0), 0)

  const allBuckets = termDaily.map((s: any) => s.bucket).filter(Boolean) as string[]
  const latestActivity = allBuckets.length > 0
    ? allBuckets.reduce((a, b) => (a > b ? a : b))
    : null

  return {
    totalShares: termVaults.reduce((s: number, tv: any) => s + parseE18(tv.total_shares), 0),
    positionCount,
    currentSharePrice: sharePriceLin,
    sharePriceLin,
    sharePriceExp,
    sharePriceChange24h,
    lin7dChange,
    exp7dChange,
    latestActivity,
    linSparkline: [...linBuckets].reverse().map((s: any) => parseE18(s.last_share_price)),
    expSparkline: [...expBuckets].reverse().map((s: any) => parseE18(s.last_share_price)),
  }
}

function buildTriples(vaultsData: any[]) {
  return vaultsData
    .filter(vault => vault.term?.triple)
    .map(vault => {
      const triple = vault.term.triple
      const subject = triple.subject?.label || 'Unknown'
      const predicate = triple.predicate?.label || 'Unknown'
      const object = triple.object?.label || 'Unknown'

      const termVaults: any[] = vault.term?.vaults || []
      const termDaily: any[] = vault.term?.share_price_change_stats_daily ?? []
      const support = computeTermStats(termVaults, termDaily)

      const counterTerm = triple.counter_term
      const counterVaults: any[] = counterTerm?.vaults || []
      const hasOppose = counterVaults.length > 0 || !!counterTerm?.total_market_cap

      let opposeStats = {
        totalShares: 0, positionCount: 0, currentSharePrice: 0,
        sharePriceLin: 0, sharePriceExp: 0,
        sharePriceChange24h: 0,
        lin7dChange: null as number | null, exp7dChange: null as number | null,
        linSparkline: [] as number[], expSparkline: [] as number[],
        latestActivity: null as string | null,
      }
      if (hasOppose) {
        const counterDaily: any[] = counterTerm?.share_price_change_stats_daily ?? []
        opposeStats = computeTermStats(counterVaults, counterDaily)
      }

      return {
        termId: triple.term_id || vault.term?.id || '',
        label: `${subject} - ${predicate} - ${object}`,
        subjectLabel: subject,
        predicateLabel: predicate,
        objectLabel: object,
        image: triple.subject?.image && triple.subject.image !== 'null' ? triple.subject.image : '',
        marketCap: parseE18(vault.term?.total_market_cap),
        totalAssets: parseE18(vault.term?.total_assets),
        totalShares: support.totalShares,
        currentSharePrice: support.sharePriceLin,
        sharePriceLin: support.sharePriceLin,
        sharePriceExp: support.sharePriceExp,
        positionCount: support.positionCount,
        sharePriceChange24h: support.sharePriceChange24h,
        lin7dChange: support.lin7dChange,
        exp7dChange: support.exp7dChange,
        latestActivity: support.latestActivity,
        linSparkline: support.linSparkline,
        expSparkline: support.expSparkline,
        hasOppose,
        opposeTermId: triple.counter_term_id || counterTerm?.id || '',
        opposeMarketCap: hasOppose ? parseE18(counterTerm?.total_market_cap) : 0,
        opposeTotalAssets: hasOppose ? parseE18(counterTerm?.total_assets) : 0,
        opposeTotalShares: opposeStats.totalShares,
        opposeSharePrice: opposeStats.sharePriceLin,
        opposeSharePriceLin: opposeStats.sharePriceLin,
        opposeSharePriceExp: opposeStats.sharePriceExp,
        opposePositionCount: opposeStats.positionCount,
        opposeSharePriceChange24h: opposeStats.sharePriceChange24h,
        opposeLinChange: opposeStats.lin7dChange,
        opposeExpChange: opposeStats.exp7dChange,
        opposeLinSparkline: opposeStats.linSparkline,
        opposeExpSparkline: opposeStats.expSparkline,
      }
    })
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
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(TRIPLES_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(TRIPLES_COUNT_QUERY, {}),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    }

    const triples = buildTriples(vaultsData)

    return NextResponse.json({
      triples,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[top-triples] Error fetching triples:", error)
    return NextResponse.json({ triples: [], error: "Failed to fetch triples" }, { status: 500 })
  }
}
