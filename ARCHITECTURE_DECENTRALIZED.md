# Decentralized dApp Architecture - Lore

## Overview

Lore is now a fully decentralized dApp with no backend server. All data fetching, user authentication, and preferences are handled client-side.

## Key Changes Made

### 1. Wallet Authentication (✓ Complete)
- Removed Supabase email/password auth
- Implemented wagmi + RainbowKit for multi-wallet support
- Users sign a message to prove wallet ownership
- Auth state stored in localStorage

### 2. Direct GraphQL Queries (✓ Complete)
- All API routes removed
- Direct client-side queries to Intuition Portal GraphQL
- React Query for caching and auto-refetching
- No backend relay needed

### 3. Push Protocol Integration (✓ Complete)
- Email notifications via decentralized Push Protocol (EPNS)
- Notification preferences stored locally
- Users can subscribe to alerts without central database

### 4. Local Storage (✓ Complete)
- Watched claims saved to browser
- Notification settings per wallet address
- No database dependency
- Full user privacy (data never leaves browser)

### 5. Static Export (✓ Complete)
- Next.js configured with `output: 'export'`
- No server functions or API routes
- Can deploy to: Vercel, GitHub Pages, IPFS, Netlify, etc.

## Deployment Options

### Option 1: Vercel (Recommended)
\`\`\`bash
npm run build
vercel deploy --yes
\`\`\`
No configuration needed, works with static export.

### Option 2: GitHub Pages
\`\`\`bash
npm run build
git add .next
git commit -m "Build"
git push
# Enable GitHub Pages in repo settings
\`\`\`

### Option 3: IPFS (True Decentralization)
\`\`\`bash
npm run build
# Upload .next/static to Pinata, Web3.Storage, or similar
\`\`\`

## Environment Setup

Create `.env.local`:
\`\`\`env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_id_here
NEXT_PUBLIC_PUSH_CHANNEL_ADDRESS=your_channel
NEXT_PUBLIC_PUSH_API_KEY=your_key
\`\`\`

Get these from:
- WalletConnect: https://cloud.walletconnect.com
- Push Protocol: https://app.push.org/channels

## Flow Diagram

\`\`\`
User Flow:
1. User visits app
2. Clicks "Connect Wallet" (RainbowKit)
3. Wallet signs message
4. Auth stored in localStorage
5. User can now:
   - View live events (direct GraphQL)
   - Browse claims (direct GraphQL)
   - Set notifications (localStorage + Push Protocol)
   - All data stays on client-side
\`\`\`

## No Backend Needed

- ❌ No Supabase (removed)
- ❌ No API routes (removed)
- ❌ No database (removed)
- ❌ No cron jobs (removed)
- ✅ Only frontend + direct external APIs

## Security

- Wallet-based auth (no password needed)
- No private keys stored
- Message signing only
- All data client-side (localStorage)
- CORS-free GraphQL endpoint (Intuition)

## What Each User Sees

Each user's data is keyed by their wallet address:
- `lore_auth` - current session
- `lore_0x123..._preferences` - watched claims
- `lore_0x123..._notifications` - alert settings

Data is never sent to any server.

## Future Enhancements

1. IndexedDB instead of localStorage for more storage
2. IPFS pinning for backup (optional)
3. ENS name resolution in UI
4. Custom RPC endpoints per user
5. Portable auth (move between devices)
