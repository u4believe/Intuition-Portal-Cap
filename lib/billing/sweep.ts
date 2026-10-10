/**
 * Server-side client for the Sweep Console payment rail.
 * Docs: https://www.sweepconsole.xyz/docs (Mandates & Charges)
 *
 * The API key can charge every mandate up to its cap — never import this
 * from a client component.
 */
import crypto from 'crypto'
import type { BillingInterval } from './plans'

const SWEEP_API_URL = process.env.SWEEP_API_URL || 'https://api.sweepconsole.xyz'

export class SweepError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
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

  const res = await fetch(`${SWEEP_API_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  })

  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const err = json?.error
    throw new SweepError(err?.message || `Sweep API returned ${res.status}`, res.status, err?.code)
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
