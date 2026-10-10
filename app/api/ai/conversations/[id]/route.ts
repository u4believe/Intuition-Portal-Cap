import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/billing/access'
import { deleteConversation, getConversation } from '@/lib/ai/conversations'
import { toDisplayMessages } from '@/lib/ai/display'

type Params = { params: Promise<{ id: string }> }

// GET: one conversation, rendered for the chat UI
export async function GET(req: NextRequest, { params }: Params) {
  const gate = await requirePremium(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const conversation = await getConversation(gate.identity.ref, id)
  if (!conversation) {
    return NextResponse.json({ error: { code: 'not_found', message: 'Conversation not found.' } }, { status: 404 })
  }
  return NextResponse.json(
    { id: conversation.id, title: conversation.title, messages: toDisplayMessages(conversation.messages, conversation.provider) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// DELETE: remove a conversation
export async function DELETE(req: NextRequest, { params }: Params) {
  const gate = await requirePremium(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const deleted = await deleteConversation(gate.identity.ref, id)
  if (!deleted) {
    return NextResponse.json({ error: { code: 'not_found', message: 'Conversation not found.' } }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
