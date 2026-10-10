import { NextRequest, NextResponse } from 'next/server'
import { requirePremium } from '@/lib/billing/access'
import { runAnalystTurn, type AnalystEvent, type TurnResult } from '@/lib/ai/analyst'
import { AiConfigError, runOpenAITurn } from '@/lib/ai/analyst-openai'
import { currentProvider } from '@/lib/ai/provider'
import { buildUserContext } from '@/lib/ai/prompt'
import {
  appendTurn,
  claimDailyRequest,
  createConversation,
  DAILY_MESSAGE_LIMIT,
  deleteConversation,
  lockConversation,
  MAX_TURNS_PER_CONVERSATION,
  recordTokenUsage,
  refundDailyRequest,
  unlockConversation,
  type ConversationRow,
} from '@/lib/ai/conversations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_MESSAGE_CHARS = 4000
const MAX_WATCHLIST_ITEMS = 30

type StreamEvent =
  | AnalystEvent
  | { type: 'conversation'; id: string; title: string }
  | { type: 'reset' }
  | { type: 'done'; remainingToday: number }
  | { type: 'error'; code: string; message: string }

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

function countUserTurns(conversation: ConversationRow): number {
  // OpenAI format: every user message is a real turn. Anthropic: tool results
  // are also role "user", real turns carry text.
  return conversation.messages.filter(
    (m) =>
      m.role === 'user' &&
      (typeof m.content === 'string' || (Array.isArray(m.content) && m.content.some((b: any) => b.type === 'text')))
  ).length
}

/** Maps provider SDK errors (both expose an HTTP status) to a user-facing message. */
function errorMessage(err: unknown): string {
  if (err instanceof AiConfigError) return 'The AI Analyst is not configured yet.'
  const status = (err as { status?: number })?.status ?? 0
  if (status === 429) return 'The AI service is busy right now. Try again in a minute.'
  if (status === 401 || status === 403) return 'The AI service is not configured correctly.'
  if (status === 404) return 'The configured AI model is not available.'
  if (status >= 500) return 'The AI service had a problem. Try again shortly.'
  return 'Something went wrong. Please try again.'
}

// POST: one AI Analyst turn, streamed back as newline-delimited JSON events
export async function POST(req: NextRequest) {
  const gate = await requirePremium(req)
  if (!gate.ok) return gate.response
  const { identity } = gate
  const provider = currentProvider()

  const body = await req.json().catch(() => null)
  const text = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!text) return jsonError(400, 'empty_message', 'Type a question first.')
  if (text.length > MAX_MESSAGE_CHARS) {
    return jsonError(400, 'message_too_long', `Keep questions under ${MAX_MESSAGE_CHARS} characters.`)
  }
  const watchlist: string[] = Array.isArray(body?.watchlist)
    ? body.watchlist.filter((w: unknown): w is string => typeof w === 'string').slice(0, MAX_WATCHLIST_ITEMS).map((w: string) => w.slice(0, 200))
    : []

  // Load (and lock) the conversation before spending today's allowance.
  let conversation: ConversationRow | null
  let isNew = false
  if (body?.conversationId) {
    conversation = await lockConversation(identity.ref, String(body.conversationId))
    if (!conversation) {
      return jsonError(409, 'conversation_busy', 'That conversation is still answering, or no longer exists.')
    }
    if (conversation.provider !== provider) {
      await unlockConversation(conversation.id)
      return jsonError(409, 'provider_changed', 'The AI model has changed since this conversation started — start a new one to continue.')
    }
    if (countUserTurns(conversation) >= MAX_TURNS_PER_CONVERSATION) {
      await unlockConversation(conversation.id)
      return jsonError(409, 'conversation_full', 'This conversation is getting long — start a new one to keep answers sharp.')
    }
  } else {
    conversation = await createConversation(identity.ref, text.length > 60 ? `${text.slice(0, 57)}…` : text, provider)
    isNew = true
  }
  const conv = conversation

  const quota = await claimDailyRequest(identity.ref)
  if (!quota.allowed) {
    if (isNew) await deleteConversation(identity.ref, conv.id)
    else await unlockConversation(conv.id)
    return jsonError(429, 'daily_limit', `You’ve used all ${DAILY_MESSAGE_LIMIT} AI Analyst messages for today. The limit resets at 00:00 UTC.`)
  }

  // Claude sees the whole stored history, so wallet and watchlist are re-sent
  // only when they change. The open-model engine trims old turns, so it gets
  // the full context every time or the wallet could fall out of view.
  const walletAddress = identity.kind === 'wallet' ? identity.address : null
  const snapshot = JSON.stringify({ walletAddress, watchlist })
  const contextText =
    provider === 'anthropic' && snapshot === conv.context_snapshot
      ? `<user_context>\ncurrent_time: ${new Date().toISOString()}\n</user_context>`
      : buildUserContext({ now: new Date(), walletAddress, watchlist })

  const abort = new AbortController()
  req.signal.addEventListener('abort', () => abort.abort())

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        } catch {
          // Client went away; the abort signal stops the model.
        }
      }

      let saved = false
      // Errors on our side give the message back; refusals and aborts still cost tokens.
      let refund = false
      try {
        send({ type: 'conversation', id: conv.id, title: conv.title })
        const turnInput = { history: conv.messages, contextText, text, signal: abort.signal, emit: send }
        const result: TurnResult =
          provider === 'anthropic' ? await runAnalystTurn(turnInput) : await runOpenAITurn(turnInput)
        await recordTokenUsage(identity.ref, result.usage).catch((e) =>
          console.error('[AI Chat] Failed to record usage:', e)
        )

        if (result.status === 'ok') {
          saved = await appendTurn(conv.id, conv.messages.length, result.messages, snapshot)
          if (!saved) throw new Error('conversation changed during the turn')
          send({ type: 'done', remainingToday: Math.max(DAILY_MESSAGE_LIMIT - quota.used, 0) })
        } else {
          refund = result.status === 'failed'
          // Discard any partial text the client already rendered.
          send({ type: 'reset' })
          send({ type: 'error', code: result.status, message: result.message })
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          refund = true
          console.error('[AI Chat] Turn failed:', err)
          send({ type: 'reset' })
          send({ type: 'error', code: 'failed', message: errorMessage(err) })
        }
      } finally {
        if (!saved) {
          // Nothing was appended: free the conversation (and the message, if it was our fault).
          if (refund) await refundDailyRequest(identity.ref).catch(() => {})
          if (isNew && conv.messages.length === 0) await deleteConversation(identity.ref, conv.id).catch(() => {})
          else await unlockConversation(conv.id).catch(() => {})
        }
        try {
          controller.close()
        } catch {}
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
