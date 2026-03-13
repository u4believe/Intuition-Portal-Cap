import { NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const TOP_CLAIMS_QUERY = `
  query TopClaims($limit: Int) {
    triples(limit: $limit) {
      subject {
        label
        image
        value {
          thing_id
        }
        term {
          atom {
            label
            image
          }
          total_market_cap
          total_assets
        }
        positions {
          shares
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
        query: TOP_CLAIMS_QUERY,
        variables: {
          limit: 100,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Intuition API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.error("[v0] GraphQL errors:", data.errors)
      return NextResponse.json({ claims: [] })
    }

    const claims = (data.data?.triples || [])
      .map((item: any, index: number) => ({
        id: item.subject?.value?.thing_id || `claim-${index}`,
        label: item.subject?.label || `Claim ${index + 1}`,
        image: item.subject?.image && item.subject.image !== 'null' ? item.subject.image : "",
        atom_label: item.subject?.term?.atom?.label || "",
        atom_image: item.subject?.term?.atom?.image && item.subject.term.atom.image !== 'null' ? item.subject.term.atom.image : "",
        market_cap: item.subject?.term?.total_market_cap || 0,
        total_assets: item.subject?.term?.total_assets || 0,
        position_count: item.subject?.positions?.length || 0,
      }))
      .sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0))
      .slice(0, 10)
      .map((claim: any, index: number) => ({
        ...claim,
        rank: index + 1,
      }))

    return NextResponse.json({ claims, success: true })
  } catch (error: any) {
    console.error("[v0] Error fetching top claims:", error)
    return NextResponse.json({ claims: [], error: error.message }, { status: 500 })
  }
}
