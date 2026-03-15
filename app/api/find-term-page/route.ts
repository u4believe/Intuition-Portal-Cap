import { type NextRequest, NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

const PAGE_SIZE = 100

export async function GET(request: NextRequest) {
  const termId = request.nextUrl.searchParams.get("termId")

  if (!termId) {
    return NextResponse.json({ error: "termId is required" }, { status: 400 })
  }

  try {
    const MARKET_CAP_QUERY = `
      query GetTermMarketCap($termId: String!) {
        vaults(where: { term: { id: { _eq: $termId } } }, limit: 1) {
          market_cap
        }
      }
    `

    const data = await queryIntuitionGraphQL(MARKET_CAP_QUERY, { termId })
    const vault = data?.vaults?.[0]

    if (!vault) {
      return NextResponse.json({ page: 1, rank: 1 })
    }

    const marketCap = vault.market_cap

    const RANK_QUERY = `
      query CountAbove($marketCap: numeric!) {
        vaults_aggregate(where: { market_cap: { _gt: $marketCap } }) {
          aggregate { count }
        }
      }
    `

    const rankData = await queryIntuitionGraphQL(RANK_QUERY, { marketCap })
    const rank = (rankData?.vaults_aggregate?.aggregate?.count ?? 0) + 1
    const page = Math.ceil(rank / PAGE_SIZE)

    return NextResponse.json({ page, rank })
  } catch (error: any) {
    console.error("[find-term-page] Error:", error)
    return NextResponse.json({ page: 1, rank: 1 })
  }
}
