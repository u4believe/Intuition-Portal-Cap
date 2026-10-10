import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/billing/access'
import { DAILY_MESSAGE_LIMIT, getDailyUsage, listConversations } from '@/lib/ai/conversations'

// GET: the signed-in Premium user's recent AI Analyst conversations + today's allowance
export async function GET(req: NextRequest) {
  const gate = await requirePremium(req)
  if (!gate.ok) return gate.response
  try {
    const [conversations, used] = await Promise.all([
      listConversations(gate.identity.ref),
      getDailyUsage(gate.identity.ref),
    ])
    return NextResponse.json(
      {
        conversations: conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at.toISOString() })),
        dailyLimit: DAILY_MESSAGE_LIMIT,
        remainingToday: Math.max(DAILY_MESSAGE_LIMIT - used, 0),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[AI Conversations] List error:', error)
    return NextResponse.json({ error: { code: 'internal', message: 'Internal server error' } }, { status: 500 })
  }
}
