import { type NextRequest, NextResponse } from "next/server"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

// ── Atoms (identity) search ──────────────────────────────────────────────────
const SEARCH_ATOMS_QUERY = `
  query SearchAtoms($search: String!, $limit: Int) {
    vaults(
      where: {term: {atom: {label: {_ilike: $search}}}}
      limit: $limit
      order_by: {market_cap: desc}
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

// ── General claim search (any field) ─────────────────────────────────────────
const SEARCH_CLAIMS_QUERY = `
  query SearchClaims($search: String!, $limit: Int) {
    triples(
      where: {
        _or: [
          {subject:   {label: {_ilike: $search}}}
          {predicate: {label: {_ilike: $search}}}
          {object:    {label: {_ilike: $search}}}
        ]
      }
      limit: $limit
      order_by: {triple_vault: {market_cap: desc}}
    ) {
      subject   { label }
      predicate { label }
      object    { label }
      triple_vault {
        market_cap
        position_count
        term { id }
      }
    }
  }
`

// ── Triple field-by-field search (Subject / Predicate / Object individually) ─
const SEARCH_TRIPLES_FIELDS_QUERY = `
  query SearchTriplesByFields($subject: String!, $predicate: String!, $object: String!, $limit: Int) {
    triples(
      where: {
        _and: [
          {subject:   {label: {_ilike: $subject}}}
          {predicate: {label: {_ilike: $predicate}}}
          {object:    {label: {_ilike: $object}}}
        ]
      }
      limit: $limit
      order_by: {triple_vault: {market_cap: desc}}
    ) {
      subject   { label }
      predicate { label }
      object    { label }
      triple_vault {
        market_cap
        position_count
        term { id }
      }
    }
  }
`

// ── Triples-mode autocomplete for a single field (subject / predicate / object)
const AUTOCOMPLETE_FIELD_QUERY = `
  query AutocompleteField($search: String!, $limit: Int) {
    vaults(
      where: {term: {atom: {label: {_ilike: $search}}}}
      limit: $limit
      order_by: {market_cap: desc}
    ) {
      market_cap
      term { atom { label } }
    }
  }
`

const FETCH_TRIPLES_QUERY = `
  query Triples($orderBy: [triples_order_by!], $eventsOrderBy: [events_order_by!]) {
    triples(order_by: $orderBy) {
      subject { label image creator_id created_at }
      triple_vault { market_cap position_count }
      positions(order_by: $orderBy) { shares account_id }
    }
    events(order_by: $eventsOrderBy) { created_at }
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

function mapTriple(triple: any) {
  const s = triple.subject?.label || "?"
  const p = triple.predicate?.label || "?"
  const o = triple.object?.label || "?"
  const termId = triple.triple_vault?.term?.id || ""
  return {
    id: `${s}__${p}__${o}`,
    termId,
    label: `${s} — ${p} — ${o}`,
    subject: s,
    predicate: p,
    object: o,
    image: "",
    type: "claim",
    market_cap: triple.triple_vault?.market_cap || 0,
    position_count: triple.triple_vault?.position_count || 0,
    marketCapDisplay: formatMarketCap(triple.triple_vault?.market_cap),
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const mode = sp.get("mode")

    // ── Legacy triples fetch (not used by search UI) ─────────────────────────
    if (mode === "triples") {
      const data = await gql(FETCH_TRIPLES_QUERY, {
        orderBy: [{ created_at: "desc" }],
        eventsOrderBy: [{ created_at: "desc" }],
      })
      if (data.errors) return NextResponse.json({ triples: [] })
      const triples = (data.data?.triples || []).map((t: any) => ({
        id: t.subject?.label || "unknown",
        label: t.subject?.label || "Unknown",
        image: t.subject?.image && t.subject.image !== 'null' ? t.subject.image : "",
        type: "claim",
        market_cap: t.triple_vault?.market_cap || 0,
        position_count: t.triple_vault?.position_count || 0,
        positions: t.positions || [],
        created_at: t.subject?.created_at,
      }))
      return NextResponse.json({ triples, success: true })
    }

    // ── Atoms autocomplete for a field in triple search ───────────────────────
    if (mode === "field-autocomplete") {
      const q = sp.get("q") || ""
      if (q.trim().length < 1) return NextResponse.json({ suggestions: [] })
      const data = await gql(AUTOCOMPLETE_FIELD_QUERY, {
        search: `%${q}%`,
        limit: 8,
      })
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

    // ── Triples field-by-field search ─────────────────────────────────────────
    if (mode === "triples-fields") {
      const s = sp.get("s") || ""
      const p = sp.get("p") || ""
      const o = sp.get("o") || ""

      // Need at least one field
      if (!s.trim() && !p.trim() && !o.trim()) {
        return NextResponse.json({ triples: [], total: 0, success: true })
      }

      const data = await gql(SEARCH_TRIPLES_FIELDS_QUERY, {
        subject:   s.trim() ? `%${s}%` : "%%",
        predicate: p.trim() ? `%${p}%` : "%%",
        object:    o.trim() ? `%${o}%` : "%%",
        limit: 50,
      })

      const seen = new Set<string>()
      const results = (data.data?.triples || [])
        .filter((t: any) => {
          const key = `${t.subject?.label}__${t.predicate?.label}__${t.object?.label}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(mapTriple)

      return NextResponse.json({ triples: results, total: results.length, success: true })
    }

    // ── Atoms search ──────────────────────────────────────────────────────────
    if (mode === "atoms") {
      const q = sp.get("q") || ""
      if (!q.trim()) return NextResponse.json({ triples: [], total: 0, identityCount: 0, claimCount: 0, success: true })

      const data = await gql(SEARCH_ATOMS_QUERY, { search: `%${q}%`, limit: 50 })
      const seen = new Set<string>()
      const results = (data.data?.vaults || [])
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

      return NextResponse.json({ triples: results, total: results.length, identityCount: results.length, claimCount: 0, success: true })
    }

    // ── Default combined search (q param) ─────────────────────────────────────
    const query = sp.get("q")
    if (!query) return NextResponse.json({ triples: [] })

    const limit = 50
    const search = `%${query}%`

    const [identitiesData, claimsData] = await Promise.all([
      gql(SEARCH_ATOMS_QUERY,  { search, limit }),
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
      .filter((t: any) => {
        const key = `claim:${t.subject?.label}__${t.predicate?.label}__${t.object?.label}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(mapTriple)

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
