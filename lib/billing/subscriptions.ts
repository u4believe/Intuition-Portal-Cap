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
import { createCharge, getCharge, SweepError } from './sweep'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Per interval: how long Premium stays on after a renewal fails (grace), and
 * the delay before each retry — once exhausted the subscription lapses. Both
 * must fit well inside one period, or the next renewal arrives mid-retry.
 */
export const RENEWAL_POLICY: Record<BillingInterval, { graceHours: number; retryDelaysHours: number[] }> = {
  daily: { graceHours: 12, retryDelaysHours: [1, 3, 6] },
  monthly: { graceHours: 72, retryDelaysHours: [24, 72, 120] },
  yearly: { graceHours: 72, retryDelaysHours: [24, 72, 120] },
}
/**
 * Renewals run this long after the period ends, so they never reach Sweep a
 * moment before its window (anchored on its own authorization timestamp) resets.
 */
const RENEWAL_BUFFER_MS = 5 * 60 * 1000
const nextChargeAfter = (periodEnd: Date) => new Date(periodEnd.getTime() + RENEWAL_BUFFER_MS)
/** Refusals that no retry can fix — the payer must authorize a new mandate. */
const PERMANENT_FAILURES = new Set([
  'mandate_revoked',
  'mandate_not_active',
  'mandate_expired',
  'amount_over_cap',
  'grant_disabled', // payer disabled the permission in their wallet
])
/** Failures that are our configuration problem, not the payer's: retry without penalty. */
const MERCHANT_FAILURES = new Set(['no_payout_wallet', 'rail_not_enabled'])
const MERCHANT_RETRY_MINUTES = 60
/** A charge still pending after this long is checked with GET /v1/charges/:id. */
const PENDING_RECONCILE_AFTER_MINUTES = 30
const RENEWAL_BATCH_SIZE = 50
// Arbitrary constant: pg advisory lock id so overlapping cron runs don't race.
const RENEWAL_LOCK_ID = 74_210_001

export type SubscriptionStatus =
  | 'pending'
  | 'authorized'
  | 'active'
  | 'incomplete'
  | 'past_due'
  | 'lapsed'
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
  renewal_attempts: number
  created_at: Date
  updated_at: Date
}

/** End of access: the paid period, plus a grace window while a renewal is retried. */
export function accessEndsAt(sub: SubscriptionRow | null): Date | null {
  if (!sub?.current_period_end) return null
  if (sub.status !== 'past_due') return sub.current_period_end
  const { graceHours } = RENEWAL_POLICY[sub.billing_interval]
  return new Date(sub.current_period_end.getTime() + graceHours * 60 * 60 * 1000)
}

/** Premium access follows the paid period, not the mandate status. */
export function hasPremiumAccess(sub: SubscriptionRow | null): boolean {
  const endsAt = accessEndsAt(sub)
  return !!endsAt && endsAt.getTime() > Date.now()
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
       renewal_attempts = 0,
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
 * Records a failed charge (synchronous refusal or charge.failed).
 * First charge → incomplete. Renewal → past_due with the next retry
 * scheduled, or lapsed once retries run out or the failure is permanent.
 */
async function recordChargeFailure(userRef: string, failureCode: string): Promise<void> {
  const sub = await getSubscription(userRef)
  if (!sub || sub.status === 'canceled' || sub.status === 'expired') return

  if (MERCHANT_FAILURES.has(failureCode)) {
    // Fix it in the Sweep dashboard; the payer keeps their status and we retry.
    console.error(`[Billing] Charge for ${userRef} blocked by merchant setup: ${failureCode} — retrying in ${MERCHANT_RETRY_MINUTES} min`)
    await pool.query(
      `UPDATE billing_subscriptions
          SET next_charge_at = CASE WHEN current_period_end IS NULL THEN next_charge_at ELSE NOW() + make_interval(mins => $2) END,
              last_failure_code = $3, updated_at = NOW()
        WHERE user_ref = $1`,
      [userRef, MERCHANT_RETRY_MINUTES, failureCode]
    )
    return
  }

  if (!sub.current_period_end) {
    await pool.query(
      `UPDATE billing_subscriptions
          SET status = 'incomplete', next_charge_at = NULL, last_failure_code = $2, updated_at = NOW()
        WHERE user_ref = $1`,
      [userRef, failureCode]
    )
    return
  }

  const attempts = sub.renewal_attempts + 1
  const delayHours = RENEWAL_POLICY[sub.billing_interval].retryDelaysHours[attempts - 1]
  const lapse = PERMANENT_FAILURES.has(failureCode) || delayHours === undefined
  await pool.query(
    `UPDATE billing_subscriptions
        SET status = $2, renewal_attempts = $3, next_charge_at = $4, last_failure_code = $5, updated_at = NOW()
      WHERE user_ref = $1`,
    [
      userRef,
      lapse ? 'lapsed' : 'past_due',
      attempts,
      lapse ? null : new Date(Date.now() + delayHours * 60 * 60 * 1000),
      failureCode,
    ]
  )
  console.warn(
    `[Billing] Renewal failed for ${userRef} (${failureCode}, attempt ${attempts})` +
      (lapse ? ' — subscription lapsed' : ` — retrying in ${delayHours}h`)
  )
}

// Refusals that mean "try again shortly", not "this payment failed".
const TRANSIENT_REFUSALS = new Set(['charge_conflict', 'idempotency_key_in_flight'])

/**
 * Requests payment for one billing period. Safe to call repeatedly: the
 * idempotency key is mandate + period start (+ retry number), and Sweep
 * replays the original response for a repeated key — which is also why a
 * retry after a failure needs a fresh key.
 */
export async function chargeForPeriod(sub: SubscriptionRow, periodStart: Date, attempt = 0): Promise<void> {
  if (!sub.mandate_id) throw new Error(`No mandate for ${sub.user_ref}`)

  const periodEnd = addInterval(periodStart, sub.billing_interval)
  const amount = Number(sub.amount)
  const idempotencyKey = `${sub.mandate_id}:${periodStart.toISOString()}${attempt > 0 ? `:retry${attempt}` : ''}`

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
      if (TRANSIENT_REFUSALS.has(err.code) || MERCHANT_FAILURES.has(err.code)) {
        if (MERCHANT_FAILURES.has(err.code)) await recordChargeFailure(sub.user_ref, err.code)
        console.warn(`[Billing] Charge for ${sub.user_ref} deferred: ${err.code}`)
        return
      }
      console.warn(`[Billing] Charge refused for ${sub.user_ref}: ${err.code} — ${err.message}`)
      await recordChargeFailure(sub.user_ref, err.code)
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

/** The charge an event refers to; falls back to the payer's only pending charge. */
async function resolveChargeId(userRef: string, chargeId: string | undefined): Promise<string | undefined> {
  if (chargeId) {
    const { rowCount } = await pool.query('SELECT 1 FROM billing_charges WHERE id = $1', [chargeId])
    if (rowCount) return chargeId
  }
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM billing_charges WHERE user_ref = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 2`,
    [userRef]
  )
  return rows.length === 1 ? rows[0].id : chargeId
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
              SET status = 'active', chain_ids = $2,
                  next_charge_at = current_period_end + make_interval(secs => ${RENEWAL_BUFFER_MS / 1000}),
                  email = COALESCE($3, email), updated_at = NOW()
            WHERE user_ref = $1`,
          [userRef, JSON.stringify(chainIds), pick(data, 'verified_email') ?? null]
        )
        return
      }
      // Anchor the first period on the event, not the clock: a retried delivery
      // must produce the same idempotency key or a lost 202 could double-charge.
      // Stored, so the cron can retry a first charge that never went through.
      const authorizedAt = new Date(event.created_at)
      const periodStart = Number.isNaN(authorizedAt.getTime()) ? new Date() : authorizedAt
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = 'authorized', chain_ids = $2, current_period_start = $3,
                email = COALESCE($4, email), updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef, JSON.stringify(chainIds), periodStart, pick(data, 'verified_email') ?? null]
      )
      await chargeForPeriod({ ...sub, status: 'authorized' }, periodStart)
      return
    }

    case 'charge.succeeded': {
      const chargeId = await resolveChargeId(userRef, pick(data, 'charge_id', 'charge', 'id'))
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
                next_charge_at = CASE WHEN status IN ('canceled', 'expired') THEN NULL ELSE $4::timestamptz END,
                last_failure_code = NULL,
                renewal_attempts = 0,
                updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef, charge.period_start, charge.period_end, nextChargeAfter(charge.period_end)]
      )
      return
    }

    case 'charge.failed': {
      const chargeId = await resolveChargeId(userRef, pick(data, 'charge_id', 'charge', 'id'))
      const failureCode = pick(data, 'failure_code') ?? 'unknown'
      const { rows } = await pool.query<{ status: string }>(
        `UPDATE billing_charges c SET status = 'failed', failure_code = $2, updated_at = NOW()
           FROM billing_charges prev
          WHERE c.id = $1 AND prev.id = c.id
          RETURNING prev.status`,
        [chargeId, failureCode]
      )
      if (!rows[0]) throw new Error(`charge.failed for unknown charge ${chargeId}`)
      // Already counted (webhook after reconciliation, or the reverse).
      if (rows[0].status === 'failed') return
      await recordChargeFailure(userRef, failureCode)
      return
    }

    case 'grant.revoked':
    case 'grant.added': {
      // One chain left or joined a live mandate — it keeps charging on the rest.
      if (mandateId && mandateId !== sub.mandate_id) return
      const chains = pick(data, 'remaining_chains', 'granted_chains')
      if (Array.isArray(chains)) {
        await pool.query(
          'UPDATE billing_subscriptions SET chain_ids = $2, updated_at = NOW() WHERE user_ref = $1',
          [userRef, JSON.stringify(chains)]
        )
      }
      return
    }

    case 'mandate.revoked': {
      if (mandateId && mandateId !== sub.mandate_id) return
      // Only a finished authorization stops service; a single chain leaving is grant.revoked.
      if (pick(data, 'mandate_still_active') === true) return
      await pool.query(
        `UPDATE billing_subscriptions
            SET status = 'canceled', next_charge_at = NULL, chain_ids = '[]'::jsonb, updated_at = NOW()
          WHERE user_ref = $1`,
        [userRef]
      )
      console.log(`[Billing] Mandate for ${userRef} revoked by ${pick(data, 'revoked_by') ?? 'unknown'}`)
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

// ─── Renewals (run from /api/cron/billing) ───────────────────────────────────

export interface RenewalRunResult {
  skipped?: 'already_running'
  reconciled: number
  charged: number
  errors: number
}

/**
 * Charges every subscription whose next_charge_at has passed and settles
 * charges whose webhook never arrived. Idempotent and overlap-safe.
 */
export async function runRenewals(): Promise<RenewalRunResult> {
  // A transaction-scoped lock held by an open transaction: it works behind a
  // transaction-mode pooler (Supabase :6543), where a session lock and its
  // unlock can land on different server connections and leak forever.
  // COMMIT releases it; so does the server if this process dies mid-run.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: lock } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1) AS locked',
      [RENEWAL_LOCK_ID]
    )
    if (!lock[0]?.locked) return { skipped: 'already_running', reconciled: 0, charged: 0, errors: 0 }
    // The work itself runs on other pooled connections; this one only holds the lock.
    const reconciled = await reconcilePendingCharges()
    const { charged, errors } = await chargeDueSubscriptions()
    return { reconciled, charged, errors }
  } finally {
    await client.query('COMMIT').catch(() => {})
    client.release()
  }
}

async function chargeDueSubscriptions(): Promise<{ charged: number; errors: number }> {
  // A charge already in flight blocks the next one; reconciliation clears it.
  const { rows: due } = await pool.query<SubscriptionRow>(
    `SELECT s.* FROM billing_subscriptions s
      WHERE s.status IN ('active', 'past_due')
        AND s.next_charge_at <= NOW()
        AND s.mandate_id IS NOT NULL
        AND s.current_period_end IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM billing_charges c WHERE c.user_ref = s.user_ref AND c.status = 'pending'
        )
      ORDER BY s.next_charge_at
      LIMIT $1`,
    [RENEWAL_BATCH_SIZE]
  )

  // First charges that were never accepted (e.g. no payout wallet yet).
  const { rows: firstDue } = await pool.query<SubscriptionRow>(
    `SELECT s.* FROM billing_subscriptions s
      WHERE s.status = 'authorized'
        AND s.current_period_end IS NULL
        AND s.current_period_start IS NOT NULL
        AND s.mandate_id IS NOT NULL
        AND s.updated_at < NOW() - interval '5 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM billing_charges c
           WHERE c.user_ref = s.user_ref AND c.mandate_id = s.mandate_id AND c.status IN ('pending', 'succeeded')
        )
      LIMIT $1`,
    [RENEWAL_BATCH_SIZE]
  )

  let charged = 0
  let errors = 0
  for (const sub of firstDue) {
    try {
      await chargeForPeriod(sub, sub.current_period_start!)
      await pool.query('UPDATE billing_subscriptions SET updated_at = NOW() WHERE user_ref = $1', [sub.user_ref])
      charged++
    } catch (err) {
      errors++
      console.error(`[Billing] First charge retry errored for ${sub.user_ref}:`, err)
    }
  }
  for (const sub of due) {
    try {
      // The new period starts where the paid one ended, even when a retry
      // collects it late — the billing date doesn't drift.
      await chargeForPeriod(sub, sub.current_period_end!, sub.renewal_attempts)
      charged++
    } catch (err) {
      errors++
      console.error(`[Billing] Renewal charge errored for ${sub.user_ref}:`, err)
    }
  }
  return { charged, errors }
}

async function reconcilePendingCharges(): Promise<number> {
  const { rows } = await pool.query<{ id: string; user_ref: string; mandate_id: string }>(
    `SELECT id, user_ref, mandate_id FROM billing_charges
      WHERE status = 'pending' AND created_at < NOW() - make_interval(mins => $1)
      ORDER BY created_at
      LIMIT $2`,
    [PENDING_RECONCILE_AFTER_MINUTES, RENEWAL_BATCH_SIZE]
  )

  let reconciled = 0
  for (const row of rows) {
    try {
      const charge = await getCharge(row.id)
      if (charge.status !== 'succeeded' && charge.status !== 'failed') continue
      // Apply the outcome exactly as the missing webhook would have.
      await handleSweepEvent({
        event_id: `reconcile:${row.id}`,
        event_type: `charge.${charge.status}`,
        created_at: new Date().toISOString(),
        external_ref: row.user_ref,
        data: {
          charge_id: row.id,
          mandate_id: row.mandate_id,
          failure_code: charge.failure_code,
          source_chain: charge.source_chain,
          tx_hash: charge.tx_hash,
        },
      })
      reconciled++
    } catch (err) {
      console.error(`[Billing] Could not reconcile charge ${row.id}:`, err)
    }
  }
  return reconciled
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
      accessEndsAt: accessEndsAt(sub)?.toISOString() ?? null,
      nextChargeAt: sub.next_charge_at?.toISOString() ?? null,
      lastFailureCode: sub.last_failure_code,
    },
  }
}
