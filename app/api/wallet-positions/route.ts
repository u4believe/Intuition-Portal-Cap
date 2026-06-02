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

    const data = await queryIntuitionGraphQL(WALLET_POSITIONS_QUERY, {
      accountId: address,
      limit: 200,
    })

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
      const netCost = totalDeposited - totalRedeemed
      const pnl = currentValue - netCost
      const pnlPct = netCost > 0 ? (pnl / netCost) * 100 : 0

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
        pnl,
        pnlPct,
        // Triple components for display
        subject: triple?.subject?.label || null,
        predicate: triple?.predicate?.label || null,
        object: triple?.object?.label || null,
      }
    })

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)
    const totalCost = positions.reduce((sum, p) => sum + (p.totalDeposited - p.totalRedeemed), 0)
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

    return NextResponse.json({ positions, total, totalShares: totalSharesRaw, totalValue, totalPnl, totalPnlPct })
  } catch (error) {
    console.error('[wallet-positions] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }
}
