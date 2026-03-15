export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const BASE_URL = 'http://localhost:5000'
  const INTERVAL_MS = 10_000

  await new Promise((resolve) => setTimeout(resolve, 5000))

  let since = new Date().toISOString()

  console.log('[Self-Poller] Production notification poller started.')

  const poll = async () => {
    try {
      const url = `${BASE_URL}/api/check-notifications?since=${encodeURIComponent(since)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        since = new Date().toISOString()
        if (data.sent > 0) {
          console.log(`[Self-Poller] Sent ${data.sent} notification(s)`)
        }
      }
    } catch {
    }
  }

  setInterval(poll, INTERVAL_MS)
}
