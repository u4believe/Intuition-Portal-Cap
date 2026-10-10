/**
 * Premium plan catalogue — shared by the pricing/checkout UI and the billing API.
 * Prices are USDC micro-units (6 decimals): 9_000_000 = 9.00 USDC.
 */

export type BillingInterval = 'monthly' | 'yearly'
export type PlanId = 'premium'

export interface PlanPrice {
  amount: number
  /** Shown next to yearly pricing, e.g. "2 months free" */
  savingsLabel?: string
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  features: string[]
  prices: Record<BillingInterval, PlanPrice>
}

export const FREE_FEATURES = [
  'Live deposit & redemption feed',
  'Browse claims, atoms and vaults',
  'Watchlist with push alerts',
  'Wallet positions & unrealized PnL',
]

export const PREMIUM_PLAN: Plan = {
  id: 'premium',
  name: 'Premium',
  tagline: 'AI-powered claim intelligence on top of everything in Free.',
  features: [
    'Everything in Free',
    'AI analyst — ask anything about a claim, atom or vault',
    'AI summaries of your watchlist and positions',
    'Plain-English explanations for every smart alert',
    'Early access to new AI features',
  ],
  prices: {
    monthly: { amount: 9_000_000 },
    yearly: { amount: 90_000_000, savingsLabel: '2 months free' },
  },
}

export const PLANS: Record<PlanId, Plan> = { premium: PREMIUM_PLAN }

export const INTERVAL_LABEL: Record<BillingInterval, { adjective: string; noun: string }> = {
  monthly: { adjective: 'Monthly', noun: 'month' },
  yearly: { adjective: 'Yearly', noun: 'year' },
}

/** Networks a payer can authorize on. Sweep settles every charge to Arc. */
export const PAYMENT_CHAINS = ['base', 'arbitrum', 'optimism'] as const
export const PAYMENT_CHAIN_LABELS: Record<(typeof PAYMENT_CHAINS)[number], string> = {
  base: 'Base',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
}

/** Sweep only issues test-mode keys today; flip when live keys exist. */
export const BILLING_TESTNET = true

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLANS
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'yearly'
}

export function formatUsdc(microUnits: number): string {
  return (microUnits / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function addInterval(date: Date, interval: BillingInterval): Date {
  const next = new Date(date)
  if (interval === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1)
  else next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}
