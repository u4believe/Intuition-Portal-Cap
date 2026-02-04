import { type NextRequest, NextResponse } from 'next/server'

const GRAPHQL_ENDPOINT = 'https://mainnet.intuition.sh/v1/graphql'

// Search vaults, triples, and atoms
const SEARCH_QUERY = `
  query SearchClaims($search: String!, $limit: Int) {
    vaults(where: {term: {atom: {label: {_ilike: $search}}}}, limit: $limit, order_by: {market_cap: desc}) {
      term_id
      market_cap
      term {
        atom {
          label
          image
          type
        }
      }
    }
    triples(where: {subject: {label: {_ilike: $search}}}, limit: $limit, order_by: {created_at: desc}) {
      id
      subject {
        label
        image
        type
      }
    }
    atoms(where: {label: {_ilike: $search}}, limit: $limit, order_by: {created_at: desc}) {
      id
      label
      image
      type
    }
  }
`

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] })
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: {
          search: `%${query}%`,
          limit: 20,
        },
      }),
    })

    if (!response.ok) {
      console.error('[v0] GraphQL request failed:', response.statusText)
      return NextResponse.json({ results: [] })
    }

    const data = await response.json()

    if (data.errors) {
      console.error('[v0] GraphQL errors:', data.errors)
      return NextResponse.json({ results: [] })
    }

    // Combine and format results
    const results = []

    // Add vaults
    if (data.data?.vaults) {
      for (const vault of data.data.vaults) {
        results.push({
          id: vault.term_id,
          label: vault.term?.atom?.label || 'Unknown',
          image: vault.term?.atom?.image,
          type: 'vault',
          marketCap: vault.market_cap,
        })
      }
    }

    // Add triples
    if (data.data?.triples) {
      for (const triple of data.data.triples) {
        results.push({
          id: triple.id,
          label: triple.subject?.label || 'Unknown',
          image: triple.subject?.image,
          type: 'triple',
        })
      }
    }

    // Add atoms
    if (data.data?.atoms) {
      for (const atom of data.data.atoms) {
        results.push({
          id: atom.id,
          label: atom.label,
          image: atom.image,
          type: 'atom',
        })
      }
    }

    // Sort by market cap (vaults first if available)
    results.sort((a, b) => {
      if (a.type === 'vault' && b.type !== 'vault') return -1
      if (a.type !== 'vault' && b.type === 'vault') return 1
      return (b.marketCap || 0) - (a.marketCap || 0)
    })

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch (error) {
    console.error('[v0] Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
