import { NextResponse } from 'next/server'
import { queryIntuitionGraphQL, TRENDING_DEPOSITS_QUERY, convertWeiToEther } from '@/lib/intuition-graphql'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendingItem {
  term_id: string
  term: any
  pctChange: number
  conditionsMet: number
  netDeposit: number
  depositCount: number
  maxSingleDeposit: number
}

interface TrendingCache {
  atom: TrendingItem | null
  triple: TrendingItem | null
  computedAt: number
}

// ─── Module-level cache (survives across requests within the same instance) ───

let cache: TrendingCache | null = null
const ONE_HOUR = 60 * 60 * 1000

// ─── Scoring logic ────────────────────────────────────────────────────────────

async function computeTrending(): Promise<{ atom: TrendingItem | null; triple: TrendingItem | null }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const data = await queryIntuitionGraphQL(TRENDING_DEPOSITS_QUERY, { since })
  const deposits: any[] = data?.deposits || []

  // Group deposits by term_id, keeping the vault metadata from the last occurrence
  const byTerm = new Map<string, { deposits: { assets: number }[]; vault: any }>()

  for (const dep of deposits) {
    const vault = dep.vault
    if (!vault?.term_id) continue
    const termId: string = vault.term_id
    if (!byTerm.has(termId)) {
      byTerm.set(termId, { deposits: [], vault })
    }
    byTerm.get(termId)!.deposits.push({
      assets: convertWeiToEther(dep.assets_after_fees || '0'),
    })
  }

  let bestAtom: TrendingItem | null = null
  let bestAtomScore = -1
  let bestTriple: TrendingItem | null = null
  let bestTripleScore = -1

  for (const [termId, { deposits: deps, vault }] of byTerm) {
    const marketCap = convertWeiToEther(vault.market_cap || '0')
    const positionCount: number = vault.position_count ?? 0
    const depositCount = deps.length
    const netDeposit = deps.reduce((s, d) => s + d.assets, 0)
    const maxSingleDeposit = deps.reduce((m, d) => Math.max(m, d.assets), 0)

    // ── Six conditions ──────────────────────────────────────────────────────
    // Condition A: ≥5 new deposit events in the last 24h
    const condA = depositCount >= 5

    // Condition B: Net deposit sum ≥5000 in the last 24h
    const condB = netDeposit >= 5000

    // Condition C: A single deposit ≥10000 in the last 24h
    const condC = maxSingleDeposit >= 10000

    // Condition D: Newly created (≤3 total positions = brand-new vault) with a deposit ≥1000
    const condD = positionCount <= 3 && maxSingleDeposit >= 1000

    // Condition E: Market cap >50k with at least one deposit ≥1000 in the last 24h
    const condE = marketCap > 50000 && maxSingleDeposit >= 1000

    // Condition F: Market cap >20k with 2+ deposits totaling ≥1500 in the last 24h
    const condF = marketCap > 20000 && depositCount >= 2 && netDeposit >= 1500

    const conditionsMet = [condA, condB, condC, condD, condE, condF].filter(Boolean).length

    // Must meet at least 2 conditions to qualify as trending
    if (conditionsMet < 2) continue

    // Compute 24h price-change percentage for display purposes
    const stats = vault.share_price_change_stats_daily?.[0]
    let pctChange = 0
    if (stats) {
      const first = parseFloat(stats.first_share_price || '0') / 1e18
      const last = parseFloat(stats.last_share_price || '0') / 1e18
      if (first >= 0.001) pctChange = ((last - first) / first) * 100
    }

    const item: TrendingItem = {
      term_id: termId,
      term: vault.term,
      pctChange,
      conditionsMet,
      netDeposit,
      depositCount,
      maxSingleDeposit,
    }

    // Higher conditionsMet score wins; ties go to the higher netDeposit
    if (vault.term?.atom) {
      if (
        conditionsMet > bestAtomScore ||
        (conditionsMet === bestAtomScore && netDeposit > (bestAtom?.netDeposit ?? 0))
      ) {
        bestAtomScore = conditionsMet
        bestAtom = item
      }
    } else if (vault.term?.triple) {
      if (
        conditionsMet > bestTripleScore ||
        (conditionsMet === bestTripleScore && netDeposit > (bestTriple?.netDeposit ?? 0))
      ) {
        bestTripleScore = conditionsMet
        bestTriple = item
      }
    }
  }

  return { atom: bestAtom, triple: bestTriple }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const now = Date.now()

    // Serve cached result if still within the 1-hour window
    if (cache && now - cache.computedAt < ONE_HOUR) {
      return NextResponse.json({
        atom: cache.atom,
        triple: cache.triple,
        cachedAt: cache.computedAt,
      })
    }

    const fresh = await computeTrending()

    // If fresh computation found nothing, preserve the previous cached results
    // so the UI keeps showing the last known trending items rather than going blank.
    cache = {
      atom: fresh.atom ?? (cache?.atom ?? null),
      triple: fresh.triple ?? (cache?.triple ?? null),
      computedAt: now,
    }

    console.log(
      `[Trending API] Recomputed — atom="${cache.atom?.term?.atom?.label ?? 'none'}" ` +
      `(conds=${cache.atom?.conditionsMet ?? 0}), ` +
      `triple="${cache.triple ? [cache.triple.term?.triple?.subject?.label, cache.triple.term?.triple?.predicate?.label, cache.triple.term?.triple?.object?.label].join(' ') : 'none'}" ` +
      `(conds=${cache.triple?.conditionsMet ?? 0})`
    )

    return NextResponse.json({
      atom: cache.atom,
      triple: cache.triple,
      cachedAt: cache.computedAt,
    })
  } catch (e) {
    console.error('[Trending API] Error computing trending:', e)
    // On error, serve stale cache rather than a broken UI
    if (cache) {
      return NextResponse.json({
        atom: cache.atom,
        triple: cache.triple,
        cachedAt: cache.computedAt,
      })
    }
    return NextResponse.json({ atom: null, triple: null, cachedAt: null }, { status: 500 })
  }
}
