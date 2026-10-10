import { NextRequest, NextResponse } from 'next/server'
import { runRenewals } from '@/lib/billing/subscriptions'

// GET/POST: charge due Premium renewals and settle charges whose webhook never arrived.
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the self-poller does the same.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  // Fail closed: this route moves customers' money.
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRenewals()
    if (result.charged || result.reconciled || result.errors) {
      console.log('[Billing Cron]', result)
    }
    return NextResponse.json({ success: result.errors === 0, ...result })
  } catch (error) {
    console.error('[Billing Cron] Error:', error)
    return NextResponse.json({ success: false, error: 'Renewal run failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
