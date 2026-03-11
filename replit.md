# Portal Cap — Intuition Claims Monitor

## Overview
A Next.js 16 + React 19 web3 dApp for monitoring claims in real-time on the Intuition blockchain. Users connect their wallet, watch claims, and receive browser push notifications when claim metrics (market cap, positions, shares) change beyond user-configured thresholds.

## Project Architecture
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 with tw-animate-css
- **UI Components**: Radix UI primitives, shadcn/ui pattern
- **Web3**: RainbowKit + wagmi + viem for wallet connectivity
- **State**: React Query (TanStack Query)
- **Database**: Replit PostgreSQL (native)
- **Push Notifications**: Web Push API with VAPID keys (web-push package)

## Project Structure
```
app/              - Next.js App Router pages and API routes
  api/            - API endpoints
    claims/       - Intuition GraphQL proxies
    push-subscriptions/ - CRUD for push notification subscriptions
    check-notifications/ - Polls GraphQL, sends push notifications
    recent-events/  - Live blockchain events
    vault/          - Vault detail data
  dashboard/      - Dashboard page
  vault/          - Vault detail page
components/       - React components
  landing/        - Landing page components (claims-table, triples-table, etc.)
  ui/             - Shared UI components (shadcn/ui)
hooks/            - Custom React hooks
  usePushNotifications.ts - Manages browser push subscription lifecycle
  useUserPreferences.ts   - localStorage-based user preferences
  useIntuitionData.ts     - Data fetching hooks
lib/              - Utility functions and service clients
  push-notifications.ts   - Client-side Web Push utilities
  web-push-server.ts      - Server-side Web Push + PostgreSQL utilities
  intuition-graphql.ts    - Intuition GraphQL API queries
  local-storage.ts        - User preferences persistence
public/
  service-worker.js       - Push notification service worker
scripts/
  poll-notifications.js   - Background poller (calls /api/check-notifications every 2min)
```

## Workflows
- **Next.js Dev Server**: `npm run dev` — main web app on port 5000
- **Notification Poller**: `node scripts/poll-notifications.js` — background service that checks for claim changes and triggers push notifications every 2 minutes

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (Replit managed)
- `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — Web Push VAPID public key
- `VAPID_PRIVATE_KEY` — Web Push VAPID private key (server only)
- `VAPID_SUBJECT` — VAPID subject URL
- `CRON_SECRET` — Secret token for authenticating the notification poller
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — WalletConnect project ID

## Database Tables
- `push_subscriptions` — Stores browser push subscriptions (address, endpoint, keys, watched_claims[])
- `claim_snapshots` — Stores last-known claim metrics for change detection (market_cap, position_count, total_shares, etc.)

## Push Notification Flow
1. User connects wallet and enables push notifications
2. Browser subscribes via PushManager, subscription POSTed to `/api/push-subscriptions`
3. When user watches/unwatches a claim, watched list is PATCHed to server
4. `Notification Poller` workflow calls `/api/check-notifications` every 2 minutes
5. That endpoint queries Intuition GraphQL, compares with `claim_snapshots`, sends Web Push notifications for threshold-exceeding changes, then updates snapshots

## User Preferences (localStorage)
- Watched claims list
- Notification thresholds (market cap %, position count, shares %)
- Push notifications enabled flag
- Theme preference
