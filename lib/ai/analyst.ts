/**
 * AI Analyst turn engine: a streaming tool-use loop over Claude.
 * One call = one user turn. The caller persists the returned messages only
 * when the turn completes, so stored history stays append-only.
 * Server-only.
 */
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './prompt'
import { runTool, TOOL_LABELS, TOOLS } from './tools'

// Created on first use so a missing key fails the request, not the build.
let client: Anthropic | null = null
const getClient = () => (client ??= new Anthropic())

const MODEL = 'claude-opus-5-5'
const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  // fallbacks: "default" — a safety-classifier decline is re-run on Anthropic's
  // recommended model for that category instead of failing the turn.
  'server-side-fallback-2026-07-01',
  // display: "updates" — short progress notes between tool calls, reasoning stays hidden.
  'thinking-display-updates-2026-08-18',
]
/** Tool rounds per user turn before the model is told to answer with what it has. */
const MAX_TOOL_ROUNDS = 8

export type AnalystEvent =
  | { type: 'text_start' }
  | { type: 'text'; delta: string }
  | { type: 'note'; delta: string }
  | { type: 'tool_start'; id: string; name: string; label: string }
  | { type: 'tool_end'; id: string; ok: boolean }

export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

type AnthropicMessage = Anthropic.Beta.BetaMessageParam

export type TurnResult =
  // messages are in the provider's own format; stored as-is.
  | { status: 'ok'; messages: unknown[]; usage: TokenUsage }
  | { status: 'refused' | 'failed'; message: string; usage: TokenUsage }

type ContentBlock = Anthropic.Beta.BetaContentBlock

/**
 * After a mid-output fallback, thinking and tool_use blocks produced before the
 * last fallback boundary belong to the model that declined — they must not be
 * replayed (or executed). Text before the boundary is kept.
 */
function contentForReplay(content: ContentBlock[]): ContentBlock[] {
  let boundary = -1
  content.forEach((block, i) => {
    if (block.type === 'fallback') boundary = i
  })
  if (boundary === -1) return content
  return content.filter((block, i) => {
    if (i > boundary) return true
    if (i === boundary) return false
    return block.type === 'text'
  })
}

function addUsage(total: TokenUsage, message: Anthropic.Beta.BetaMessage) {
  // With fallbacks, usage.iterations has every attempt; top-level usage only the last.
  const iterations = (message.usage as any).iterations as any[] | null | undefined
  const entries = iterations?.length ? iterations : [message.usage]
  for (const u of entries) {
    total.input += u.input_tokens ?? 0
    total.output += u.output_tokens ?? 0
    total.cacheRead += u.cache_read_input_tokens ?? 0
    total.cacheWrite += u.cache_creation_input_tokens ?? 0
  }
}

export async function runAnalystTurn(opts: {
  history: AnthropicMessage[]
  contextText: string
  text: string
  signal: AbortSignal
  emit: (event: AnalystEvent) => void
}): Promise<TurnResult> {
  const { history, signal, emit } = opts
  const turn: AnthropicMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: opts.contextText },
        { type: 'text', text: opts.text },
      ],
    },
  ]
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let toolRounds = 0
  let jsonRetries = 0

  while (true) {
    const stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: BETAS,
        fallbacks: 'default',
        thinking: { type: 'adaptive', display: 'updates' },
        // Opus 5.5 defaults to medium; set explicitly so a default change can't move cost.
        output_config: { effort: 'medium' },
        // Caches system + tools + the conversation so far for the next turn.
        cache_control: { type: 'ephemeral' },
        system: [{ type: 'text', text: SYSTEM_PROMPT }],
        tools: TOOLS,
        messages: [...history, ...turn],
      },
      { signal }
    )

    let message: Anthropic.Beta.BetaMessage
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block
          if (block.type === 'text') emit({ type: 'text_start' })
          else if (block.type === 'tool_use') {
            emit({ type: 'tool_start', id: block.id, name: block.name, label: TOOL_LABELS[block.name] ?? block.name })
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') emit({ type: 'text', delta: event.delta.text })
          else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
            emit({ type: 'note', delta: event.delta.thinking })
          }
        }
      }
      message = await stream.finalMessage()
      jsonRetries = 0
    } catch (err) {
      // Only an unparseable streamed tool input is worth re-issuing; API errors
      // and aborts propagate. The failed attempt was never appended.
      if (err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err
      console.warn('[AI Analyst] Tool input was not parseable JSON, re-issuing the request')
      continue
    }
    addUsage(usage, message)

    if (message.stop_reason === 'refusal') {
      return {
        status: 'refused',
        message: 'I can’t help with that request. Try rephrasing it, or ask about something else on Intuition.',
        usage,
      }
    }

    const content = contentForReplay(message.content)
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    // Close the UI chips of tool calls the fallback discarded — they never run.
    for (const block of message.content) {
      if (block.type === 'tool_use' && !toolUses.includes(block)) emit({ type: 'tool_end', id: block.id, ok: false })
    }

    if (message.stop_reason === 'pause_turn') {
      turn.push({ role: 'assistant', content })
      continue
    }

    if (toolUses.length === 0) {
      // end_turn, or a text answer cut at max_tokens (returned as-is).
      if (content.length === 0) {
        return { status: 'failed', message: 'The model returned an empty response. Please try again.', usage }
      }
      turn.push({ role: 'assistant', content })
      return { status: 'ok', messages: turn, usage }
    }

    // A tool input cut off at max_tokens can still look valid — never run it.
    if (message.stop_reason === 'max_tokens') {
      return { status: 'failed', message: 'The response was too long to finish. Try a narrower question.', usage }
    }

    turn.push({ role: 'assistant', content })
    toolRounds++

    let results: Anthropic.Beta.BetaToolResultBlockParam[]
    if (toolRounds > MAX_TOOL_ROUNDS + 1) {
      return { status: 'failed', message: 'This question needed too many lookups. Try splitting it up.', usage }
    } else if (toolRounds > MAX_TOOL_ROUNDS) {
      // Every tool_use still needs a result; tell the model to wrap up.
      results = toolUses.map((block) => ({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        is_error: true,
        content: 'Lookup limit reached for this question. Answer now with the information you already have, and say what you could not check.',
      }))
      toolUses.forEach((block) => emit({ type: 'tool_end', id: block.id, ok: false }))
    } else {
      // Independent lookups run concurrently; all results go back in one message.
      results = await Promise.all(
        toolUses.map(async (block) => {
          const result = await runTool(block)
          emit({ type: 'tool_end', id: block.id, ok: !result.is_error })
          return result
        })
      )
    }
    if (signal.aborted) throw new Error('aborted')
    turn.push({ role: 'user', content: results })
  }
}
