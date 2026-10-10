import { NextRequest, NextResponse } from 'next/server'
import { IDENTITY_ERRORS, resolveBillingIdentity } from '@/lib/billing/identity'
import { formatSubscription, getSubscription } from '@/lib/billing/subscriptions'

// GET: the signed-in user's Premium subscription and access status
export async function GET(req: NextRequest) {
  try {
    const auth = await resolveBillingIdentity(req)
    if (!auth.ok) {
      return NextResponse.json({ error: { code: auth.reason, message: IDENTITY_ERRORS[auth.reason] } }, { status: 401 })
    }
    const sub = await getSubscription(auth.identity.ref)
    return NextResponse.json(formatSubscription(sub), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[Billing Subscription] Error:', error)
    return NextResponse.json({ error: { code: 'internal', message: 'Internal server error' } }, { status: 500 })
  }
}
