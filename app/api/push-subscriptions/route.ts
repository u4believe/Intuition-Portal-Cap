import { NextRequest, NextResponse } from 'next/server'
import {
  saveSubscription,
  deleteSubscription,
  getSubscriptionsByAddress,
  updateWatchedClaims,
} from '@/lib/web-push-server'

// POST: Save a push subscription
export async function POST(req: NextRequest) {
  try {
    const { address, subscription, watchedClaims } = await req.json()

    if (!address || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const success = await saveSubscription(
      address,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      watchedClaims || []
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push Subscriptions API] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove a push subscription
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    const success = await deleteSubscription(endpoint)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push Subscriptions API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Check if an address has subscriptions
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address')

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    const subscriptions = await getSubscriptionsByAddress(address)
    return NextResponse.json({ subscriptions, count: subscriptions.length })
  } catch (error) {
    console.error('[Push Subscriptions API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update watched claims for an address
export async function PATCH(req: NextRequest) {
  try {
    const { address, watchedClaims } = await req.json()

    if (!address || !Array.isArray(watchedClaims)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const success = await updateWatchedClaims(address, watchedClaims)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update watched claims' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Push Subscriptions API] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
