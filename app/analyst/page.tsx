'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUp,
  Check,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BillingHeader from '@/components/billing/billing-header'
import Markdown from '@/components/analyst/markdown'
import { useAuthCheck, logout } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { billingAuthHeaders } from '@/lib/billing/auth-headers'

interface ToolCall {
  id: string
  label: string
  status: 'running' | 'done' | 'failed'
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  /** Live progress note while the assistant works (not persisted). */
  note?: string
  tools?: ToolCall[]
  /** Labels of tools used, for messages loaded from history. */
  toolLabels?: string[]
  streaming?: boolean
  error?: string
}

interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}

const EXAMPLE_PROMPTS = [
  'What’s trending on Intuition right now, and why?',
  'How are my positions doing? Which ones are up the most?',
  'Summarize the claims on my watchlist and how their market caps compare.',
  'Who are the biggest holders of the top Ethereum claims?',
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AnalystPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const { isPremium, isLoading: subLoading, authError } = useSubscription(isAuthenticated)
  const loading = authLoading || (isAuthenticated && subLoading)

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <BillingHeader />
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : !isAuthenticated || authError ? (
        <Gate
          title="Sign in to use the AI Analyst"
          body={authError ?? 'The AI Analyst is part of Portal Cap Premium. Sign in with your wallet or Discord to continue.'}
          action={authError ? <Button onClick={logout}>Sign in again</Button> : <Link href="/auth/login"><Button>Sign in</Button></Link>}
        />
      ) : !isPremium ? (
        <Upsell />
      ) : (
        <AnalystChat />
      )}
    </div>
  )
}

function Gate({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
        <div className="pt-2">{action}</div>
      </div>
    </div>
  )
}

function Upsell() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full rounded-2xl p-[1.5px] bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-500">
        <div className="rounded-[calc(1rem-1.5px)] bg-white dark:bg-slate-900 p-8 space-y-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 text-white">
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meet your AI Analyst</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Ask anything about Intuition in plain English. The analyst reads live claim, vault and wallet data and
              explains what it means.
            </p>
          </div>
          <ul className="space-y-2">
            {EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
              <li key={p} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                “{p}”
              </li>
            ))}
          </ul>
          <Link href="/pricing" className="block">
            <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0">
              Upgrade to Premium
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function AnalystChat() {
  const { getWatchedClaims } = useUserPreferences()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [remainingToday, setRemainingToday] = useState<number | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const refreshConversations = useCallback(async () => {
    const res = await fetch('/api/ai/conversations', { headers: billingAuthHeaders(), cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    setConversations(data.conversations)
    setRemainingToday(data.remainingToday)
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  // Keep the newest content in view while streaming.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const updateLast = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((prev) => (prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1])] : prev))

  async function openConversation(id: string) {
    if (busy) return
    setBanner(null)
    setLoadingConversation(true)
    setConversationId(id)
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { headers: billingAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message)
      setMessages(
        data.messages.map((m: { role: 'user' | 'assistant'; text: string; tools?: string[] }) => ({
          role: m.role,
          text: m.text,
          toolLabels: m.tools,
        }))
      )
    } catch (err: any) {
      setBanner(err?.message || 'Could not open that conversation.')
      setMessages([])
      setConversationId(null)
    } finally {
      setLoadingConversation(false)
    }
  }

  function newConversation() {
    if (busy) return
    setConversationId(null)
    setMessages([])
    setBanner(null)
    inputRef.current?.focus()
  }

  async function removeConversation(id: string) {
    const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE', headers: billingAuthHeaders() })
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (id === conversationId) newConversation()
    }
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setBanner(null)
    setInput('')
    setBusy(true)
    const wasNew = !conversationId
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      { role: 'assistant', text: '', tools: [], streaming: true },
    ])

    const controller = new AbortController()
    abortRef.current = controller
    let failed = false
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...billingAuthHeaders() },
        body: JSON.stringify({ conversationId, message: question, watchlist: getWatchedClaims() }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message ?? 'Could not reach the AI Analyst.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (!line) continue
          const event = JSON.parse(line)
          switch (event.type) {
            case 'conversation':
              setConversationId(event.id)
              break
            case 'text_start':
              updateLast((m) => ({ ...m, note: undefined, text: m.text ? `${m.text}\n\n` : m.text }))
              break
            case 'text':
              updateLast((m) => ({ ...m, text: m.text + event.delta }))
              break
            case 'note':
              updateLast((m) => ({ ...m, note: (m.note ?? '') + event.delta }))
              break
            case 'tool_start':
              updateLast((m) => ({
                ...m,
                note: undefined,
                tools: [...(m.tools ?? []), { id: event.id, label: event.label, status: 'running' }],
              }))
              break
            case 'tool_end':
              updateLast((m) => ({
                ...m,
                tools: (m.tools ?? []).map((t) => (t.id === event.id ? { ...t, status: event.ok ? 'done' : 'failed' } : t)),
              }))
              break
            case 'reset':
              updateLast((m) => ({ ...m, text: '', note: undefined, tools: [] }))
              break
            case 'error':
              failed = true
              updateLast((m) => ({ ...m, error: event.message, streaming: false }))
              break
            case 'done':
              setRemainingToday(event.remainingToday)
              break
          }
        }
      }
    } catch (err: any) {
      failed = true
      if (err?.name === 'AbortError') {
        updateLast((m) => ({ ...m, error: 'Stopped. This answer was not saved.', streaming: false }))
      } else {
        updateLast((m) => ({ ...m, error: err?.message || 'Something went wrong.', streaming: false }))
      }
    } finally {
      updateLast((m) => ({ ...m, streaming: false, note: undefined }))
      abortRef.current = null
      setBusy(false)
      // A failed first turn is not saved, so there is no conversation to continue.
      if (failed && wasNew) setConversationId(null)
      refreshConversations()
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-1 min-h-0 max-w-6xl w-full mx-auto">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 p-3 gap-3">
        <Button onClick={newConversation} disabled={busy} variant="outline" className="justify-start gap-2 bg-transparent">
          <MessageSquarePlus className="w-4 h-4" />
          New conversation
        </Button>
        <nav className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5" aria-label="Conversations">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg ${
                c.id === conversationId ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                disabled={busy}
                className="flex-1 min-w-0 text-left px-2.5 py-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{c.title}</span>
                <span className="block text-[11px] text-slate-400">{relativeTime(c.updatedAt)}</span>
              </button>
              <button
                onClick={() => removeConversation(c.id)}
                disabled={busy}
                title="Delete conversation"
                aria-label={`Delete ${c.title}`}
                className="mr-1 p-1.5 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-slate-400">Your conversations will appear here.</p>
          )}
        </nav>
        {remainingToday !== null && (
          <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
            {remainingToday} message{remainingToday === 1 ? '' : 's'} left today
          </p>
        )}
      </aside>

      {/* Chat */}
      <section className="flex flex-1 min-w-0 flex-col">
        {/* Mobile conversation switcher (the sidebar is desktop-only) */}
        <div className="md:hidden flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
          <select
            value={conversationId ?? ''}
            onChange={(e) => (e.target.value ? openConversation(e.target.value) : newConversation())}
            disabled={busy}
            aria-label="Conversation"
            className="flex-1 min-w-0 truncate rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="">New conversation</option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          {remainingToday !== null && <span className="shrink-0 text-xs text-slate-500">{remainingToday} left</span>}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {loadingConversation ? (
            <div className="flex justify-center pt-20">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {banner && (
              <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{banner}</p>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 focus-within:ring-2 focus-within:ring-cyan-500/40">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={4000}
                placeholder="Ask about any claim, atom, wallet or trend…"
                aria-label="Message the AI Analyst"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none max-h-40"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              {busy ? (
                <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} title="Stop" aria-label="Stop generating">
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  title="Send"
                  aria-label="Send message"
                  className="bg-gradient-to-br from-cyan-500 to-purple-500 text-white border-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              The AI Analyst can make mistakes and doesn’t give financial advice. Check important numbers on the vault page.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto pt-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 text-white">
        <Sparkles className="w-6 h-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">AI Analyst</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Live Intuition data, explained. What do you want to know?</p>
      <div className="mt-8 grid sm:grid-cols-2 gap-3 text-left">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-200 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-colors cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 dark:bg-slate-700 px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words">
          {message.text}
        </div>
      </div>
    )
  }

  const tools = message.tools ?? []
  const historyTools = message.toolLabels ?? []
  const waiting = message.streaming && !message.text && tools.length === 0 && !message.note

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 text-white">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {(tools.length > 0 || historyTools.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
              >
                {t.status === 'running' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-500" />
                ) : t.status === 'done' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <TriangleAlert className="w-3 h-3 text-amber-500" />
                )}
                {t.label}
              </span>
            ))}
            {historyTools.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-500 dark:text-slate-400">
                <Wrench className="w-3 h-3" />
                {Array.from(new Set(historyTools)).join(' · ')}
              </span>
            )}
          </div>
        )}

        {message.note && message.streaming && (
          <p className="text-xs italic text-slate-500 dark:text-slate-400">{message.note}</p>
        )}

        {waiting && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
            Thinking…
          </div>
        )}

        {message.text && <Markdown text={message.text} />}

        {message.error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            {message.error}
          </p>
        )}
      </div>
    </div>
  )
}
