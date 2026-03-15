import { type NextRequest, NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

// ── Shared GQL helper ─────────────────────────────────────────────────────────
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
  if (!raw) return ""
  const n = typeof raw === "string" ? parseFloat(raw) : raw
  if (isNaN(n) || n === 0) return ""
  // values come in wei-scale (1e18)
  const trust = n > 1e15 ? n / 1e18 : n
  if (trust >= 1000) return `${(trust / 1000).toFixed(1)}k TRUST`
  return `${trust.toFixed(1)} TRUST`
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS (identity) search
// Uses the SAME vaults table the AtomsTable uses so results are consistent.
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_ATOMS_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    vaults(
      where: { term: { atom: { label: { _ilike: $search } } } }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      term {
        id
        atom { label image }
      }
    }
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// TRIPLES search — keyword across any field
// Uses the SAME vaults table the TriplesTable uses.
// Filters to vaults that have a triple (term.triple) and whose subject/predicate/
// object label matches the keyword.
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_TRIPLES_KEYWORD_QUERY = `
  query SearchTriplesKeyword($search: String!, $limit: Int) {
    vaults(
      where: {
        term: {
          triple: {
            _or: [
              { subject:   { label: { _ilike: $search } } }
              { predicate: { label: { _ilike: $search } } }
              { object:    { label: { _ilike: $search } } }
            ]
          }
        }
      }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      term {
        id
        triple {
          subject   { label }
          predicate { label }
          object    { label }
        }
      }
    }
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// TRIPLES field-by-field search (S/P/O individually)
// Also uses vaults so coverage is identical to the TriplesTable.
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_TRIPLES_FIELDS_QUERY = `
  query SearchTriplesByFields(
    $subject: String!
    $predicate: String!
    $object: String!
    $limit: Int
  ) {
    vaults(
      where: {
        term: {
          triple: {
            _and: [
              { subject:   { label: { _ilike: $subject   } } }
              { predicate: { label: { _ilike: $predicate } } }
              { object:    { label: { _ilike: $object    } } }
            ]
          }
        }
      }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      market_cap
      position_count
      term {
        id
        triple {
          subject   { label }
          predicate { label }
          object    { label }
        }
      }
    }
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// Field autocomplete — same vaults/atom query as atom search
// ─────────────────────────────────────────────────────────────────────────────
const AUTOCOMPLETE_FIELD_QUERY = `
  query AutocompleteField($search: String!, $limit: Int) {
    vaults(
      where: { term: { atom: { label: { _ilike: $search } } } }
      limit: $limit
      order_by: { market_cap: desc }
    ) {
      market_cap
      term { atom { label } }
    }
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────
function mapAtomVault(v: any) {
  return {
    id: v.term.id,
    termId: v.term.id,
    label: v.term.atom?.label || "Unknown",
    image: v.term.atom?.image && v.term.atom.image !== "null" ? v.term.atom.image : "",
    type: "atom",
    market_cap: v.market_cap || 0,
    position_count: v.position_count || 0,
    marketCapDisplay: formatMarketCap(v.market_cap),
  }
}

function mapTripleVault(v: any) {
  const triple = v.term?.triple
  const s = triple?.subject?.label || "?"
  const p = triple?.predicate?.label || "?"
  const o = triple?.object?.label || "?"
  const mc = v.market_cap ? parseFloat(v.market_cap) : 0
  return {
    id: `${v.term.id}`,
    termId: v.term.id,
    label: `${s} — ${p} — ${o}`,
    subject: s,
    predicate: p,
    object: o,
    image: "",
    type: "claim",
    market_cap: mc,
    position_count: v.position_count || 0,
    marketCapDisplay: formatMarketCap(mc),
    _contentKey: `${s}__${p}__${o}`,
  }
}

// Deduplicate triples by content (S/P/O), keeping the vault with highest market cap
function dedupeTriples(vaults: any[]): any[] {
  const map = new Map<string, any>()
  for (const v of vaults) {
    const key = v._contentKey
    const existing = map.get(key)
    if (!existing || v.market_cap > existing.market_cap) {
      map.set(key, v)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.market_cap - a.market_cap)
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const mode = sp.get("mode")

    // ── Atoms mode ─────────────────────────────────────────────────────────
    if (mode === "atoms") {
      const q = sp.get("q") || ""
      if (!q.trim()) return NextResponse.json({ triples: [], total: 0, identityCount: 0, claimCount: 0, success: true })

      const data = await gql(SEARCH_ATOMS_QUERY, { search: `%${q}%`, limit: 200 })
      const seen = new Set<string>()
      const results = (data.data?.vaults || [])
        .filter((v: any) => {
          if (!v.term?.atom) return false
          const key = v.term.id
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(mapAtomVault)

      return NextResponse.json({ triples: results, total: results.length, identityCount: results.length, claimCount: 0, success: true })
    }

    // ── Triples field-by-field mode ────────────────────────────────────────
    if (mode === "triples-fields") {
      const s = sp.get("s") || ""
      const p = sp.get("p") || ""
      const o = sp.get("o") || ""
      if (!s.trim() && !p.trim() && !o.trim()) {
        return NextResponse.json({ triples: [], total: 0, success: true })
      }

      const data = await gql(SEARCH_TRIPLES_FIELDS_QUERY, {
        subject:   s.trim() ? `%${s}%` : "%%",
        predicate: p.trim() ? `%${p}%` : "%%",
        object:    o.trim() ? `%${o}%` : "%%",
        limit: 200,
      })

      const raw = (data.data?.vaults || [])
        .filter((v: any) => !!v.term?.triple)
        .map(mapTripleVault)
      const results = dedupeTriples(raw)
      return NextResponse.json({ triples: results, total: results.length, success: true })
    }

    // ── Field autocomplete ─────────────────────────────────────────────────
    if (mode === "field-autocomplete") {
      const q = sp.get("q") || ""
      if (q.trim().length < 1) return NextResponse.json({ suggestions: [] })
      const data = await gql(AUTOCOMPLETE_FIELD_QUERY, { search: `%${q}%`, limit: 8 })
      const seen = new Set<string>()
      const suggestions = (data.data?.vaults || [])
        .filter((v: any) => {
          const label = v.term?.atom?.label
          if (!label || seen.has(label)) return false
          seen.add(label)
          return true
        })
        .map((v: any) => ({
          label: v.term.atom.label,
          marketCapDisplay: formatMarketCap(v.market_cap),
        }))
      return NextResponse.json({ suggestions })
    }

    // ── Legacy triples-fetch mode (kept for compat) ────────────────────────
    if (mode === "triples") {
      return NextResponse.json({ triples: [], success: true })
    }

    // ── Default combined search (q= param) ────────────────────────────────
    // Runs atom search + triple keyword search in parallel using the SAME
    // vaults table the tables use, so coverage is identical.
    const query = sp.get("q")
    if (!query) return NextResponse.json({ triples: [] })

    const search = `%${query}%`
    const limit = 200

    const [atomsData, triplesData] = await Promise.all([
      gql(SEARCH_ATOMS_QUERY, { search, limit }),
      gql(SEARCH_TRIPLES_KEYWORD_QUERY, { search, limit }),
    ])

    const seen = new Set<string>()

    const identities = (atomsData.data?.vaults || [])
      .filter((v: any) => {
        if (!v.term?.atom) return false
        const key = v.term.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(mapAtomVault)

    const claimsRaw = (triplesData.data?.vaults || [])
      .filter((v: any) => {
        if (!v.term?.triple) return false
        const key = v.term.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(mapTripleVault)
    const claims = dedupeTriples(claimsRaw)

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
