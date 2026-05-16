import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

// Fields fetched on the support term. term.vaults returns all curves (curve_id 1=Lin, 2=Exp).
const TERM_VAULT_FIELDS = `
  id
  total_market_cap
  total_assets
  vaults {
    curve_id
    position_count
    current_share_price
    total_shares
    market_cap
    deposits(order_by: { created_at: desc }, limit: 1) { created_at }
    redemptions(order_by: { created_at: desc }, limit: 1) { created_at }
  }
  positions_aggregate {
    aggregate { count(columns: account_id, distinct: true) }
  }
  share_price_change_stats_daily(order_by: { bucket: desc }, limit: 14) {
    bucket
    curve_id
    first_share_price
    last_share_price
  }
`

const TRIPLE_FIELDS = `
  term_id
  counter_term_id
  subject { label image }
  predicate { label }
  object { label }
  term {
    ${TERM_VAULT_FIELDS}
  }
  counter_term {
    ${TERM_VAULT_FIELDS}
  }
`

// Browse: query triples directly, ordered by combined (Lin+Exp) market cap descending.
const TRIPLES_BROWSE_QUERY = `
  query GetTriples($limit: Int, $offset: Int) {
    triples(
      limit: $limit
      offset: $offset
      order_by: { term: { total_market_cap: desc_nulls_last } }
    ) {
      ${TRIPLE_FIELDS}
    }
  }
`

const TRIPLES_SEARCH_QUERY = `
  query SearchTriples($search: String!, $limit: Int) {
    triples(
      where: {
        _or: [
          { subject: { label: { _ilike: $search } } }
          { predicate: { label: { _ilike: $search } } }
          { object: { label: { _ilike: $search } } }
        ]
      }
      limit: $limit
      order_by: { term: { total_market_cap: desc_nulls_last } }
    ) {
      ${TRIPLE_FIELDS}
    }
  }
`

// Count triples (not vaults) to avoid 2× inflation from Lin+Exp vault rows.
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

function computeTermStats(termVaults: any[], termDaily: any[], termObj?: any) {
  // Buckets are desc-ordered (newest first): [0]=today, [last]=7 days ago
  const linBuckets = termDaily.filter((s: any) => Number(s.curve_id) === 1)
  const expBuckets = termDaily.filter((s: any) => Number(s.curve_id) === 2)

  let lin7dChange: number | null = null
  let exp7dChange: number | null = null
  let sharePriceChange24h = 0

  // 7d % change: oldest bucket open price → newest bucket close price
  if (linBuckets.length >= 1) {
    const open  = parseE18(linBuckets[linBuckets.length - 1].first_share_price)  // oldest
    const close = parseE18(linBuckets[0].last_share_price)                        // newest
    if (open > 0) lin7dChange = ((close - open) / open) * 100
  }
  if (expBuckets.length >= 1) {
    const open  = parseE18(expBuckets[expBuckets.length - 1].first_share_price)  // oldest
    const close = parseE18(expBuckets[0].last_share_price)                        // newest
    if (open > 0) exp7dChange = ((close - open) / open) * 100
  }

  // 24h change: most recent bucket (index 0), prefer Exp, fall back to Lin
  const recentBucket = (expBuckets.length > 0 ? expBuckets : linBuckets)[0]
  if (recentBucket) {
    const last  = parseE18(recentBucket.last_share_price)
    const first = parseE18(recentBucket.first_share_price)
    if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
  }

  // Share prices per curve — not additive, per-unit prices
  const linVault = termVaults.find((tv: any) => Number(tv.curve_id) === 1) ?? null
  const expVault = termVaults.find((tv: any) => Number(tv.curve_id) === 2) ?? null
  const sharePriceLin = parseE18((linVault ?? termVaults[0])?.current_share_price)
  const sharePriceExp = parseE18(expVault?.current_share_price)
  // Positions: distinct wallet count across all curves (avoids double-counting Lin+Exp holders)
  const positionCount = termObj?.positions_aggregate?.aggregate?.count ?? 0

  // Latest deposit or redemption timestamp across all vaults of this term
  const latestActivity = termVaults.reduce((latest: string | null, vault: any) => {
    const dates = [
      vault.deposits?.[0]?.created_at,
      vault.redemptions?.[0]?.created_at,
    ].filter(Boolean) as string[]
    for (const d of dates) { if (!latest || d > latest) latest = d }
    return latest
  }, null as string | null)

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
    // Sparklines reversed to chronological order for display
    linSparkline: [...linBuckets].reverse().map((s: any) => parseE18(s.last_share_price)),
    expSparkline: [...expBuckets].reverse().map((s: any) => parseE18(s.last_share_price)),
  }
}

// Each triple appears exactly once in the query result (no per-vault duplication).
function buildTriples(triplesData: any[]) {
  return triplesData.map(triple => {
    const subject = triple.subject?.label || 'Unknown'
    const predicate = triple.predicate?.label || 'Unknown'
    const object = triple.object?.label || 'Unknown'

    // Support side
    const termVaults: any[] = triple.term?.vaults || []
    const termDaily: any[] = triple.term?.share_price_change_stats_daily ?? []
    const support = computeTermStats(termVaults, termDaily, triple.term)

    // Oppose side (counter_term)
    const counterTerm = triple.counter_term
    const counterVaults: any[] = counterTerm?.vaults || []
    const hasOppose = counterVaults.length > 0 || !!counterTerm?.total_market_cap

    let opposeStats = {
      totalShares: 0, positionCount: 0, currentSharePrice: 0,
      sharePriceChange24h: 0,
      lin7dChange: null as number | null, exp7dChange: null as number | null,
      linSparkline: [] as number[], expSparkline: [] as number[],
    }
    if (hasOppose) {
      const counterDaily: any[] = counterTerm?.share_price_change_stats_daily ?? []
      opposeStats = computeTermStats(counterVaults, counterDaily, counterTerm)
    }

    return {
      termId: triple.term_id || triple.term?.id || '',
      label: `${subject} - ${predicate} - ${object}`,
      subjectLabel: subject,
      predicateLabel: predicate,
      objectLabel: object,
      image: triple.subject?.image && triple.subject.image !== 'null' ? triple.subject.image : '',
      // Support side — term-level combined totals
      marketCap: parseE18(triple.term?.total_market_cap),
      totalAssets: parseE18(triple.term?.total_assets),
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
      // Oppose side
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
  }).sort((a, b) => {
    if (a.latestActivity && b.latestActivity) return b.latestActivity.localeCompare(a.latestActivity)
    if (a.latestActivity) return -1
    if (b.latestActivity) return 1
    return b.marketCap - a.marketCap
  })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const search = url.searchParams.get("search")?.trim() || ""
    const pageSize = search ? 200 : 100
    const offset = (page - 1) * pageSize

    let triplesData: any[]
    let totalCount = 0

    if (search) {
      const vars = { search: `%${search}%`, limit: pageSize }
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(TRIPLES_SEARCH_QUERY, vars),
        queryIntuitionGraphQL(TRIPLES_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      triplesData = data?.triples || []
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(TRIPLES_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(TRIPLES_COUNT_QUERY, {}),
      ])
      triplesData = data?.triples || []
      totalCount = countData?.triples_aggregate?.aggregate?.count || 0
    }

    const triples = buildTriples(triplesData)

    return NextResponse.json({
      triples,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[top-triples] Error fetching triples:", error)
    return NextResponse.json({ triples: [], error: "Failed to fetch triples" }, { status: 500 })
  }
}
