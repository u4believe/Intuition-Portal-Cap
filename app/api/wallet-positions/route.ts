import { NextResponse } from 'next/server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

// Based on "Account to Positions to Atoms/Triples" pattern in graphql-queries.md.
// Uses _ilike (case-insensitive) instead of _eq because Hasura string comparison
// is case-sensitive and the indexer may store account_id in a different case than
// what the wallet client provides (checksummed vs lowercase).
// shares: { _gt: "0" } skips dust/redeemed positions as shown in graphql-queries.md.
const WALLET_POSITIONS_QUERY = `
  query GetPositions($accountId: String!, $limit: Int!) {
    positions(
      where: { account_id: { _ilike: $accountId }, shares: { _gt: "0" } }
      limit: $limit
      order_by: { shares: desc }
    ) {
      shares
      account_id
      total_deposit_assets_after_total_fees
      total_redeem_assets_for_receiver
      vault {
        term_id
        curve_id
        current_share_price
        term {
          atom { term_id label image }
          triple {
            subject { label }
            predicate { label }
            object { label }
          }
        }
      }
    }
    positions_aggregate(
      where: { account_id: { _ilike: $accountId }, shares: { _gt: "0" } }
    ) {
      aggregate {
        count
        sum { shares }
      }
    }
  }
`

// Fetches per-term realized PnL from redemption events.
// The indexer computes cost_basis via average-cost method per redemption event.
// Multiple redemption events can exist per term_id+curve_id — we sum them.
const ACCOUNT_PNL_REALIZED_QUERY = `
  query GetAccountPnlRealized($accountId: String!, $startTime: String!, $endTime: String!) {
    getAccountPnlRealized(input: {
      account_id: $accountId,
      start_time: $startTime,
      end_time: $endTime
    }) {
      count
      data {
        term_id
        curve_id
        realized_pnl
        cost_basis
        shares_redeemed
        assets_out
      }
    }
  }
`

function parseAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return 0
  return n / 1e18
}

function curveLabel(curveId: any): 'Linear' | 'Exponential' | 'Unknown' {
  const id = Number(curveId)
  if (id === 1) return 'Linear'
  if (id === 2) return 'Exponential'
  return 'Unknown'
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    // Pass the address as-is — _ilike handles case-insensitive matching
    const address = url.searchParams.get('address')?.trim()

    if (!address) {
      return NextResponse.json({ error: 'address parameter required' }, { status: 400 })
    }

    const [positionsResult, realizedResult] = await Promise.allSettled([
      queryIntuitionGraphQL(WALLET_POSITIONS_QUERY, { accountId: address, limit: 200 }),
      queryIntuitionGraphQL(ACCOUNT_PNL_REALIZED_QUERY, {
        accountId: address,
        startTime: '2020-01-01T00:00:00Z',
        endTime: '2030-12-31T00:00:00Z',
      }),
    ])

    if (positionsResult.status === 'rejected') {
      throw positionsResult.reason
    }
    const data = positionsResult.value

    // Build a map of term_id+curve_id → aggregated realized PnL, summing all redemption events.
    // null entries mean the realized endpoint failed — we fall back to null per-position.
    const realizedMap = new Map<string, { realizedPnl: number; costBasis: number }>()
    if (realizedResult.status === 'fulfilled') {
      const entries: any[] = realizedResult.value?.getAccountPnlRealized?.data || []
      for (const entry of entries) {
        const key = `${entry.term_id}_${entry.curve_id}`
        const existing = realizedMap.get(key) ?? { realizedPnl: 0, costBasis: 0 }
        existing.realizedPnl += parseAmount(entry.realized_pnl)
        existing.costBasis += parseAmount(entry.cost_basis)
        realizedMap.set(key, existing)
      }
    }

    const rawPositions: any[] = data?.positions || []
    const agg = data?.positions_aggregate?.aggregate
    const total: number = agg?.count ?? rawPositions.length
    const totalSharesRaw: number = parseAmount(agg?.sum?.shares)

    const positions = rawPositions.map((p: any) => {
      const vault = p.vault
      const term = vault?.term
      const atom = term?.atom
      const triple = term?.triple
      const isTriple = !!triple
      const label = isTriple
        ? `${triple.subject?.label || '?'} — ${triple.predicate?.label || '?'} — ${triple.object?.label || '?'}`
        : atom?.label || 'Unknown'

      const shares = parseAmount(p.shares)
      const sharePrice = parseAmount(vault?.current_share_price)
      const totalDeposited = parseAmount(p.total_deposit_assets_after_total_fees)
      const totalRedeemed = parseAmount(p.total_redeem_assets_for_receiver)
      const currentValue = shares * sharePrice
      // netCost = capital still at risk after accounting for any partial redemptions
      const netCost = totalDeposited - totalRedeemed
      const unrealizedPnl = currentValue - netCost
      const unrealizedPnlPct = netCost > 0 ? (unrealizedPnl / netCost) * 100 : 0

      // Join realized PnL by term_id + curve_id; null if no redemptions have been made
      const realizedKey = `${vault?.term_id}_${vault?.curve_id}`
      const realized = realizedMap.size > 0 ? (realizedMap.get(realizedKey) ?? null) : null
      const realizedPnl = realized?.realizedPnl ?? null
      const realizedPnlPct =
        realized && realized.costBasis > 0
          ? (realized.realizedPnl / realized.costBasis) * 100
          : null

      return {
        termId: vault?.term_id || '',
        type: isTriple ? 'Claim' : 'Identity',
        label,
        image: atom?.image && atom.image !== 'null' ? atom.image : null,
        curve: curveLabel(vault?.curve_id),
        curveId: vault?.curve_id != null ? Number(vault.curve_id) : null,
        shares,
        sharePrice,
        totalDeposited,
        totalRedeemed,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPct,
        realizedPnl,
        realizedPnlPct,
        // Triple components for display
        subject: triple?.subject?.label || null,
        predicate: triple?.predicate?.label || null,
        object: triple?.object?.label || null,
      }
    })

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const totalNetCost = positions.reduce((sum, p) => sum + (p.totalDeposited - p.totalRedeemed), 0)
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
    const totalUnrealizedPnlPct = totalNetCost > 0 ? (totalUnrealizedPnl / totalNetCost) * 100 : 0

    // Sum all realized PnL across all terms (not just active positions — includes fully exited ones)
    let totalRealizedPnl = 0
    let totalRealizedCostBasis = 0
    for (const r of realizedMap.values()) {
      totalRealizedPnl += r.realizedPnl
      totalRealizedCostBasis += r.costBasis
    }
    const totalRealizedPnlPct =
      totalRealizedCostBasis > 0 ? (totalRealizedPnl / totalRealizedCostBasis) * 100 : 0

    return NextResponse.json({
      positions,
      total,
      totalShares: totalSharesRaw,
      totalValue,
      totalUnrealizedPnl,
      totalUnrealizedPnlPct,
      totalRealizedPnl,
      totalRealizedPnlPct,
    })
  } catch (error) {
    console.error('[wallet-positions] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }
}
