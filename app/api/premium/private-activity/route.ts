import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/billing/access'
import { IDENTITY_ERRORS, resolveBillingIdentity } from '@/lib/billing/identity'
import { getSubscription, hasPremiumAccess, setHideActivity } from '@/lib/billing/subscriptions'

// GET: whether private activity is on, and whether this user can use it
export async function GET(req: NextRequest) {
  const auth = await resolveBillingIdentity(req)
  if (!auth.ok) {
    return NextResponse.json({ error: { code: auth.reason, message: IDENTITY_ERRORS[auth.reason] } }, { status: 401 })
  }
  const sub = await getSubscription(auth.identity.ref)
  const isPremium = hasPremiumAccess(sub)
  return NextResponse.json(
    {
      isPremium,
      // Only a wallet's transactions can be hidden; Discord sign-ins have none.
      isWallet: auth.identity.kind === 'wallet',
      // Reported as off once Premium lapses, because it is no longer honoured.
      hideActivity: isPremium && !!sub?.hide_activity,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// PUT: turn private activity on or off (Premium wallet users only)
export async function PUT(req: NextRequest) {
  const gate = await requirePremium(req)
  if (!gate.ok) return gate.response
  if (gate.identity.kind !== 'wallet') {
    return NextResponse.json(
      { error: { code: 'wallet_required', message: 'Sign in with your wallet to keep its activity private.' } },
      { status: 400 }
    )
  }
  const body = await req.json().catch(() => null)
  if (typeof body?.hideActivity !== 'boolean') {
    return NextResponse.json({ error: { code: 'invalid_request', message: 'hideActivity must be true or false.' } }, { status: 400 })
  }
  await setHideActivity(gate.identity.ref, body.hideActivity)
  return NextResponse.json({ hideActivity: body.hideActivity })
}
