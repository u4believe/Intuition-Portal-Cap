/**
 * Read-only tools for the AI Analyst. Each one reuses an existing API route
 * handler (same queries and maths as the UI) and returns compact JSON.
 * Server-only.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GET as searchRoute } from '@/app/api/search-triples/route'
import { GET as vaultRoute } from '@/app/api/vault/route'
import { GET as walletPositionsRoute } from '@/app/api/wallet-positions/route'
import { GET as trendingRoute } from '@/app/api/trending/route'
import { GET as protocolStatsRoute } from '@/app/api/protocol-stats/route'
import { GET as trustPriceRoute } from '@/app/api/trust-price/route'

const INTERNAL = 'http://internal.portal-cap'
// Keeps one tool result from flooding the context window.
const MAX_RESULT_CHARS = 20_000

/** Display names for the UI while a tool runs. */
export const TOOL_LABELS: Record<string, string> = {
  search_intuition: 'Searching Intuition',
  find_claims: 'Finding claims',
  get_term_details: 'Reading vault details',
  get_wallet_positions: 'Loading wallet positions',
  get_trending: 'Checking what’s trending',
  get_market_overview: 'Checking protocol stats',
}

const round = (n: unknown, digits = 4) =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null
const fromWei = (raw: unknown) => {
  const n = typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) ? round(n / 1e18) : null
}

async function readJson(res: Response): Promise<any> {
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `upstream returned ${res.status}`)
  return body
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

// Defaults and coercion keep models that omit fields or send "10" for 10 working.
const Limit = z.coerce.number().int().min(1).max(25).default(10)
const SearchInput = z.object({
  query: z.string().min(1).max(200),
  kind: z.enum(['all', 'atoms', 'claims']).default('all'),
  limit: Limit,
})
const FindClaimsInput = z.object({
  subject: z.string().max(200).default(''),
  predicate: z.string().max(200).default(''),
  object: z.string().max(200).default(''),
  limit: Limit,
})
const TermInput = z.object({ term_id: z.string().min(1).max(200) })
const WalletInput = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x address') })
const EmptyInput = z.object({})

// ─── Handlers ────────────────────────────────────────────────────────────────

function mapSearchHit(t: any) {
  return {
    term_id: t.termId,
    type: t.type === 'claim' ? 'claim' : 'atom',
    label: t.label,
    market_cap_trust: fromWei(t.market_cap),
    positions: t.position_count ?? 0,
  }
}

async function searchIntuition(input: z.infer<typeof SearchInput>) {
  const params = new URLSearchParams({ q: input.query })
  if (input.kind === 'atoms') params.set('mode', 'atoms')
  const body = await readJson(await searchRoute(new NextRequest(`${INTERNAL}/api/search-triples?${params}`)))
  let hits = (body.triples ?? []).map(mapSearchHit)
  if (input.kind === 'claims') hits = hits.filter((h: any) => h.type === 'claim')
  return { total_matches: hits.length, results: hits.slice(0, input.limit) }
}

async function findClaims(input: z.infer<typeof FindClaimsInput>) {
  const params = new URLSearchParams({ mode: 'triples-fields', s: input.subject, p: input.predicate, o: input.object })
  const body = await readJson(await searchRoute(new NextRequest(`${INTERNAL}/api/search-triples?${params}`)))
  const hits = (body.triples ?? []).map(mapSearchHit)
  return { total_matches: hits.length, results: hits.slice(0, input.limit) }
}

function summarizeSide(side: any) {
  if (!side) return null
  const holders = [...(side.vaultPositions ?? []), ...(side.linVaultPositions ?? [])]
    .sort((a: any, b: any) => b.shares - a.shares)
    .slice(0, 10)
    .map((p: any) => ({ account: p.accountId, shares: round(p.shares) }))
  return {
    total_market_cap_trust: round(side.totalMarketCap),
    total_assets_trust: round(side.totalAssets),
    share_price_change_24h_pct: round(side.sharePriceChange24h, 2),
    linear_curve: {
      market_cap_trust: round(side.linMarketCap),
      share_price_trust: round(side.linSharePrice, 6),
      positions: side.linPositionCount,
    },
    exponential_curve:
      side.expMarketCap === null
        ? null
        : {
            market_cap_trust: round(side.expMarketCap),
            share_price_trust: round(side.expSharePrice, 6),
            positions: side.expPositionCount,
          },
    top_holders: holders,
    recent_deposits: (side.vaultDeposits ?? []).slice(-10).map((d: any) => ({ at: d.createdAt, shares: round(d.shares) })),
    recent_redemptions: (side.vaultRedemptions ?? []).slice(-10).map((r: any) => ({ at: r.createdAt, shares: round(r.shares) })),
  }
}

async function getTermDetails(input: z.infer<typeof TermInput>) {
  const res = await vaultRoute(new Request(`${INTERNAL}/api/vault?termId=${encodeURIComponent(input.term_id)}`))
  if (res.status === 404) return { error: `No atom or claim found with term_id ${input.term_id}` }
  const { claim } = await readJson(res)
  const isClaim = !!claim.subjectLabel
  return {
    term_id: input.term_id,
    type: isClaim ? 'claim' : 'atom',
    label: claim.label,
    ...(isClaim
      ? { subject: claim.subjectLabel, predicate: claim.predicateLabel, object: claim.objectLabel }
      : { atom_type: claim.atomType || null, created_at: claim.createdAt || null, creator: claim.creator?.label || claim.creator?.id || null }),
    support: summarizeSide(claim.support),
    oppose: isClaim ? summarizeSide(claim.oppose) : undefined,
    portal_url: `/vault/${input.term_id}`,
  }
}

async function getWalletPositions(input: z.infer<typeof WalletInput>) {
  const body = await readJson(
    await walletPositionsRoute(new Request(`${INTERNAL}/api/wallet-positions?address=${input.address}`))
  )
  const positions = [...(body.positions ?? [])]
    .sort((a: any, b: any) => b.currentValue - a.currentValue)
    .slice(0, 30)
    .map((p: any) => ({
      term_id: p.termId,
      type: p.type === 'Claim' ? 'claim' : 'atom',
      label: p.label,
      curve: p.curve,
      shares: round(p.shares),
      value_trust: round(p.currentValue),
      redeemable_trust: round(p.redeemableValue),
      net_deposited_trust: round(p.totalDeposited - p.totalRedeemed),
      unrealized_pnl_trust: round(p.unrealizedPnl),
      unrealized_pnl_pct: round(p.unrealizedPnlPct, 2),
    }))
  return {
    address: input.address,
    position_count: body.total ?? positions.length,
    shown: positions.length,
    total_value_trust: round(body.totalValue),
    total_unrealized_pnl_trust: round(body.totalUnrealizedPnl),
    total_unrealized_pnl_pct: round(body.totalUnrealizedPnlPct, 2),
    positions,
  }
}

async function getTrending() {
  const body = await readJson(await trendingRoute())
  return {
    computed_at: body.cachedAt ? new Date(body.cachedAt).toISOString() : null,
    items: (body.items ?? []).map((i: any) => ({
      term_id: i.term_id,
      type: i.type,
      label: i.label,
      largest_single_deposit_trust: round(i.maxSingleDeposit),
      recent_transactions: i.txCount,
    })),
  }
}

async function getMarketOverview() {
  const [stats, price] = await Promise.allSettled([
    protocolStatsRoute().then(readJson),
    trustPriceRoute().then(readJson),
  ])
  return {
    total_staked_trust: stats.status === 'fulfilled' ? round(stats.value.totalStakedTrust, 2) : null,
    unique_addresses: stats.status === 'fulfilled' ? stats.value.uniqueAddresses : null,
    trust_price_usd: price.status === 'fulfilled' ? Number(price.value.priceUsd) || null : null,
    trust_price_change_24h_pct: price.status === 'fulfilled' ? price.value.priceChange24h : null,
    trust_liquidity_usd: price.status === 'fulfilled' ? price.value.liquidity : null,
  }
}

// ─── Definitions (order and text are part of the cached prefix — keep stable) ──

const strictObject = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false,
})

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_intuition',
    description:
      'Keyword search across Intuition atoms (entities) and claims (subject–predicate–object triples), ranked by market cap. Use this first to find term_ids for anything the user names.',
    input_schema: strictObject(
      {
        query: { type: 'string', description: 'Keyword(s) to match against labels, e.g. "ethereum"' },
        kind: { type: 'string', enum: ['all', 'atoms', 'claims'], description: 'Restrict to atoms or claims, or search both' },
        limit: { type: 'integer', description: 'Max results to return (1–25)' },
      },
      ['query', 'kind', 'limit']
    ),
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: 'find_claims',
    description:
      'Find claims by matching their subject, predicate and object separately (substring match; pass "" for any part you do not want to constrain). Example: subject "vitalik", predicate "", object "" lists claims about Vitalik.',
    input_schema: strictObject(
      {
        subject: { type: 'string' },
        predicate: { type: 'string' },
        object: { type: 'string' },
        limit: { type: 'integer', description: 'Max results to return (1–25)' },
      },
      ['subject', 'predicate', 'object', 'limit']
    ),
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: 'get_term_details',
    description:
      'Full market data for one atom or claim by term_id: market cap, share prices on the linear and exponential bonding curves, 24h share-price change, top holders, recent deposits/redemptions. For claims, "support" is the claim vault and "oppose" is its counter-claim vault.',
    input_schema: strictObject({ term_id: { type: 'string', description: 'The term_id from a search result' } }, ['term_id']),
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: 'get_wallet_positions',
    description:
      'A wallet’s open positions with current value, redeemable value and unrealized PnL in TRUST (largest 30 by value), plus portfolio totals.',
    input_schema: strictObject({ address: { type: 'string', description: '0x-prefixed EVM address' } }, ['address']),
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: 'get_trending',
    description: 'Atoms and claims with unusual recent activity (large single deposits or many transactions).',
    input_schema: strictObject({}, []),
    strict: true,
    eager_input_streaming: true,
  },
  {
    name: 'get_market_overview',
    description: 'Protocol-wide stats: total TRUST staked, number of unique addresses, and the TRUST token price.',
    input_schema: strictObject({}, []),
    strict: true,
    eager_input_streaming: true,
  },
]

const HANDLERS: Record<string, { schema: z.ZodTypeAny; run: (input: any) => Promise<unknown> }> = {
  search_intuition: { schema: SearchInput, run: searchIntuition },
  find_claims: { schema: FindClaimsInput, run: findClaims },
  get_term_details: { schema: TermInput, run: getTermDetails },
  get_wallet_positions: { schema: WalletInput, run: getWalletPositions },
  get_trending: { schema: EmptyInput, run: getTrending },
  get_market_overview: { schema: EmptyInput, run: getMarketOverview },
}

/** OpenAI-compatible function definitions for the same tools. */
export const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] = TOOLS.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema as unknown as Record<string, unknown>,
  },
}))

/** Runs one tool call. Failures come back as isError results; never throws. */
export async function executeTool(name: string, input: unknown): Promise<{ content: string; isError: boolean }> {
  const handler = HANDLERS[name]
  if (!handler) return { content: `Unknown tool ${name}`, isError: true }
  // Model-supplied input is untrusted (and streamed input is parsed tolerantly): validate first.
  const parsed = handler.schema.safeParse(input ?? {})
  if (!parsed.success) {
    return {
      content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}`,
      isError: true,
    }
  }
  try {
    let text = JSON.stringify(await handler.run(parsed.data))
    if (text.length > MAX_RESULT_CHARS) text = text.slice(0, MAX_RESULT_CHARS) + '…[truncated]'
    return { content: text, isError: false }
  } catch (err: any) {
    console.error(`[AI Tools] ${name} failed:`, err)
    return {
      content: `The data source failed: ${err?.message ?? 'unknown error'}. Tell the user if this blocks the answer.`,
      isError: true,
    }
  }
}

/** Anthropic adapter: a tool_use block in, a tool_result block out. */
export async function runTool(block: Anthropic.Beta.BetaToolUseBlock): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const { content, isError } = await executeTool(block.name, block.input)
  return { type: 'tool_result', tool_use_id: block.id, content, ...(isError ? { is_error: true } : {}) }
}
