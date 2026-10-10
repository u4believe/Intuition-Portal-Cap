/**
 * Premium subscription state + the billing logic around Sweep mandates.
 * Sweep has no schedule of its own: we create one charge per period —
 * the first when the mandate is authorized, renewals from a cron.
 * Server-only.
 */
import { Pool } from 'pg'
import {
  addInterval,
  formatUsdc,
  INTERVAL_LABEL,
  PLANS,
  type BillingInterval,
  type PlanId,
} from './plans'
import { createCharge, SweepError } from './sweep'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export type SubscriptionStatus =
  | 'pending'
  | 'authorized'
  | 'active'
  | 'incomplete'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface SubscriptionRow {
  user_ref: string
  plan: PlanId
  billing_interval: BillingInterval
  amount: string // BIGINT comes back from pg as a string
  status: SubscriptionStatus
  mandate_id: string | null
  mandate_expires_at: Date | null
  chain_ids: string[]
  email: string | null
  current_period_start: Date | null
  current_period_end: Date | null
  next_charge_at: Date | null
  last_failure_code: string | null
  created_at: Date
  updated_at: Date
}

/** Premium access follows the paid period, not the mandate status. */
export function hasPremiumAccess(sub: SubscriptionRow | null): boolean {
  return !!sub?.current_period_end && sub.current_period_end.getTime() > Date.now()
}

/** A subscription that is (or is about to be) collecting — don't sell a second one. */
export function isBillingLive(sub: SubscriptionRow | null): boolean {
  return !!sub && ['authorized', 'active', 'past_due'].includes(sub.status)
}

export async function getSubscription(userRef: string): Promise<SubscriptionRow | null> {
  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT * FROM billing_subscriptions WHERE user_ref = $1',
    [userRef]
  )
  return rows[0] ?? null
}

/** Records a freshly created (unsigned) mandate. Keeps any paid period intact. */
export async function savePendingSubscription(input: {
  userRef: string
  plan: PlanId
  interval: BillingInterval
  amount: number
  mandateId: string
  mandateExpiresAt: Date
  email: string | null
}): Promise<void> {
  await pool.query(
    `INSERT INTO billing_subscriptions
       (user_ref, plan, billing_interval, amount, status, mandate_id, mandate_expires_at, email, chain_ids, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, '[]'::jsonb, NOW())
     ON CONFLICT (user_ref) DO UPDATE SET
       plan = EXCLUDED.plan,
       billing_interval = EXCLUDED.billing_interval,
       amount = EXCLUDED.amount,
       status = 'pending',
       mandate_id = EXCLUDED.mandate_id,
       mandate_expires_at = EXCLUDED.mandate_expires_at,
       email = EXCLUDED.email,
       chain_ids = '[]'::jsonb,
       next_charge_at = NULL,
       last_failure_code = NULL,
       updated_at = NOW()`,
    [
      input.userRef,
      input.plan,
      input.interval,
      input.amount,
      input.mandateId,
      input.mandateExpiresAt,
      input.email,
    ]
  )
}

function chargeDescription(sub: SubscriptionRow, periodStart: Date, periodEnd: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `Portal Cap ${PLANS[sub.plan].name} (${INTERVAL_LABEL[sub.billing_interval].adjective}) — ${fmt(periodStart)} to ${fmt(periodEnd)}`
}

/**
 * Requests payment for one billing period. Safe to call repeatedly for the
 * same period: the idempotency key is mandate + period start.
 */
export async function chargeForPeriod(sub: SubscriptionRow, periodStart: Date): Promise<void> {
  if (!sub.mandate_id) throw new Error(`No mandate for ${sub.user_ref}`)

  const periodEnd = addInterval(periodStart, sub.billing_interval)
  const amount = Number(sub.amount)
  const idempotencyKey = `${sub.mandate_id}:${periodStart.toISOString()}`

  try {
    const charge = await createCharge({
      mandateId: sub.mandate_id,
      amount,
      description: chargeDescription(sub, periodStart, periodEnd),
      idempotencyKey,
    })
    await pool.query(
      `INSERT INTO billing_charges
         (id, user_ref, mandate_id, amount, idempotency_key, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [charge.id, sub.user_ref, sub.mandate_id, amount, idempotencyKey, periodStart, periodEnd]
    )
  } catch (err) {
    // Synchronous refusals (revoked, expired, over cap) — record and stop.
    if (err instanceof SweepError && err.status >= 400 && err.status < 500 && err.code) {
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = CASE WHEN current_period_end IS NOT NULL THEN 'past_due' ELSE 'incomplete' END,
                last_failure_code = $2, updated_at = NOW()
          WHERE user_ref = $1`,
        [sub.user_ref, err.code]
      )
      console.warn(`[Billing] Charge refused for ${sub.user_ref}: ${err.code} — ${err.message}`)
      return
    }
    throw err
  }
}

// ─── Webhook event handling ───────────────────────────────────────────────────

export interface SweepEvent {
  event_id: string
  event_type: string
  created_at: string
  external_ref?: string
  data?: Record<string, any>
}

/** Field names differ slightly between event types; take the first present. */
function pick(data: Record<string, any> | undefined, ...keys: string[]): any {
  for (const key of keys) if (data?.[key] != null) return data[key]
  return undefined
}

/** Returns false if the event was already processed (a retried delivery). */
export async function beginWebhookEvent(event: SweepEvent): Promise<boolean> {
  const { rows } = await pool.query<{ processed_at: Date | null }>(
    `INSERT INTO billing_webhook_events (event_id, event_type, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id) DO UPDATE SET event_id = EXCLUDED.event_id
     RETURNING processed_at`,
    [event.event_id, event.event_type, JSON.stringify(event)]
  )
  return !rows[0]?.processed_at
}

export async function finishWebhookEvent(eventId: string): Promise<void> {
  await pool.query('UPDATE billing_webhook_events SET processed_at = NOW() WHERE event_id = $1', [eventId])
}

export async function handleSweepEvent(event: SweepEvent): Promise<void> {
  const userRef = event.external_ref
  if (!userRef) {
    console.warn(`[Billing] ${event.event_type} ${event.event_id} has no external_ref — ignored`)
    return
  }
  const sub = await getSubscription(userRef)
  if (!sub) {
    console.warn(`[Billing] ${event.event_type} for unknown subscriber ${userRef} — ignored`)
    return
  }

  const data = event.data
  const mandateId = pick(data, 'mandate_id', 'mandate', 'id')

  switch (event.event_type) {
    case 'mandate.authorized': {
      if (mandateId && mandateId !== sub.mandate_id) {
        console.warn(`[Billing] Stale mandate ${mandateId} authorized for ${userRef} — ignored`)
        return
      }
      const chainIds = pick(data, 'chain_ids') ?? []
      const paidThrough = sub.current_period_end
      if (paidThrough && paidThrough.getTime() > Date.now()) {
        // Re-subscribing during a paid period: next charge starts when it ends.
        await pool.query(
          `UPDATE billing_subscriptions
              SET status = 'active', chain_ids = $2, next_charge_at = current_period_end, updated_at = NOW()
            WHERE user_ref = $1`,
          [userRef, JSON.stringify(chainIds)]
        )
        return
      }
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = 'authorized', chain_ids = $2, updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef, JSON.stringify(chainIds)]
      )
      // Anchor the first period on the event, not the clock: a retried delivery
      // must produce the same idempotency key or a lost 202 could double-charge.
      const authorizedAt = new Date(event.created_at)
      const periodStart = Number.isNaN(authorizedAt.getTime()) ? new Date() : authorizedAt
      await chargeForPeriod({ ...sub, status: 'authorized' }, periodStart)
      return
    }

    case 'charge.succeeded': {
      const chargeId = pick(data, 'charge_id', 'charge', 'id')
      const { rows } = await pool.query<{ period_start: Date; period_end: Date }>(
        `UPDATE billing_charges
            SET status = 'succeeded', source_chain = $2, tx_hash = $3, updated_at = NOW()
          WHERE id = $1
          RETURNING period_start, period_end`,
        [chargeId, pick(data, 'source_chain') ?? null, pick(data, 'tx_hash') ?? null]
      )
      const charge = rows[0]
      // The 202 and this webhook can race; throwing makes Sweep retry later.
      if (!charge) throw new Error(`charge.succeeded for unknown charge ${chargeId}`)
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = CASE WHEN status IN ('canceled', 'expired') THEN status ELSE 'active' END,
                current_period_start = $2,
                current_period_end = GREATEST(COALESCE(current_period_end, $3), $3),
                next_charge_at = CASE WHEN status IN ('canceled', 'expired') THEN NULL ELSE $3 END,
                last_failure_code = NULL,
                updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef, charge.period_start, charge.period_end]
      )
      return
    }

    case 'charge.failed': {
      const chargeId = pick(data, 'charge_id', 'charge', 'id')
      const failureCode = pick(data, 'failure_code') ?? 'unknown'
      await pool.query(
        `UPDATE billing_charges SET status = 'failed', failure_code = $2, updated_at = NOW() WHERE id = $1`,
        [chargeId, failureCode]
      )
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = CASE WHEN current_period_end IS NOT NULL THEN 'past_due' ELSE 'incomplete' END,
                last_failure_code = $2, updated_at = NOW()
          WHERE user_ref = $1 AND status NOT IN ('canceled', 'expired')`,
        [userRef, failureCode]
      )
      return
    }

    case 'mandate.revoked': {
      if (mandateId && mandateId !== sub.mandate_id) return
      // Disabling one chain's grant leaves the mandate chargeable on the others.
      if (pick(data, 'reason') === 'disabled_on_chain') {
        const chainId = pick(data, 'chain_id')
        const remaining = (sub.chain_ids ?? []).filter((id) => String(id) !== String(chainId))
        if (remaining.length > 0) {
          await pool.query(
            'UPDATE billing_subscriptions SET chain_ids = $2, updated_at = NOW() WHERE user_ref = $1',
            [userRef, JSON.stringify(remaining)]
          )
          return
        }
      }
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = 'canceled', next_charge_at = NULL, updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef]
      )
      return
    }

    case 'mandate.expired': {
      if (mandateId && mandateId !== sub.mandate_id) return
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = 'expired', next_charge_at = NULL, updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef]
      )
      return
    }

    case 'mandate.expiring':
      // TODO: prompt the subscriber to re-authorize before the mandate lapses.
      console.log(`[Billing] Mandate for ${userRef} expires in ${pick(data, 'days_remaining')} day(s)`)
      return

    default:
      console.log(`[Billing] Unhandled Sweep event ${event.event_type}`)
  }
}

export function formatSubscription(sub: SubscriptionRow | null) {
  if (!sub) return { subscription: null, isPremium: false }
  return {
    isPremium: hasPremiumAccess(sub),
    subscription: {
      plan: sub.plan,
      planName: PLANS[sub.plan]?.name ?? sub.plan,
      interval: sub.billing_interval,
      amount: Number(sub.amount),
      amountDisplay: formatUsdc(Number(sub.amount)),
      status: sub.status,
      currentPeriodEnd: sub.current_period_end?.toISOString() ?? null,
      nextChargeAt: sub.next_charge_at?.toISOString() ?? null,
      lastFailureCode: sub.last_failure_code,
    },
  }
}
