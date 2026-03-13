import { type NextRequest, NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const SEARCH_TRIPLES_QUERY = `
  query SearchTriples($search: String!, $limit: Int) {
    atoms(where: {label: {_ilike: $search}}, limit: $limit) {
      id
      label
      image
      data
      creator_id
    }
  }
`

const FETCH_TRIPLES_QUERY = `
  query Triples($orderBy: [triples_order_by!], $redemptionsOrderBy: [redemptions_order_by!], $eventsOrderBy: [events_order_by!]) {
    triples(order_by: $orderBy) {
      id
      subject {
        label
        image
        creator_id
        created_at
      }
      triple_vault {
        market_cap
        position_count
      }
      positions(order_by: $orderBy) {
        id
        shares
        account_id
      }
    }
    events(order_by: $eventsOrderBy) {
      id
      created_at
    }
  }
`

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const fetchMode = searchParams.get("mode") // "search" or "triples"

    if (fetchMode === "triples") {
      // Fetch all triples with detailed data
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: FETCH_TRIPLES_QUERY,
          variables: {
            orderBy: [{ created_at: "desc" }],
            redemptionsOrderBy: [{ created_at: "desc" }],
            eventsOrderBy: [{ created_at: "desc" }],
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.errors) {
        console.error("[v0] GraphQL errors:", data.errors)
        return NextResponse.json({ triples: [] })
      }

      const triples = (data.data?.triples || []).map((triple: any) => {
        const subject = triple.subject
        const vault = triple.triple_vault
        return {
          id: triple.id,
          label: subject?.label || "Unknown",
          image: subject?.image && subject.image !== 'null' ? subject.image : "",
          type: "claim",
          market_cap: vault?.market_cap || 0,
          position_count: vault?.position_count || 0,
          positions: triple.positions || [],
          created_at: subject?.created_at,
        }
      })

      return NextResponse.json({ triples, success: true })
    }

    if (!query) {
      return NextResponse.json({ triples: [] })
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: SEARCH_TRIPLES_QUERY,
        variables: {
          search: `%${query}%`,
          limit: 20,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.error("[v0] GraphQL errors:", data.errors)
      return NextResponse.json({ triples: [] })
    }

    const triples = (data.data?.atoms || []).map((atom: any) => ({
      id: atom.id,
      label: atom.label || "Unknown",
      image: atom.image && atom.image !== 'null' ? atom.image : "",
      type: "atom",
      market_cap: 0, // Atoms don't have direct market cap, it's in triples
      position_count: 0,
    }))

    return NextResponse.json({ triples, success: true })
  } catch (error: any) {
    console.error("[v0] Error searching triples:", error)
    return NextResponse.json({ triples: [], error: error.message }, { status: 500 })
  }
}
