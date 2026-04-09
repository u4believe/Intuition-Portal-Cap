import { NextResponse } from 'next/server'
import { queryIntuitionGraphQL, TRENDING_DEPOSITS_QUERY, convertWeiToEther } from '@/lib/intuition-graphql'

// ─── Thresholds ───────────────────────────────────────────────────────────────

const MAX_ITEMS = 10
const MIN_SINGLE_DEPOSIT = 5000   // TRUST — any single deposit at/above this qualifies
const MIN_TX_COUNT = 10           // total deposit transactions in 24h

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendingItem {
  term_id: string
  type: 'atom' | 'triple'
  label: string
  maxSingleDeposit: number   // TRUST
  txCount: number
  score: number              // normalized composite score used for ranking
}

interface TrendingCache {
  items: TrendingItem[]
  computedAt: number
}

// ─── Module-level cache ───────────────────────────────────────────────────────

let cache: TrendingCache | null = null
const ONE_HOUR = 60 * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(term: any): string {
  if (term?.atom) return term.atom.label || 'Unknown'
  if (term?.triple) {
    const { subject, predicate, object } = term.triple
    return [subject?.label, predicate?.label, object?.label].filter(Boolean).join(' · ')
  }
  return 'Unknown'
}

// ─── Core computation ─────────────────────────────────────────────────────────

async function computeTrending(): Promise<TrendingItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const data = await queryIntuitionGraphQL(TRENDING_DEPOSITS_QUERY, { since })
  const deposits: any[] = data?.deposits || []

  // Group deposits by vault term_id
  const byTerm = new Map<string, { deposits: number[]; vault: any }>()

  for (const dep of deposits) {
    const vault = dep.vault
    if (!vault?.term_id) continue
    const termId: string = vault.term_id
    if (!byTerm.has(termId)) byTerm.set(termId, { deposits: [], vault })
    byTerm.get(termId)!.deposits.push(convertWeiToEther(dep.assets_after_fees || '0'))
  }

  const qualifying: TrendingItem[] = []

  for (const [termId, { deposits: deps, vault }] of byTerm) {
    const maxSingleDeposit = deps.reduce((m, d) => Math.max(m, d), 0)
    const txCount = deps.length

    // Qualify on EITHER criterion
    const meetsDeposit = maxSingleDeposit >= MIN_SINGLE_DEPOSIT
    const meetsTx = txCount >= MIN_TX_COUNT
    if (!meetsDeposit && !meetsTx) continue

    // Skip vaults with no recognisable term type
    const isAtom = !!vault.term?.atom
    const isTriple = !!vault.term?.triple
    if (!isAtom && !isTriple) continue

    // Normalised score: how many multiples above the threshold each metric is.
    // Taking the max means the stronger criterion drives the ranking.
    const score = Math.max(maxSingleDeposit / MIN_SINGLE_DEPOSIT, txCount / MIN_TX_COUNT)

    qualifying.push({
      term_id: termId,
      type: isAtom ? 'atom' : 'triple',
      label: getLabel(vault.term),
      maxSingleDeposit,
      txCount,
      score,
    })
  }

  // Highest score first; take top 10 overall (any split of atoms/triples)
  qualifying.sort((a, b) => b.score - a.score)
  return qualifying.slice(0, MAX_ITEMS)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const now = Date.now()

    if (cache && now - cache.computedAt < ONE_HOUR) {
      return NextResponse.json({ items: cache.items, cachedAt: cache.computedAt })
    }

    const fresh = await computeTrending()

    cache = {
      items: fresh.length ? fresh : (cache?.items ?? []),
      computedAt: now,
    }

    const claims = cache.items.filter(i => i.type === 'triple').length
    const identities = cache.items.filter(i => i.type === 'atom').length
    console.log(`[Trending API] Recomputed — ${cache.items.length} items (${claims} claims, ${identities} identities)`)

    return NextResponse.json({ items: cache.items, cachedAt: cache.computedAt })
  } catch (e) {
    console.error('[Trending API] Error:', e)
    if (cache) return NextResponse.json({ items: cache.items, cachedAt: cache.computedAt })
    return NextResponse.json({ items: [], cachedAt: null }, { status: 500 })
  }
}
