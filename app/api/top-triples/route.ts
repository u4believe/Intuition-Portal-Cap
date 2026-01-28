import { NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const TRIPLE_VAULTS_QUERY = `
  query TopTripleVaults {
    triple_vaults(limit: 100, order_by: [{market_cap: desc}]) {
      market_cap
      position_count
      term {
        total_market_cap
        triple {
          subject {
            label
            image
          }
        }
        share_price_change_stats_daily(limit: 1, order_by: [{bucket: desc}]) {
          last_share_price
        }
      }
      counter_term {
        total_market_cap
        share_price_change_stats_daily(limit: 1, order_by: [{bucket: desc}]) {
          last_share_price
        }
      }
    }
  }
`

export async function GET() {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: TRIPLE_VAULTS_QUERY,
      }),
    })

    if (!response.ok) {
      throw new Error(`Intuition API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.error("[v0] GraphQL errors:", data.errors)
      return NextResponse.json({ triples: [] })
    }

    const claimMap = new Map<string, any>()
    ;(data.data?.triple_vaults || []).forEach((vault: any) => {
      const label = vault.term?.triple?.subject?.label || "Unknown"
      const image = vault.term?.triple?.subject?.image || ""

      if (!claimMap.has(label)) {
        claimMap.set(label, {
          label,
          image,
          totalMarketCapWei: BigInt(0),
          termLastSharePrice: null as any,
          counterLastSharePrice: null as any,
          positionCount: 0,
        })
      }

      const claim = claimMap.get(label)!
      claim.totalMarketCapWei += BigInt(vault.market_cap || 0)
      claim.termLastSharePrice = vault.term?.share_price_change_stats_daily?.[0]?.last_share_price || 0
      claim.counterLastSharePrice = vault.counter_term?.share_price_change_stats_daily?.[0]?.last_share_price || 0
      claim.positionCount = Math.max(claim.positionCount, vault.position_count || 0)
    })

    const triples = Array.from(claimMap.values())
      .map((claim: any) => {
        const totalMarketCapEther = Number(claim.totalMarketCapWei) / 1e18
        const lastSharePrice = (Number(claim.termLastSharePrice) + Number(claim.counterLastSharePrice)) / 2 / 1e18

        return {
          label: claim.label,
          image: claim.image,
          market_cap: totalMarketCapEther,
          last_share_price: lastSharePrice,
          position_count: claim.positionCount,
        }
      })
      .sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0))
      .slice(0, 10)
      .map((triple: any, index: number) => ({
        ...triple,
        id: `triple-${triple.label}-${index}`,
        rank: index + 1,
      }))

    return NextResponse.json({ triples, success: true })
  } catch (error: any) {
    console.error("[v0] Error fetching top triples:", error)
    return NextResponse.json({ triples: [], error: error.message }, { status: 500 })
  }
}
