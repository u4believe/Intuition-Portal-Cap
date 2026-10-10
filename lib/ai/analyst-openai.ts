/**
 * AI Analyst turn engine for OpenAI-compatible Chat Completions APIs — the
 * common interface for open-weight models (OpenRouter, Groq, Together,
 * DeepInfra, Ollama, vLLM, …). Same events and results as the Claude engine.
 * Server-only.
 */
import OpenAI from 'openai'
import { SYSTEM_PROMPT } from './prompt'
import { executeTool, OPENAI_TOOLS, TOOL_LABELS } from './tools'
import type { AnalystEvent, TokenUsage, TurnResult } from './analyst'

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam
type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall

const MAX_TOOL_ROUNDS = 8
// Only the most recent turns are re-sent: open models have smaller context
// windows, and every re-sent token costs money. Stored history stays complete.
const HISTORY_TURNS = Number(process.env.AI_HISTORY_TURNS) || 10

export class AiConfigError extends Error {}

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (!process.env.AI_MODEL) throw new AiConfigError('AI_MODEL is not set')
  client ??= new OpenAI({
    baseURL: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    // Local servers such as Ollama ignore the key but the SDK requires one.
    apiKey: process.env.AI_API_KEY || 'not-needed',
    // OpenRouter attribution headers; other providers ignore them.
    defaultHeaders: { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://portal-cap.app', 'X-Title': 'Portal Cap' },
  })
  return client
}

/** Keeps the last HISTORY_TURNS user turns, cutting only at a user message so tool calls stay paired. */
function recentHistory(history: Message[]): Message[] {
  let seen = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user' && ++seen === HISTORY_TURNS) return history.slice(i)
  }
  return history
}

export async function runOpenAITurn(opts: {
  history: Message[]
  contextText: string
  text: string
  signal: AbortSignal
  emit: (event: AnalystEvent) => void
}): Promise<TurnResult> {
  const { signal, emit } = opts
  const ai = getClient()
  const model = process.env.AI_MODEL!
  const maxTokens = Number(process.env.AI_MAX_TOKENS) || 4096
  const turn: Message[] = [{ role: 'user', content: `${opts.contextText}\n\n${opts.text}` }]
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  const history = recentHistory(opts.history)
  let toolRounds = 0

  while (true) {
    const stream = await ai.chat.completions.create(
      {
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, ...turn],
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: maxTokens,
        temperature: 0.3,
      },
      { signal }
    )

    let text = ''
    let finishReason: string | null = null
    const calls: { id: string; name: string; args: string }[] = []

    for await (const chunk of stream) {
      if (chunk.usage) {
        usage.input += chunk.usage.prompt_tokens ?? 0
        usage.output += chunk.usage.completion_tokens ?? 0
        usage.cacheRead += chunk.usage.prompt_tokens_details?.cached_tokens ?? 0
      }
      const choice = chunk.choices?.[0]
      if (!choice) continue
      const delta = choice.delta as typeof choice.delta & { reasoning?: string; reasoning_content?: string }

      // Reasoning models expose their thinking under one of these names; show it, don't store it.
      const reasoning = delta.reasoning ?? delta.reasoning_content
      if (reasoning) emit({ type: 'note', delta: reasoning })

      if (delta.content) {
        if (!text) emit({ type: 'text_start' })
        text += delta.content
        emit({ type: 'text', delta: delta.content })
      }
      for (const tc of delta.tool_calls ?? []) {
        const slot = (calls[tc.index] ??= { id: '', name: '', args: '' })
        // First id wins: the UI and the tool result must agree on it.
        if (tc.id && !slot.id) slot.id = tc.id
        // Names arrive whole; some providers repeat them on later chunks.
        if (tc.function?.name && !slot.name) {
          slot.name = tc.function.name
          // Some providers omit ids; tool results must still reference one.
          slot.id ||= `call_${Math.random().toString(36).slice(2, 12)}`
          emit({ type: 'tool_start', id: slot.id, name: slot.name, label: TOOL_LABELS[slot.name] ?? slot.name })
        }
        if (tc.function?.arguments) slot.args += tc.function.arguments
      }
      if (choice.finish_reason) finishReason = choice.finish_reason
    }

    if (finishReason === 'content_filter') {
      return {
        status: 'refused',
        message: 'I can’t help with that request. Try rephrasing it, or ask about something else on Intuition.',
        usage,
      }
    }

    const toolCalls: ToolCall[] = calls
      .filter((c) => c && c.name)
      .map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } }))

    if (toolCalls.length === 0) {
      if (!text.trim()) {
        return { status: 'failed', message: 'The model returned an empty response. Please try again.', usage }
      }
      turn.push({ role: 'assistant', content: text })
      return { status: 'ok', messages: turn, usage }
    }

    // Arguments cut off by the token limit can't be trusted.
    if (finishReason === 'length') {
      return { status: 'failed', message: 'The response was too long to finish. Try a narrower question.', usage }
    }

    turn.push({ role: 'assistant', content: text || null, tool_calls: toolCalls })
    toolRounds++
    if (toolRounds > MAX_TOOL_ROUNDS + 1) {
      return { status: 'failed', message: 'This question needed too many lookups. Try splitting it up.', usage }
    }

    const results = await Promise.all(
      toolCalls.map(async (call) => {
        let result: { content: string; isError: boolean }
        if (toolRounds > MAX_TOOL_ROUNDS) {
          result = {
            content: 'Lookup limit reached for this question. Answer now with the information you already have, and say what you could not check.',
            isError: true,
          }
        } else {
          let input: unknown
          try {
            input = JSON.parse(call.function.arguments)
          } catch {
            input = undefined
          }
          result =
            input === undefined
              ? { content: 'Invalid input: arguments were not valid JSON. Call the tool again with a JSON object.', isError: true }
              : await executeTool(call.function.name, input)
        }
        emit({ type: 'tool_end', id: call.id, ok: !result.isError })
        return { role: 'tool' as const, tool_call_id: call.id, content: result.isError ? `ERROR: ${result.content}` : result.content }
      })
    )
    if (signal.aborted) throw new Error('aborted')
    turn.push(...results)
  }
}
