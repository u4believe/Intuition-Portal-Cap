import { NextResponse } from 'next/server'
import { queryIntuitionGraphQL } from '@/lib/intuition-graphql'

const STATS_QUERY = `
  query ProtocolStats {
    vaults_aggregate {
      aggregate { sum { total_assets } }
    }
    accounts_aggregate {
      aggregate { count }
    }
  }
`

export async function GET() {
  try {
    const data = await queryIntuitionGraphQL(STATS_QUERY)
    const totalAssetsRaw = data?.vaults_aggregate?.aggregate?.sum?.total_assets ?? '0'
    const totalStakedTrust = parseFloat(totalAssetsRaw) / 1e18
    const uniqueAddresses = data?.accounts_aggregate?.aggregate?.count ?? 0

    return NextResponse.json(
      { totalStakedTrust, uniqueAddresses },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } }
    )
  } catch (err) {
    console.error('[protocol-stats] error:', err)
    return NextResponse.json({ totalStakedTrust: null, uniqueAddresses: null }, { status: 500 })
  }
}
