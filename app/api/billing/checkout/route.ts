import { NextRequest, NextResponse } from 'next/server'
import { IDENTITY_ERRORS, resolveBillingIdentity } from '@/lib/billing/identity'
import { isBillingInterval, isPlanId, PAYMENT_CHAINS, PLANS } from '@/lib/billing/plans'
import { getSubscription, isBillingLive, savePendingSubscription } from '@/lib/billing/subscriptions'
import { createMandate, SweepError } from '@/lib/billing/sweep'

// The mandate outlives one billing cycle so a yearly plan can renew once and
// a monthly plan runs a full year of renewals before asking to re-authorize.
const MANDATE_LIFETIME_MONTHS = 13

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST: start checkout — creates a Sweep mandate and returns its authorization URL
export async function POST(req: NextRequest) {
  try {
    const auth = await resolveBillingIdentity(req)
    if (!auth.ok) {
      return NextResponse.json({ error: { code: auth.reason, message: IDENTITY_ERRORS[auth.reason] } }, { status: 401 })
    }
    const { identity } = auth

    const { plan, interval, email } = await req.json().catch(() => ({}))
    if (!isPlanId(plan) || !isBillingInterval(interval)) {
      return NextResponse.json({ error: { code: 'invalid_plan', message: 'Unknown plan or billing interval.' } }, { status: 400 })
    }
    const cleanEmail = typeof email === 'string' && email.trim() ? email.trim() : null
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json({ error: { code: 'invalid_email', message: 'Enter a valid email address.' } }, { status: 400 })
    }

    const existing = await getSubscription(identity.ref)
    if (isBillingLive(existing)) {
      return NextResponse.json(
        { error: { code: 'already_subscribed', message: 'You already have an active Premium subscription.' } },
        { status: 409 }
      )
    }

    const amount = PLANS[plan].prices[interval].amount
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const expiresAt = new Date()
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + MANDATE_LIFETIME_MONTHS)

    const mandate = await createMandate({
      externalRef: identity.ref,
      email: cleanEmail ?? undefined,
      // The ceiling equals the price, so the payer approves exactly what they'll pay.
      maxAmount: amount,
      interval,
      chains: PAYMENT_CHAINS,
      expiresAt,
      returnUrl: `${appUrl}/checkout/return`,
      metadata: { plan, interval },
    })

    if (!mandate.id || !mandate.authorization_url) {
      console.error('[Billing Checkout] Unexpected mandate response:', mandate)
      return NextResponse.json({ error: { code: 'sweep_error', message: 'Could not start checkout.' } }, { status: 502 })
    }

    await savePendingSubscription({
      userRef: identity.ref,
      plan,
      interval,
      amount,
      mandateId: mandate.id,
      mandateExpiresAt: mandate.expires_at ? new Date(mandate.expires_at) : expiresAt,
      email: cleanEmail,
    })

    return NextResponse.json({
      authorizationUrl: mandate.authorization_url,
      authorizationUrlExpiresAt: mandate.authorization_url_expires_at ?? null,
    })
  } catch (error) {
    if (error instanceof SweepError) {
      console.error(`[Billing Checkout] Sweep error ${error.status} ${error.code}: ${error.message}`)
      const message =
        error.code === 'rail_not_enabled'
          ? 'Payments are not enabled yet. Please try again later.'
          : 'The payment provider could not start checkout. Please try again.'
      return NextResponse.json({ error: { code: error.code ?? 'sweep_error', message } }, { status: 502 })
    }
    console.error('[Billing Checkout] Error:', error)
    return NextResponse.json({ error: { code: 'internal', message: 'Internal server error' } }, { status: 500 })
  }
}
