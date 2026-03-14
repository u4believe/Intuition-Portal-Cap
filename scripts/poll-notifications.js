/**
 * Notification Polling Script
 * Runs as a background process and calls /api/check-notifications every 2 minutes.
 * Polls ALL configured URLs (dev + production) so subscriptions in both databases
 * receive alerts. Each URL has its own independent timestamp cursor to prevent
 * missed or duplicate events.
 */

const POLL_INTERVAL_MS = 1 * 60 * 1000 // 1 minute
const CRON_SECRET = process.env.CRON_SECRET || ''

// Build the list of URLs to poll.
// Dev domain always first (if available). Production URL added if configured or known.
const POLL_URLS = []
if (process.env.REPLIT_DEV_DOMAIN) {
  POLL_URLS.push(`https://${process.env.REPLIT_DEV_DOMAIN}`)
}
const PROD_URL = process.env.PRODUCTION_URL || 'https://intuition-portal-cap-1.replit.app'
if (PROD_URL && !POLL_URLS.includes(PROD_URL)) {
  POLL_URLS.push(PROD_URL)
}
if (POLL_URLS.length === 0) {
  POLL_URLS.push('http://localhost:5000')
}

// Independent timestamp cursor per URL so each database window advances separately.
const lastPollStartedAt = {}
const isRunning = {}

async function checkNotificationsForUrl(baseUrl) {
  if (isRunning[baseUrl]) {
    console.log(`[Poller] ${baseUrl} — previous check still running, skipping`)
    return
  }

  isRunning[baseUrl] = true
  const thisPollStart = new Date().toISOString()

  try {
    const url = new URL(`${baseUrl}/api/check-notifications`)
    if (lastPollStartedAt[baseUrl]) {
      url.searchParams.set('since', lastPollStartedAt[baseUrl])
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Poller] ${baseUrl} returned ${response.status}:`, text)
      return
    }

    const result = await response.json()
    const elapsed = Date.now() - new Date(thisPollStart).getTime()

    console.log(
      `[Poller] ${baseUrl} — ${elapsed}ms | ` +
      `subs=${result.subscriptions ?? 0} events=${result.liveEventsChecked ?? 0} sent=${result.notificationsSent ?? 0}`
    )

    lastPollStartedAt[baseUrl] = thisPollStart
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      console.warn(`[Poller] ${baseUrl} — request timed out after 30s`)
    } else {
      console.error(`[Poller] ${baseUrl} — error:`, error.message)
    }
  } finally {
    isRunning[baseUrl] = false
  }
}

async function checkAll() {
  console.log(`[Poller] Checking at ${new Date().toISOString()}...`)
  await Promise.allSettled(POLL_URLS.map(url => checkNotificationsForUrl(url)))
}

async function waitForServer(baseUrl, maxAttempts = 20, delayMs = 3000) {
  console.log(`[Poller] Waiting for ${baseUrl} to be ready...`)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/recent-events`, {
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        console.log(`[Poller] ${baseUrl} ready`)
        return true
      }
    } catch { /* not ready yet */ }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  console.warn(`[Poller] ${baseUrl} did not become ready in time — will still poll it`)
  return false
}

async function main() {
  console.log(`[Poller] Starting. Interval: ${POLL_INTERVAL_MS / 1000}s`)
  console.log(`[Poller] Polling URLs: ${POLL_URLS.join(', ')}`)

  // Wait for the local dev server if it's in the list
  const devUrl = POLL_URLS.find(u => process.env.REPLIT_DEV_DOMAIN && u.includes(process.env.REPLIT_DEV_DOMAIN))
  if (devUrl) await waitForServer(devUrl)

  await checkAll()
  setInterval(checkAll, POLL_INTERVAL_MS)
  console.log('[Poller] Running. Press Ctrl+C to stop.')
}

main().catch(error => {
  console.error('[Poller] Fatal error:', error)
  process.exit(1)
})
