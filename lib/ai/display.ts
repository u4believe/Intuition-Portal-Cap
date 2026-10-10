/**
 * Turns stored messages (Anthropic or OpenAI-compatible format) into what the
 * chat UI renders: the user's questions and the assistant's answers with the
 * tools it used. Thinking, tool payloads and the <user_context> block stay
 * server-side.
 */
import type { StoredMessage } from './conversations'
import type { AiProvider } from './provider'
import { TOOL_LABELS } from './tools'

export interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
  tools?: string[]
}

const CONTEXT_BLOCK = /^<user_context>[\s\S]*?<\/user_context>\s*/

function assistantSlot(out: DisplayMessage[]): DisplayMessage {
  const last = out[out.length - 1]
  if (last?.role === 'assistant') return last
  const created: DisplayMessage = { role: 'assistant', text: '', tools: [] }
  out.push(created)
  return created
}

function appendText(slot: DisplayMessage, text: string) {
  if (text) slot.text = slot.text ? `${slot.text}\n\n${text}` : text
}

export function toDisplayMessages(messages: StoredMessage[], provider: AiProvider): DisplayMessage[] {
  const out: DisplayMessage[] = []
  for (const message of messages) {
    if (provider === 'openai') {
      if (message.role === 'user') {
        const text = String(message.content ?? '').replace(CONTEXT_BLOCK, '')
        if (text) out.push({ role: 'user', text })
      } else if (message.role === 'assistant') {
        const slot = assistantSlot(out)
        appendText(slot, typeof message.content === 'string' ? message.content : '')
        for (const call of message.tool_calls ?? []) {
          const name = call.function?.name
          if (name) slot.tools!.push(TOOL_LABELS[name] ?? name)
        }
      }
      // role "tool" carries raw tool output — never shown.
      continue
    }

    const blocks: any[] = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content
    if (message.role === 'user') {
      // Tool-result messages carry no text: they belong to the assistant's answer.
      const texts = blocks.flatMap((b) => (b.type === 'text' && !b.text.startsWith('<user_context>') ? [b.text] : []))
      if (texts.length) out.push({ role: 'user', text: texts.join('\n\n') })
      continue
    }
    const slot = assistantSlot(out)
    for (const block of blocks) {
      if (block.type === 'text') appendText(slot, block.text)
      else if (block.type === 'tool_use') slot.tools!.push(TOOL_LABELS[block.name] ?? block.name)
    }
  }
  return out
}
