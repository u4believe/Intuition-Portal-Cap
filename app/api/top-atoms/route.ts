import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const ATOMS_BROWSE_QUERY = `
  query GetAtoms($limit: Int, $offset: Int) {
    vaults(
      limit: $limit
      offset: $offset
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      total_shares
      total_assets
      current_share_price
      term {
        id
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

const ATOMS_SEARCH_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    vaults(
      where: { term: { atom: { label: { _ilike: $search } } } }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      total_shares
      total_assets
      current_share_price
      term {
        id
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

const ATOMS_COUNT_QUERY = `
  query GetAtomsCount {
    vaults_aggregate {
      aggregate { count }
    }
  }
`

const ATOMS_SEARCH_COUNT_QUERY = `
  query SearchAtomsCount($search: String!) {
    vaults_aggregate(where: { term: { atom: { label: { _ilike: $search } } } }) {
      aggregate { count }
    }
  }
`

function transformVaults(vaults: any[]): Map<string, any> {
  const atomsMap = new Map<string, any>()
  for (const vault of vaults) {
    const atom = vault.term?.atom
    if (!atom) continue
    const atomLabel = atom.label || "Unknown"
    if (!atomsMap.has(atomLabel)) {
      atomsMap.set(atomLabel, {
        termId: vault.term?.id || "",
        label: atomLabel,
        image: atom.image && atom.image !== "null" ? atom.image : "",
        marketCap: 0,
        totalAssets: 0,
        totalShares: 0,
        currentSharePrice: 0,
        positionCount: 0,
        sharePriceChange24h: 0,
        positions: [],
      })
    }
    const d = atomsMap.get(atomLabel)!
    d.marketCap += vault.market_cap ? parseFloat(vault.market_cap) / 1e18 : 0
    d.totalAssets += vault.total_assets ? parseFloat(vault.total_assets) / 1e18 : 0
    d.totalShares += vault.total_shares ? parseFloat(vault.total_shares) / 1e18 : 0
    d.currentSharePrice = Math.max(d.currentSharePrice, vault.current_share_price ? parseFloat(vault.current_share_price) / 1e18 : 0)
    d.positionCount += vault.position_count || 0
    const spc = vault.term?.share_price_change_stats_daily?.[0]
    if (spc) {
      const last = parseFloat(spc.last_share_price || "0") / 1e18
      const first = parseFloat(spc.first_share_price || "0") / 1e18
      if (first > 0) d.sharePriceChange24h = ((last - first) / first) * 100
    }
    d.positions.push(...(atom.positions || []))
  }
  return atomsMap
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get("page") || "1")
    const search = url.searchParams.get("search")?.trim() || ""
    const pageSize = search ? 200 : 100
    const offset = (page - 1) * pageSize

    let vaultsData: any
    let totalCount = 0

    if (search) {
      const vars = { search: `%${search}%`, limit: pageSize }
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_SEARCH_QUERY, vars),
        queryIntuitionGraphQL(ATOMS_SEARCH_COUNT_QUERY, { search: `%${search}%` }),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.vaults_aggregate?.aggregate?.count || 0
    } else {
      const [data, countData] = await Promise.all([
        queryIntuitionGraphQL(ATOMS_BROWSE_QUERY, { limit: pageSize, offset }),
        queryIntuitionGraphQL(ATOMS_COUNT_QUERY, {}),
      ])
      vaultsData = data?.vaults || []
      totalCount = countData?.vaults_aggregate?.aggregate?.count || 0
    }

    const atoms = Array.from(transformVaults(vaultsData).values())
      .sort((a, b) => b.marketCap - a.marketCap)

    return NextResponse.json({
      atoms,
      pagination: { page, pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    })
  } catch (error) {
    console.error("[v0] Error fetching atoms:", error)
    return NextResponse.json({ atoms: [], error: "Failed to fetch atoms" }, { status: 500 })
  }
}
