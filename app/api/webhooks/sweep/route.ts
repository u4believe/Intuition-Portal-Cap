import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/billing/sweep'
import {
  beginWebhookEvent,
  finishWebhookEvent,
  handleSweepEvent,
  type SweepEvent,
} from '@/lib/billing/subscriptions'

// POST: Sweep Console webhook deliveries (mandate.* and charge.* events)
export async function POST(req: NextRequest) {
  // The signature covers the raw bytes, so read them before parsing.
  const rawBody = Buffer.from(await req.arrayBuffer())
  if (!verifyWebhookSignature(rawBody, req.headers.get('x-sweep-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }

  let event: SweepEvent
  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!event?.event_id || !event?.event_type) {
    return NextResponse.json({ error: 'missing event_id or event_type' }, { status: 400 })
  }

  try {
    const isNew = await beginWebhookEvent(event)
    if (!isNew) return NextResponse.json({ ok: true, duplicate: true })

    await handleSweepEvent(event)
    await finishWebhookEvent(event.event_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Non-2xx makes Sweep retry (5m, 30m, 2h, 5h, 10h); handlers are idempotent.
    console.error(`[Sweep Webhook] Failed to process ${event.event_type} ${event.event_id}:`, error)
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }
}
