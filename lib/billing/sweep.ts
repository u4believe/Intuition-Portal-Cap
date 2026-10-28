/**
 * Server-side client for the Sweep Console payment rail.
 * Docs: https://www.sweepconsole.xyz/docs (Mandates & Charges)
 *
 * The API key can charge every mandate up to its cap — never import this
 * from a client component.
 */
import crypto from 'crypto'
import type { BillingInterval } from './plans'

/**
 * Sweep serves each environment from its own host and refuses the other's keys
 * (403 wrong_environment): test_ keys → sandbox (Base/Arbitrum/Optimism Sepolia,
 * no minimum), live_ keys → live (mainnet, real USDC). The key decides, as in
 * Sweep's own SDK, so going live is only a key swap. SWEEP_API_URL overrides
 * (tunnels, tests).
 */
const HOSTS = { live: 'https://api.sweepconsole.xyz', test: 'https://api-sandbox.sweepconsole.xyz' } as const

export type SweepMode = 'live' | 'test'

/** Which environment the configured key belongs to, or null if none/unknown. */
export function sweepMode(): SweepMode | null {
  const key = process.env.SWEEP_API_KEY ?? ''
  if (key.startsWith('live_')) return 'live'
  if (key.startsWith('test_')) return 'test'
  return null
}

/**
 * Smallest charge Sweep accepts on mainnet (amount_below_minimum below it):
 * 2.00 USDC, set by Sweep to cover cross-chain collection fees. Testnet has none.
 */
export const LIVE_MIN_CHARGE = 2_000_000

export function minimumCharge(): number {
  return sweepMode() === 'live' ? LIVE_MIN_CHARGE : 0
}

function apiBase(): string {
  if (process.env.SWEEP_API_URL) return process.env.SWEEP_API_URL
  const mode = sweepMode()
  if (!mode) {
    throw new SweepError('SWEEP_API_KEY must start with live_ or test_', 500, 'not_configured')
  }
  return HOSTS[mode]
}

export class SweepError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    /** Set on mandate_exists: the payer's live mandate, and its link while still pending. */
    public mandateId?: string,
    public authorizationUrl?: string,
    /** Per-field messages on a 422. */
    public details?: Record<string, string>
  ) {
    super(message)
    this.name = 'SweepError'
  }
}

export interface SweepMandate {
  id: string
  status: string
  authorization_url: string | null
  authorization_url_expires_at?: string
  expires_at?: string
}

export interface SweepCharge {
  id: string
  status: string
  amount: number
}

function apiKey(): string {
  const key = process.env.SWEEP_API_KEY
  if (!key) throw new SweepError('SWEEP_API_KEY is not configured', 500, 'not_configured')
  return key
}

async function sweepRequest<T>(
  path: string,
  init: { method: string; body?: unknown; idempotencyKey?: string }
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  }
  if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey

  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  })

  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {}
  if (!res.ok) {
    const err = json?.error
    // A non-JSON error never came from the Sweep API itself — usually a
    // firewall in front of it (Cloudflare marks its blocks with cf-mitigated).
    const blockedBy =
      !err && (res.headers.get('cf-mitigated') || /cloudflare/i.test(res.headers.get('server') ?? ''))
        ? 'firewall'
        : null
    if (!err) {
      console.error(
        `[Sweep] Non-API ${res.status} from ${path} (server=${res.headers.get('server')}, cf-mitigated=${res.headers.get('cf-mitigated')}, cf-ray=${res.headers.get('cf-ray')}):`,
        text.slice(0, 300).replace(/\s+/g, ' ')
      )
    }
    throw new SweepError(
      err?.message || `Sweep API returned ${res.status}`,
      res.status,
      err?.code ?? (blockedBy ? `blocked_by_${blockedBy}_${res.status}` : undefined),
      err?.mandate_id,
      err?.authorization_url,
      err?.details
    )
  }
  // Responses are documented flat; tolerate a { data } envelope as well.
  return { status: res.status, data: (json?.data ?? json) as T }
}

export async function createMandate(input: {
  externalRef: string
  email?: string
  maxAmount: number
  interval: BillingInterval
  chains: readonly string[]
  expiresAt: Date
  returnUrl: string
  metadata?: Record<string, string>
}): Promise<SweepMandate> {
  const { data } = await sweepRequest<SweepMandate>('/v1/mandates', {
    method: 'POST',
    body: {
      external_ref: input.externalRef,
      email: input.email || undefined,
      max_amount: input.maxAmount,
      interval: input.interval,
      chains: input.chains,
      expires_at: input.expiresAt.toISOString(),
      return_url: input.returnUrl,
      metadata: input.metadata,
    },
  })
  return data
}

/** Answers 202 — the outcome arrives as charge.succeeded / charge.failed. */
export async function createCharge(input: {
  mandateId: string
  amount: number
  description: string
  idempotencyKey: string
}): Promise<SweepCharge> {
  const { data } = await sweepRequest<SweepCharge>('/v1/charges', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      mandate: input.mandateId,
      amount: input.amount,
      description: input.description,
    },
  })
  return data
}

export interface SweepChargeDetail extends SweepCharge {
  failure_code?: string | null
  source_chain?: string | null
  tx_hash?: string | null
}

export async function getCharge(chargeId: string): Promise<SweepChargeDetail> {
  const { data } = await sweepRequest<SweepChargeDetail>(`/v1/charges/${encodeURIComponent(chargeId)}`, {
    method: 'GET',
  })
  return data
}

export async function revokeMandate(mandateId: string): Promise<void> {
  await sweepRequest(`/v1/mandates/${encodeURIComponent(mandateId)}`, { method: 'DELETE' })
}

/** X-Sweep-Signature is `sha256=<hex>` — an HMAC-SHA256 of the raw request body. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | null): boolean {
  const secret = process.env.SWEEP_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
}
