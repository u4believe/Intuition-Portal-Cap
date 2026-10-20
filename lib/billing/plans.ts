/**
 * Premium plan catalogue — shared by the pricing/checkout UI and the billing API.
 * Prices are USDC micro-units (6 decimals): 9_000_000 = 9.00 USDC.
 */

export type BillingInterval = 'daily' | 'monthly' | 'yearly'

/** Display order in the pricing toggle and checkout. */
export const BILLING_INTERVALS: BillingInterval[] = ['daily', 'monthly', 'yearly']
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
    'Private activity — keep your transactions out of other users’ alerts',
    'Early access to new AI features',
  ],
  prices: {
    daily: { amount: 1_000_000 },
    monthly: { amount: 9_000_000 },
    yearly: { amount: 90_000_000, savingsLabel: '2 months free' },
  },
}

export const PLANS: Record<PlanId, Plan> = { premium: PREMIUM_PLAN }

export const INTERVAL_LABEL: Record<BillingInterval, { adjective: string; noun: string }> = {
  daily: { adjective: 'Daily', noun: 'day' },
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
  return typeof value === 'string' && (BILLING_INTERVALS as string[]).includes(value)
}

export function formatUsdc(microUnits: number): string {
  return (microUnits / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Sweep enforces each mandate's ceiling over fixed windows measured from the
 * moment the payer signed (its `period_duration`): a "month" is 30 days, not a
 * calendar month. Billing periods use the same lengths so a renewal never lands
 * before Sweep's window has reset.
 */
export const PERIOD_SECONDS: Record<BillingInterval, number> = {
  daily: 86_400,
  monthly: 2_592_000, // 30 days
  yearly: 31_536_000, // 365 days
}

export function addInterval(date: Date, interval: BillingInterval): Date {
  return new Date(date.getTime() + PERIOD_SECONDS[interval] * 1000)
}
