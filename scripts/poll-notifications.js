/**
 * Notification Polling Script
 * Runs as a background process and calls /api/check-notifications every 2 minutes.
 * Tracks the last-poll timestamp so every live event is processed exactly once
 * (no duplicate notifications from overlapping time windows).
 */

const POLL_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : 'http://localhost:5000'
const CRON_SECRET = process.env.CRON_SECRET || ''

let isRunning = false
// Track the exact moment each poll cycle starts so the next cycle picks up from there.
// Starts as null; the API falls back to "now - 5 min" on the very first run.
let lastPollStartedAt = null

async function checkNotifications() {
  if (isRunning) {
    console.log('[Poller] Previous check still running, skipping...')
    return
  }

  isRunning = true
  const thisPollStart = new Date().toISOString()

  try {
    console.log(`[Poller] Checking notifications at ${thisPollStart}...`)

    const url = new URL(`${BASE_URL}/api/check-notifications`)
    if (lastPollStartedAt) {
      url.searchParams.set('since', lastPollStartedAt)
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Poller] API returned ${response.status}:`, text)
      return
    }

    const result = await response.json()
    const elapsed = Date.now() - new Date(thisPollStart).getTime()

    console.log(
      `[Poller] Done in ${elapsed}ms. ` +
      `Subscriptions: ${result.subscriptions ?? 0}, ` +
      `Claims watched: ${result.claimsWatched ?? 0}, ` +
      `Live events checked: ${result.liveEventsChecked ?? 0}, ` +
      `Notifications sent: ${result.notificationsSent ?? 0}`
    )

    // Only advance the cursor when the poll succeeds
    lastPollStartedAt = thisPollStart
  } catch (error) {
    console.error('[Poller] Error calling check-notifications:', error.message)
  } finally {
    isRunning = false
  }
}

async function waitForServer(maxAttempts = 20, delayMs = 3000) {
  console.log('[Poller] Waiting for Next.js server to be ready...')
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/api/recent-events`)
      if (response.ok) {
        console.log('[Poller] Server is ready!')
        return true
      }
    } catch {
      // Server not ready yet
    }
    console.log(`[Poller] Server not ready, attempt ${i + 1}/${maxAttempts}...`)
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  console.error('[Poller] Server did not become ready in time')
  return false
}

async function main() {
  console.log(`[Poller] Starting notification poller, interval: ${POLL_INTERVAL_MS / 1000}s`)
  console.log(`[Poller] Target URL: ${BASE_URL}`)

  const serverReady = await waitForServer()
  if (!serverReady) {
    process.exit(1)
  }

  await checkNotifications()
  setInterval(checkNotifications, POLL_INTERVAL_MS)
  console.log('[Poller] Polling started. Press Ctrl+C to stop.')
}

main().catch(error => {
  console.error('[Poller] Fatal error:', error)
  process.exit(1)
})
