import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionsByAddress, sendPushNotification } from '@/lib/web-push-server'

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 })
    }

    const subscriptions = await getSubscriptionsByAddress(address)

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'NO_SUBSCRIPTION',
        message: 'No push subscription found in the database for this user. The browser subscription was never saved to the server.',
      }, { status: 404 })
    }

    let sent = 0
    const errors: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const ok = await sendPushNotification(sub, {
            title: 'Portal Cap — Test Notification',
            body: 'Push notifications are working! Your alerts will be delivered here.',
            tag: 'test-notification',
            url: '/',
          })
          if (ok) sent++
          else errors.push('send_failed')
        } catch (e: any) {
          errors.push(e?.message || 'unknown')
        }
      })
    )

    return NextResponse.json({
      success: sent > 0,
      subscriptions: subscriptions.length,
      sent,
      errors,
    })
  } catch (error: any) {
    console.error('[Test Push] Error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: error?.message }, { status: 500 })
  }
}
