'use client'

import { useState, useEffect } from 'react'
import { useCurrentUserId } from '@/hooks/useCurrentUserId'

export default function PushDebugPage() {
  const userId = useCurrentUserId()

  const [state, setState] = useState({
    supported: false,
    permission: 'unknown',
    hasBrowserSub: false,
    endpoint: '',
    serverCount: 0,
    inIframe: false,
    ua: '',
  })
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toISOString().slice(11, 19)} ${msg}`])

  useEffect(() => {
    async function probe() {
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      const permission = supported ? Notification.permission : 'n/a'
      const inIframe = (() => { try { return window.self !== window.top } catch { return true } })()
      const ua = navigator.userAgent.slice(0, 80)

      let hasBrowserSub = false
      let endpoint = ''
      if (supported) {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          hasBrowserSub = !!sub
          endpoint = sub?.endpoint?.slice(-30) ?? ''
        } catch (e: any) {
          addLog('SW error: ' + e.message)
        }
      }

      let serverCount = 0
      if (userId) {
        try {
          const res = await fetch(`/api/push-subscriptions?address=${encodeURIComponent(userId)}`)
          const data = await res.json()
          serverCount = data.count ?? 0
        } catch { /* ignore */ }
      }

      setState({ supported, permission, hasBrowserSub, endpoint, serverCount, inIframe, ua })
    }
    probe()
  }, [userId])

  async function handleSubscribe() {
    setBusy(true)
    addLog('Starting subscribe...')
    try {
      if (!userId) { addLog('ERROR: not signed in'); return }

      if (state.permission !== 'granted') {
        addLog('Requesting notification permission...')
        const result = await Notification.requestPermission()
        addLog('Permission result: ' + result)
        if (result !== 'granted') { addLog('BLOCKED — user denied'); return }
      }

      addLog('Getting service worker...')
      const reg = await navigator.serviceWorker.ready
      addLog('SW scope: ' + reg.scope)

      let sub = await reg.pushManager.getSubscription()
      if (sub) {
        addLog('Existing subscription found: ...' + sub.endpoint.slice(-20))
      } else {
        addLog('Creating new subscription...')
        const VAPID = 'BBzvhhej2AYuBRaiDZp0jnJIiG9aR0YGKNsAZldqSHsuS8wnAX35v8NIdjwBID8AtNFuC_lUHiDZNWLNTi189U8'
        const padding = '='.repeat((4 - (VAPID.length % 4)) % 4)
        const base64 = (VAPID + padding).replace(/-/g, '+').replace(/_/g, '/')
        const raw = atob(base64)
        const key = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i)

        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        addLog('New subscription: ...' + sub.endpoint.slice(-20))
      }

      addLog('Saving to server for userId: ' + userId)
      const subJson = sub.toJSON()
      const alertRanges = (() => {
        try { return JSON.parse(localStorage.getItem('portal_cap_alert_ranges') || 'null') } catch { return null }
      })()
      const res = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: userId,
          subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
          watchedClaims: [],
          alertRanges,
        }),
      })
      const data = await res.json()
      addLog(`Server response ${res.status}: ${JSON.stringify(data)}`)
      if (res.ok) {
        addLog('SUCCESS — subscription saved!')
        setState(s => ({ ...s, hasBrowserSub: true, serverCount: s.serverCount + 1 }))
      } else {
        addLog('FAILED — ' + (data.error || 'unknown error'))
      }
    } catch (e: any) {
      addLog('ERROR: ' + (e.message || String(e)))
    } finally {
      setBusy(false)
    }
  }

  async function handleSendTest() {
    setBusy(true)
    addLog('Sending test notification...')
    try {
      const res = await fetch('/api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userId }),
      })
      const data = await res.json()
      addLog(`Test result ${res.status}: ${JSON.stringify(data)}`)
    } catch (e: any) {
      addLog('Test error: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
    <div className="flex justify-between items-center border-b border-slate-700 py-2">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-mono ${ok === true ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-1">Push Debug</h1>
      <p className="text-slate-500 text-xs mb-4">Use this page on mobile to diagnose push notification issues.</p>

      <div className="bg-slate-900 rounded-lg p-4 mb-4 space-y-1">
        <Row label="User ID" value={userId ? (userId.startsWith('discord:') ? `Discord ${userId.slice(8)}` : `${userId.slice(0,8)}…`) : 'Not signed in'} ok={!!userId} />
        <Row label="Push supported" value={String(state.supported)} ok={state.supported} />
        <Row label="In iframe" value={String(state.inIframe)} ok={!state.inIframe} />
        <Row label="Permission" value={state.permission} ok={state.permission === 'granted'} />
        <Row label="Browser subscription" value={state.hasBrowserSub ? `yes (…${state.endpoint})` : 'none'} ok={state.hasBrowserSub} />
        <Row label="Server subscriptions" value={String(state.serverCount)} ok={state.serverCount > 0} />
      </div>

      <p className="text-slate-500 text-xs mb-2 break-all">UA: {state.ua}</p>

      {!state.supported && state.ua.includes('iPhone') && (
        <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg p-4 mb-4">
          <p className="text-amber-300 font-semibold text-sm mb-2">📱 iPhone detected — Safari requires a PWA install</p>
          <p className="text-amber-200 text-xs mb-3">iOS Safari blocks push notifications in regular browser tabs. You must first add this app to your Home Screen:</p>
          <ol className="text-amber-100 text-xs space-y-1 list-decimal list-inside">
            <li>Tap the <strong>Share</strong> button (box with arrow, bottom of Safari)</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>Add</strong> in the top-right</li>
            <li>Open the app from your Home Screen icon</li>
            <li>Come back to <strong>/push-debug</strong> and tap Enable</li>
          </ol>
        </div>
      )}

      <div className="space-y-2 mb-4">
        <button
          onClick={handleSubscribe}
          disabled={busy || !userId || !state.supported}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm"
        >
          {busy ? 'Working…' : 'Enable Alerts for This Account'}
        </button>
        <button
          onClick={handleSendTest}
          disabled={busy || state.serverCount === 0}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white py-2 rounded-lg text-sm"
        >
          Send Test Notification
        </button>
      </div>

      <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1 max-h-60 overflow-y-auto">
        {log.length === 0 ? <p className="text-slate-600">Log will appear here…</p> : log.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </div>
  )
}
