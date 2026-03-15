/**
 * Notification Polling Script
 * Two independent timers:
 *   - Events (deposits/redemptions): every 10 seconds
 *   - Snapshots (market cap, positions, shares): every 15 seconds
 * Polls ALL configured URLs so subscriptions in both databases receive alerts.
 * Each URL has its own independent timestamp cursor for events.
 */

const EVENTS_INTERVAL_MS   = 10 * 1000  // 10 seconds
const SNAPSHOTS_INTERVAL_MS = 15 * 1000  // 15 seconds
const CRON_SECRET = process.env.CRON_SECRET || ''

// Build the list of URLs to poll.
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

// Independent timestamp cursors per URL for events polling
const lastEventsPollAt = {}
const isRunning = {}

async function pollUrl(baseUrl, mode) {
  const key = `${baseUrl}:${mode}`
  if (isRunning[key]) return

  isRunning[key] = true
  const thisPollStart = new Date().toISOString()

  try {
    const url = new URL(`${baseUrl}/api/check-notifications`)
    url.searchParams.set('mode', mode)

    // Only events mode needs the since cursor to avoid duplicate alerts
    if (mode === 'events' && lastEventsPollAt[baseUrl]) {
      url.searchParams.set('since', lastEventsPollAt[baseUrl])
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Poller/${mode}] ${baseUrl} returned ${response.status}:`, text)
      return
    }

    const result = await response.json()
    const elapsed = Date.now() - new Date(thisPollStart).getTime()

    console.log(
      `[Poller/${mode}] ${baseUrl} — ${elapsed}ms | ` +
      `subs=${result.subscriptions ?? 0} events=${result.liveEventsChecked ?? 0} sent=${result.notificationsSent ?? 0}`
    )

    if (mode === 'events') {
      lastEventsPollAt[baseUrl] = thisPollStart
    }
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      console.warn(`[Poller/${mode}] ${baseUrl} — request timed out after 25s`)
    } else {
      console.error(`[Poller/${mode}] ${baseUrl} — error:`, error.message)
    }
  } finally {
    isRunning[key] = false
  }
}

async function checkEvents() {
  await Promise.allSettled(POLL_URLS.map(url => pollUrl(url, 'events')))
}

async function checkSnapshots() {
  await Promise.allSettled(POLL_URLS.map(url => pollUrl(url, 'snapshots')))
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
  console.log(`[Poller] Starting.`)
  console.log(`[Poller] Events interval: ${EVENTS_INTERVAL_MS / 1000}s | Snapshots interval: ${SNAPSHOTS_INTERVAL_MS / 1000}s`)
  console.log(`[Poller] Polling URLs: ${POLL_URLS.join(', ')}`)

  // Wait for the local dev server if it's in the list
  const devUrl = POLL_URLS.find(u => process.env.REPLIT_DEV_DOMAIN && u.includes(process.env.REPLIT_DEV_DOMAIN))
  if (devUrl) await waitForServer(devUrl)

  // Initial run of both modes
  await checkEvents()
  await checkSnapshots()

  // Start independent timers
  setInterval(checkEvents, EVENTS_INTERVAL_MS)
  setInterval(checkSnapshots, SNAPSHOTS_INTERVAL_MS)

  console.log('[Poller] Running. Press Ctrl+C to stop.')
}

main().catch(error => {
  console.error('[Poller] Fatal error:', error)
  process.exit(1)
})
