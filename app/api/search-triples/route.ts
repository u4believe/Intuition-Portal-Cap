import { type NextRequest, NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const SEARCH_IDENTITIES_QUERY = `
  query SearchIdentities($search: String!, $limit: Int) {
    vaults(
      where: {term: {atom: {label: {_ilike: $search}}}}
      limit: $limit
      order_by: {market_cap: desc}
    ) {
      market_cap
      position_count
      term {
        id
        atom {
          label
          image
        }
      }
    }
  }
`

const SEARCH_CLAIMS_QUERY = `
  query SearchClaims($search: String!, $limit: Int) {
    triples(
      where: {
        _or: [
          {subject: {label: {_ilike: $search}}}
          {predicate: {label: {_ilike: $search}}}
          {object: {label: {_ilike: $search}}}
        ]
      }
      limit: $limit
      order_by: {triple_vault: {market_cap: desc}}
    ) {
      subject { label }
      predicate { label }
      object { label }
      triple_vault {
        market_cap
        position_count
        term { id }
      }
    }
  }
`

const FETCH_TRIPLES_QUERY = `
  query Triples($orderBy: [triples_order_by!], $redemptionsOrderBy: [redemptions_order_by!], $eventsOrderBy: [events_order_by!]) {
    triples(order_by: $orderBy) {
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
        shares
        account_id
      }
    }
    events(order_by: $eventsOrderBy) {
      created_at
    }
  }
`

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.statusText}`)
  return res.json()
}

function formatMarketCap(raw: number | string | null | undefined): string {
  if (!raw) return ''
  const n = typeof raw === 'string' ? parseFloat(raw) : raw
  if (isNaN(n) || n === 0) return ''
  const trust = n > 1e15 ? n / 1e18 : n
  if (trust >= 1000) return `${(trust / 1000).toFixed(1)}k TRUST`
  return `${trust.toFixed(1)} TRUST`
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const fetchMode = searchParams.get("mode")

    if (fetchMode === "triples") {
      const data = await gql(FETCH_TRIPLES_QUERY, {
        orderBy: [{ created_at: "desc" }],
        redemptionsOrderBy: [{ created_at: "desc" }],
        eventsOrderBy: [{ created_at: "desc" }],
      })

      if (data.errors) {
        console.error("[Search] GraphQL errors:", data.errors)
        return NextResponse.json({ triples: [] })
      }

      const triples = (data.data?.triples || []).map((triple: any) => {
        const subject = triple.subject
        const vault = triple.triple_vault
        return {
          id: subject?.label || "unknown",
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

    const limit = 50
    const search = `%${query}%`

    const [identitiesData, claimsData] = await Promise.all([
      gql(SEARCH_IDENTITIES_QUERY, { search, limit }),
      gql(SEARCH_CLAIMS_QUERY, { search, limit }),
    ])

    const seen = new Set<string>()

    const identities = (identitiesData.data?.vaults || [])
      .filter((v: any) => {
        const key = v.term?.id
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((v: any) => ({
        id: v.term.id,
        termId: v.term.id,
        label: v.term.atom?.label || "Unknown",
        image: v.term.atom?.image && v.term.atom.image !== 'null' ? v.term.atom.image : "",
        type: "atom",
        market_cap: v.market_cap || 0,
        position_count: v.position_count || 0,
        marketCapDisplay: formatMarketCap(v.market_cap),
      }))

    const claims = (claimsData.data?.triples || [])
      .filter((triple: any) => {
        const s = triple.subject?.label || "?"
        const p = triple.predicate?.label || "?"
        const o = triple.object?.label || "?"
        const key = `claim:${s}__${p}__${o}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((triple: any) => {
        const s = triple.subject?.label || "?"
        const p = triple.predicate?.label || "?"
        const o = triple.object?.label || "?"
        const termId = triple.triple_vault?.term?.id || ""
        return {
          id: `${s}__${p}__${o}`,
          termId,
          label: `${s} — ${p} — ${o}`,
          image: "",
          type: "claim",
          market_cap: triple.triple_vault?.market_cap || 0,
          position_count: triple.triple_vault?.position_count || 0,
          marketCapDisplay: formatMarketCap(triple.triple_vault?.market_cap),
        }
      })

    const combined = [...identities, ...claims]

    return NextResponse.json({
      triples: combined,
      total: combined.length,
      identityCount: identities.length,
      claimCount: claims.length,
      success: true,
    })
  } catch (error: any) {
    console.error("[Search] Error:", error)
    return NextResponse.json({ triples: [], error: error.message }, { status: 500 })
  }
}
