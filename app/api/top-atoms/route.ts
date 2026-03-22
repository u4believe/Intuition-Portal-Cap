import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const ATOM_VAULT_FIELDS = `
  market_cap
  position_count
  total_shares
  total_assets
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
  term {
    id
    total_market_cap
    total_assets
    vaults {
      position_count
      current_share_price
      total_shares
    }
    atom {
      label
      image
      emoji
      type
      data
      created_at
      creator {
        id
        label
        image
      }
      positions {
        id
        shares
        account_id
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
      }
    }
  }
`

const ATOMS_BROWSE_QUERY = `
  query GetAtoms($limit: Int, $offset: Int) {
    vaults(
      limit: $limit
      offset: $offset
      order_by: { market_cap: desc }
      where: { term: { atom: { label: { _is_null: false } } } }
    ) {
      ${ATOM_VAULT_FIELDS}
    }
  }
`

const ATOMS_SEARCH_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    vaults(
      where: { term: { atom: { label: { _ilike: $search } } } }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      ${ATOM_VAULT_FIELDS}
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

function buildAtoms(vaults: any[]) {
  const atomsMap = new Map<string, any>()

  for (const vault of vaults) {
    const atom = vault.term?.atom
    if (!atom || !atom.label || atom.label === 'Unknown') continue
    const termId = vault.term?.id || ''
    if (!atomsMap.has(termId)) {
      atomsMap.set(termId, {
        termId,
        label: atom.label,
        image: atom.image && atom.image !== 'null' ? atom.image : '',
        emoji: atom.emoji || '',
        atomType: atom.type || '',
        data: atom.data || '',
        createdAt: atom.created_at || '',
        creatorId: atom.creator?.id || '',
        creatorLabel: atom.creator?.label || '',
        creatorImage: atom.creator?.image && atom.creator.image !== 'null' ? atom.creator.image : '',
        marketCap: 0,
        totalAssets: 0,
        totalShares: 0,
        currentSharePrice: 0,
        positionCount: 0,
        sharePriceChange24h: 0,
        sharePriceStats: null as any,
        vaultDeposits: [] as any[],
        vaultRedemptions: [] as any[],
        vaultPositions: [] as any[],
        positions: (atom.positions || []).map((p: any) => ({
          id: p.id,
          accountId: p.account_id,
          shares: parseAmount(p.shares),
          totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
          totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
        })),
      })
    }

    const d = atomsMap.get(termId)!

    // Use term-level aggregates (total_market_cap / total_assets) — true Lin+Exp combined totals.
    // Assigning (not +=) is idempotent: the same value is returned for every vault row of this term.
    if (vault.term?.total_market_cap) d.marketCap  = parseAmount(vault.term.total_market_cap)
    if (vault.term?.total_assets)     d.totalAssets = parseAmount(vault.term.total_assets)

    // Sum shares / share price / positions from term.vaults sub-query.
    // This sub-query always returns ALL vaults for the term (Lin + Exp), so re-assigning
    // on each vault row is safe and always gives the correct total.
    const termVaults: any[] = vault.term?.vaults || []
    if (termVaults.length > 0) {
      d.totalShares       = termVaults.reduce((s: number, tv: any) => s + parseAmount(tv.total_shares), 0)
      d.positionCount     = termVaults.reduce((s: number, tv: any) => s + (tv.position_count || 0), 0)
      d.currentSharePrice = termVaults.reduce((s: number, tv: any) => s + parseAmount(tv.current_share_price), 0)
    }

    const spc = vault.share_price_change_stats_daily?.[0]
    if (spc) {
      const last = parseAmount(spc.last_share_price)
      const first = parseAmount(spc.first_share_price)
      if (first > 0) d.sharePriceChange24h = ((last - first) / first) * 100
      d.sharePriceStats = {
        difference: parseAmount(spc.difference),
        firstSharePrice: parseAmount(spc.first_share_price),
        lastSharePrice: parseAmount(spc.last_share_price),
        changeCount: spc.change_count || 0,
      }
    }

    d.vaultDeposits.push(...(vault.deposits || []).map((dep: any) => ({
      id: dep.id,
      shares: parseAmount(dep.shares),
      createdAt: dep.created_at,
    })))
    d.vaultRedemptions.push(...(vault.redemptions || []).map((r: any) => ({
      id: r.id,
      shares: parseAmount(r.shares),
      createdAt: r.created_at,
    })))
    d.vaultPositions.push(...(vault.positions || []).map((p: any) => ({
      accountId: p.account_id,
      shares: parseAmount(p.shares),
      totalDepositAssetsAfterTotalFees: parseAmount(p.total_deposit_assets_after_total_fees),
      totalRedeemAssetsForReceiver: parseAmount(p.total_redeem_assets_for_receiver),
    })))
  }

  return Array.from(atomsMap.values()).sort((a, b) => b.marketCap - a.marketCap)
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
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_SEARCH_QUERY, { search: `%${search}%`, limit: pageSize }),
        queryIntuitionGraphQL(ATOMS_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.atoms_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(ATOMS_COUNT_QUERY, {}),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.atoms_aggregate?.aggregate?.count || 0
    }

    const atoms = buildAtoms(vaultsData)

    return NextResponse.json({
      atoms,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[v0] Error fetching atoms:", error)
    return NextResponse.json({ atoms: [], error: "Failed to fetch atoms" }, { status: 500 })
  }
}
