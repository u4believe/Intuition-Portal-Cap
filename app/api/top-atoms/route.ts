import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const ATOM_FIELDS = `
  term_id
  data
  label
  image
  emoji
  type
  created_at
  creator {
    id
    label
    image
  }
  term {
    type
    total_market_cap
    total_assets
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
      positions {
        account_id
        shares
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
      }
    }
  }
  positions {
    id
    shares
    account_id
    total_deposit_assets_after_total_fees
    total_redeem_assets_for_receiver
  }
`

const ATOMS_BROWSE_QUERY = `
  query GetAtoms($limit: Int, $offset: Int) {
    atoms(limit: $limit, offset: $offset) {
      ${ATOM_FIELDS}
    }
  }
`

const ATOMS_SEARCH_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    atoms(
      where: { label: { _ilike: $search } }
      limit: $limit
    ) {
      ${ATOM_FIELDS}
    }
  }
`

const ATOMS_COUNT_QUERY = `
  query GetAtomsCount {
    atoms_aggregate {
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

function buildAtoms(atoms: any[]) {
  return atoms
    .filter(a => a.label && a.label !== 'Unknown')
    .map(a => {
      const vault = a.term?.vaults?.[0] ?? null
      const spc = vault?.share_price_change_stats_daily?.[0] ?? null
      let sharePriceChange24h = 0
      if (spc) {
        const last = parseAmount(spc.last_share_price)
        const first = parseAmount(spc.first_share_price)
        if (first > 0) sharePriceChange24h = ((last - first) / first) * 100
      }
      return {
        termId: a.term_id || '',
        label: a.label || 'Unknown',
        image: a.image && a.image !== 'null' ? a.image : '',
        emoji: a.emoji || '',
        atomType: a.type || '',
        data: a.data || '',
        createdAt: a.created_at || '',
        creatorId: a.creator?.id || '',
        creatorLabel: a.creator?.label || '',
        creatorImage: a.creator?.image && a.creator.image !== 'null' ? a.creator.image : '',
        marketCap: parseAmount(vault?.market_cap),
        totalAssets: parseAmount(vault?.total_assets),
        totalShares: parseAmount(vault?.total_shares),
        currentSharePrice: parseAmount(vault?.current_share_price),
        positionCount: vault?.position_count || 0,
        sharePriceChange24h,
        sharePriceStats: spc ? {
          difference: parseAmount(spc.difference),
          firstSharePrice: parseAmount(spc.first_share_price),
          lastSharePrice: parseAmount(spc.last_share_price),
          changeCount: spc.change_count || 0,
        } : null,
        vaultDeposits: (vault?.deposits || []).map((d: any) => ({
          id: d.id,
          shares: parseAmount(d.shares),
          createdAt: d.created_at,
        })),
        vaultRedemptions: (vault?.redemptions || []).map((r: any) => ({
          id: r.id,
          shares: parseAmount(r.shares),
          createdAt: r.created_at,
        })),
        vaultPositions: (vault?.positions || []).map((p: any) => ({
          accountId: p.account_id,
          shares: parseAmount(p.shares),
          totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
          totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
        })),
        positions: (a.positions || []).map((p: any) => ({
          id: p.id,
          accountId: p.account_id,
          shares: parseAmount(p.shares),
          totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
          totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
        })),
      }
    })
    .sort((a, b) => b.marketCap - a.marketCap)
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
    console.error("[v0] Error fetching atoms:", error)
    return NextResponse.json({ atoms: [], error: "Failed to fetch atoms" }, { status: 500 })
  }
}
