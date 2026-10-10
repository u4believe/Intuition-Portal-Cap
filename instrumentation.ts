export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const PORT = process.env.PORT || '5000'
  const BASE_URL = `http://localhost:${PORT}`
  const CRON_SECRET = process.env.CRON_SECRET || ''
  const INTERVAL_MS = 10_000

  // Wait for the server to be fully ready before starting
  await new Promise((resolve) => setTimeout(resolve, 8000))

  let lastPollStart = new Date().toISOString()
  let isRunning = false

  console.log('[Self-Poller] Production notification poller started.')
  console.log(`[Self-Poller] Polling ${BASE_URL}/api/check-notifications every ${INTERVAL_MS / 1000}s`)

  const poll = async () => {
    if (isRunning) return
    isRunning = true
    const thisPollStart = new Date().toISOString()

    try {
      const url = `${BASE_URL}/api/check-notifications?since=${encodeURIComponent(lastPollStart)}`
      const res = await fetch(url, {
        headers: {
          'x-cron-secret': CRON_SECRET,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(25000),
      })

      if (res.ok) {
        const data = await res.json()
        lastPollStart = thisPollStart
        if ((data.notificationsSent ?? 0) > 0) {
          console.log(`[Self-Poller] Sent ${data.notificationsSent} notification(s) | subs=${data.subscriptions} events=${data.liveEventsChecked}`)
        }
      } else {
        const text = await res.text().catch(() => '')
        console.warn(`[Self-Poller] API returned ${res.status}: ${text.slice(0, 120)}`)
      }
    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        console.warn('[Self-Poller] Request timed out after 25s')
      } else {
        console.warn('[Self-Poller] Fetch error:', err?.message)
      }
    } finally {
      isRunning = false
    }
  }

  // Run once immediately, then on interval
  await poll()
  setInterval(poll, INTERVAL_MS)

  // Premium renewals — idempotent, so overlapping with Vercel Cron is harmless.
  const BILLING_INTERVAL_MS = 15 * 60_000
  let billingRunning = false
  const pollBilling = async () => {
    if (billingRunning || !CRON_SECRET) return
    billingRunning = true
    try {
      const res = await fetch(`${BASE_URL}/api/cron/billing`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        signal: AbortSignal.timeout(120_000),
      })
      if (!res.ok) console.warn(`[Self-Poller] Billing cron returned ${res.status}`)
    } catch (err: any) {
      console.warn('[Self-Poller] Billing cron error:', err?.message)
    } finally {
      billingRunning = false
    }
  }
  await pollBilling()
  setInterval(pollBilling, BILLING_INTERVAL_MS)
}
