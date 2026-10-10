/**
 * Server-side Premium gate for API routes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { IDENTITY_ERRORS, resolveBillingIdentity, type BillingIdentity } from './identity'
import { getSubscription, hasPremiumAccess } from './subscriptions'

export type PremiumCheck =
  | { ok: true; identity: BillingIdentity }
  | { ok: false; response: NextResponse }

export async function requirePremium(req: NextRequest): Promise<PremiumCheck> {
  const auth = await resolveBillingIdentity(req)
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: auth.reason, message: IDENTITY_ERRORS[auth.reason] } },
        { status: 401 }
      ),
    }
  }
  const sub = await getSubscription(auth.identity.ref)
  if (!hasPremiumAccess(sub)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'premium_required', message: 'The AI Analyst is part of Portal Cap Premium.' } },
        { status: 403 }
      ),
    }
  }
  return { ok: true, identity: auth.identity }
}
