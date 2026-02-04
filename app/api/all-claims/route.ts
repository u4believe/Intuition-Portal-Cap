import { NextResponse } from 'next/server'
import { queryIntuitionGraphQL, ALL_CLAIMS_QUERY, convertWeiToEther } from '@/lib/intuition-graphql'
import { Claim } from '@/hooks/useIntuitionData'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '1000', 10)

    const data = await queryIntuitionGraphQL(ALL_CLAIMS_QUERY, { limit })

    const claims: Claim[] = (data?.vaults || []).map((vault: any) => {
      const atom = vault.term?.atom
      const triple = vault.term?.triple
      const deposits = vault.deposits || []
      const redemptions = vault.redemptions || []
      const positions = vault.positions || []

      const marketCap = convertWeiToEther(vault.market_cap || 0)
      const totalShares = convertWeiToEther(vault.total_shares || 0)
      const currentSharePrice = convertWeiToEther(vault.current_share_price || 0)
      const totalAssets = convertWeiToEther(vault.total_assets || 0)
      const sharePriceChange24h = vault.share_price_change_stats_daily?.[0]?.difference
        ? parseFloat(vault.share_price_change_stats_daily[0].difference)
        : 0

      return {
        termId: vault.term_id || vault.term?.id || '',
        label: atom?.label || 'Unknown',
        type: atom?.type || 'Unknown',
        image: atom?.image || null,
        subjectLabel: triple?.subject?.label || 'Unknown',
        subjectType: triple?.subject?.type || 'Unknown',
        predicateLabel: triple?.predicate?.label || 'Unknown',
        predicateType: triple?.predicate?.type || 'Unknown',
        objectLabel: triple?.object?.label || 'Unknown',
        objectType: triple?.object?.type || 'Unknown',
        marketCap: marketCap,
        totalShares: totalShares,
        currentSharePrice: currentSharePrice,
        totalAssets: totalAssets,
        positionCount: vault.position_count || 0,
        sharePriceChange24h: sharePriceChange24h,
        deposits: deposits.map((dep: any) => ({
          id: dep.id,
          createdAt: dep.created_at,
          shares: convertWeiToEther(dep.shares || 0),
        })),
        redemptions: redemptions.map((red: any) => ({
          id: red.id,
          createdAt: red.created_at,
          shares: convertWeiToEther(red.shares || 0),
        })),
        positions: positions.map((pos: any) => ({
          accountId: pos.account_id,
          shares: convertWeiToEther(pos.shares || 0),
          totalDepositAssetsAfterTotalFees: convertWeiToEther(pos.total_deposit_assets_after_total_fees || 0),
          totalRedeemAssetsForReceiver: convertWeiToEther(pos.total_redeem_assets_for_receiver || 0),
        })),
      }
    })

    return NextResponse.json({ claims })
  } catch (error) {
    console.error('[v0] Error fetching all claims:', error)
    return NextResponse.json({ claims: [], error: 'Failed to fetch claims' }, { status: 500 })
  }
}
