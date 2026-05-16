import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

// Fields fetched on each atom entity. term.vaults returns all curves (curve_id 1=Lin, 2=Exp).
const ATOM_FIELDS = `
  term_id
  label
  image
  emoji
  type
  data
  created_at
  creator { id label image }
  term {
    id
    total_market_cap
    total_assets
    vaults {
      curve_id
      position_count
      current_share_price
      total_shares
      market_cap
      share_price_change_stats_daily(order_by: { bucket: desc }, limit: 7) {
        bucket
        first_share_price
        last_share_price
      }
    }
  }
`

// Browse: order by created_at desc — atom-level field, no cross-table join, fast on 175k+ rows.
// Ordering by term.total_market_cap requires a join across all atoms and times out.
const ATOMS_BROWSE_QUERY = `
  query GetAtoms($limit: Int, $offset: Int) {
    atoms(
      limit: $limit
      offset: $offset
      where: { label: { _is_null: false } }
      order_by: { created_at: desc }
    ) {
      ${ATOM_FIELDS}
    }
  }
`

const ATOMS_SEARCH_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    atoms(
      where: { label: { _ilike: $search } }
      limit: $limit
      order_by: { term: { total_market_cap: desc_nulls_last } }
    ) {
      ${ATOM_FIELDS}
    }
  }
`

const ATOMS_COUNT_QUERY = `
  query GetAtomsCount {
    atoms_aggregate(where: { label: { _is_null: false } }) {
      aggregate { count }
    }
  }
`

const ATOMS_SEARCH_COUNT_QUERY = `
  query SearchAtomsCount($search: String!) {
    atoms_aggregate(where: { label: { _ilike: $search } }) {
      aggregate { count }
    }
  }
`

function parseAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 0
  return n / 1e18
}

// Each atom appears exactly once in the query result (no per-vault duplication).
function buildAtoms(atomsData: any[]) {
  return atomsData
    .filter(atom => atom.label && atom.label !== 'Unknown')
    .map(atom => {
      const termVaults: any[] = atom.term?.vaults || []

      // Each vault already knows its curve — find Lin and Exp by curve_id on the vault.
      // Daily stats are fetched per-vault (desc order: [0]=newest, [last]=oldest).
      const linVault = termVaults.find((tv: any) => Number(tv.curve_id) === 1) ?? null
      const expVault = termVaults.find((tv: any) => Number(tv.curve_id) === 2) ?? null
      const linBuckets: any[] = linVault?.share_price_change_stats_daily ?? []
      const expBuckets: any[] = expVault?.share_price_change_stats_daily ?? []

      // 7d % change: oldest bucket open price → newest bucket close price
      let lin7dChange: number | null = null
      let exp7dChange: number | null = null
      if (linBuckets.length >= 1) {
        const open  = parseAmount(linBuckets[linBuckets.length - 1].first_share_price)  // oldest
        const close = parseAmount(linBuckets[0].last_share_price)                        // newest
        if (open > 0) lin7dChange = ((close - open) / open) * 100
      }
      if (expBuckets.length >= 1) {
        const open  = parseAmount(expBuckets[expBuckets.length - 1].first_share_price)  // oldest
        const close = parseAmount(expBuckets[0].last_share_price)                        // newest
        if (open > 0) exp7dChange = ((close - open) / open) * 100
      }

      // 24h change: most recent bucket (index 0), prefer Exp, fall back to Lin
      let sharePriceChange24h = 0
      const recentBucket = (expBuckets.length > 0 ? expBuckets : linBuckets)[0]
      if (recentBucket) {
        const last  = parseAmount(recentBucket.last_share_price)
        const first = parseAmount(recentBucket.first_share_price)
        if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
      }

      const sharePriceLin = parseAmount((linVault ?? termVaults[0])?.current_share_price)
      const sharePriceExp = parseAmount(expVault?.current_share_price)

      // Latest activity: use the most recent share-price bucket across all vaults as a proxy
      const latestBuckets = [linBuckets[0]?.bucket, expBuckets[0]?.bucket].filter(Boolean) as string[]
      const latestActivity = latestBuckets.length > 0
        ? latestBuckets.reduce((a, b) => (a > b ? a : b))
        : null

      return {
        termId: atom.term_id || atom.term?.id || '',
        label: atom.label,
        image: atom.image && atom.image !== 'null' ? atom.image : '',
        emoji: atom.emoji || '',
        atomType: atom.type || '',
        data: atom.data || '',
        createdAt: atom.created_at || '',
        creatorId: atom.creator?.id || '',
        creatorLabel: atom.creator?.label || '',
        creatorImage: atom.creator?.image && atom.creator.image !== 'null' ? atom.creator.image : '',
        // Term-level combined totals (Lin + Exp)
        marketCap: parseAmount(atom.term?.total_market_cap),
        totalAssets: parseAmount(atom.term?.total_assets),
        // Share prices per curve — not additive
        currentSharePrice: sharePriceLin,
        sharePriceLin,
        sharePriceExp,
        // Shares: sum vault shares (each vault's shares track that curve's pool)
        totalShares: termVaults.reduce((s: number, tv: any) => s + parseAmount(tv.total_shares), 0),
        // Positions: sum of per-vault position_count (positions_aggregate DISTINCT is too slow)
        positionCount: termVaults.reduce((s: number, tv: any) => s + (tv.position_count ?? 0), 0),
        // Price change metrics
        sharePriceChange24h,
        lin7dChange,
        exp7dChange,
        latestActivity,
        // Sparklines reversed to chronological order for display
        linSparkline: [...linBuckets].reverse().map((s: any) => parseAmount(s.last_share_price)),
        expSparkline: [...expBuckets].reverse().map((s: any) => parseAmount(s.last_share_price)),
      }
    })
    .sort((a, b) => {
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

    let atomsData: any[]
    let totalCount = 0

    if (search) {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_SEARCH_QUERY, { search: `%${search}%`, limit: pageSize }),
        queryIntuitionGraphQL(ATOMS_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      atomsData = data?.atoms || []
      totalCount = countData?.atoms_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(ATOMS_COUNT_QUERY, {}),
      ])
      atomsData = data?.atoms || []
      totalCount = countData?.atoms_aggregate?.aggregate?.count || 0
    }

    const atoms = buildAtoms(atomsData)

    return NextResponse.json({
      atoms,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[top-atoms] Error fetching atoms:", error)
    return NextResponse.json({ atoms: [], error: "Failed to fetch atoms" }, { status: 500 })
  }
}
