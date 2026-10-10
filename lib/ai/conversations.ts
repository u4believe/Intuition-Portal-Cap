/**
 * AI Analyst persistence: append-only conversations and daily usage limits.
 * Server-only.
 */
import { Pool } from 'pg'
import type { AiProvider } from './provider'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/** Messages a Premium user can send per UTC day. */
export const DAILY_MESSAGE_LIMIT = Number(process.env.AI_DAILY_MESSAGE_LIMIT) || 50
/** User turns per conversation before we ask them to start a new one. */
export const MAX_TURNS_PER_CONVERSATION = 40
/** How long a turn may hold the conversation lock before it is considered dead. */
const TURN_LOCK_MINUTES = 5

/** A message in the conversation's provider format (Anthropic or OpenAI-compatible). */
export type StoredMessage = any

export interface ConversationRow {
  id: string
  user_ref: string
  provider: AiProvider
  title: string
  messages: StoredMessage[]
  context_snapshot: string | null
  created_at: Date
  updated_at: Date
}

export async function listConversations(userRef: string, limit = 30) {
  const { rows } = await pool.query<{ id: string; title: string; updated_at: Date }>(
    `SELECT id, title, updated_at FROM ai_conversations
      WHERE user_ref = $1 ORDER BY updated_at DESC LIMIT $2`,
    [userRef, limit]
  )
  return rows
}

export async function getConversation(userRef: string, id: string): Promise<ConversationRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { rows } = await pool.query<ConversationRow>(
    'SELECT * FROM ai_conversations WHERE id = $1 AND user_ref = $2',
    [id, userRef]
  )
  return rows[0] ?? null
}

export async function deleteConversation(userRef: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false
  const { rowCount } = await pool.query('DELETE FROM ai_conversations WHERE id = $1 AND user_ref = $2', [id, userRef])
  return (rowCount ?? 0) > 0
}

export async function createConversation(userRef: string, title: string, provider: AiProvider): Promise<ConversationRow> {
  const { rows } = await pool.query<ConversationRow>(
    `INSERT INTO ai_conversations (user_ref, title, provider, busy_until)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))
     RETURNING *`,
    [userRef, title, provider, TURN_LOCK_MINUTES]
  )
  return rows[0]
}

/** Takes the per-conversation turn lock; null if another turn is in flight. */
export async function lockConversation(userRef: string, id: string): Promise<ConversationRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { rows } = await pool.query<ConversationRow>(
    `UPDATE ai_conversations SET busy_until = NOW() + make_interval(mins => $3)
      WHERE id = $1 AND user_ref = $2 AND (busy_until IS NULL OR busy_until < NOW())
      RETURNING *`,
    [id, userRef, TURN_LOCK_MINUTES]
  )
  return rows[0] ?? null
}

export async function unlockConversation(id: string): Promise<void> {
  await pool.query('UPDATE ai_conversations SET busy_until = NULL WHERE id = $1', [id])
}

/**
 * Appends a completed turn. The WHERE clause on the current length makes this
 * strictly append-only: earlier messages are never rewritten.
 */
export async function appendTurn(
  id: string,
  expectedLength: number,
  newMessages: StoredMessage[],
  contextSnapshot: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE ai_conversations
        SET messages = messages || $3::jsonb, context_snapshot = $4, busy_until = NULL, updated_at = NOW()
      WHERE id = $1 AND jsonb_array_length(messages) = $2`,
    [id, expectedLength, JSON.stringify(newMessages), contextSnapshot]
  )
  return (rowCount ?? 0) > 0
}

/** Counts one request against today's limit; false once the limit is reached. */
export async function claimDailyRequest(userRef: string): Promise<{ allowed: boolean; used: number }> {
  const { rows } = await pool.query<{ requests: number }>(
    `INSERT INTO ai_usage_daily (user_ref, day, requests) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_ref, day) DO UPDATE SET requests = ai_usage_daily.requests + 1
       WHERE ai_usage_daily.requests < $2
     RETURNING requests`,
    [userRef, DAILY_MESSAGE_LIMIT]
  )
  if (rows[0]) return { allowed: true, used: rows[0].requests }
  return { allowed: false, used: DAILY_MESSAGE_LIMIT }
}

/** Gives a request back when the turn failed before producing an answer. */
export async function refundDailyRequest(userRef: string): Promise<void> {
  await pool.query(
    `UPDATE ai_usage_daily SET requests = GREATEST(requests - 1, 0) WHERE user_ref = $1 AND day = CURRENT_DATE`,
    [userRef]
  )
}

export async function getDailyUsage(userRef: string): Promise<number> {
  const { rows } = await pool.query<{ requests: number }>(
    'SELECT requests FROM ai_usage_daily WHERE user_ref = $1 AND day = CURRENT_DATE',
    [userRef]
  )
  return rows[0]?.requests ?? 0
}

export async function recordTokenUsage(
  userRef: string,
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
): Promise<void> {
  await pool.query(
    `INSERT INTO ai_usage_daily (user_ref, day, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
     ON CONFLICT (user_ref, day) DO UPDATE SET
       input_tokens = ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_usage_daily.output_tokens + EXCLUDED.output_tokens,
       cache_read_tokens = ai_usage_daily.cache_read_tokens + EXCLUDED.cache_read_tokens,
       cache_write_tokens = ai_usage_daily.cache_write_tokens + EXCLUDED.cache_write_tokens`,
    [userRef, usage.input, usage.output, usage.cacheRead, usage.cacheWrite]
  )
}
