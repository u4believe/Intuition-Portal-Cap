# Intuition Claims Monitor

## Overview
A Next.js web application for monitoring claims, market cap changes, price movements, and position updates on the Intuition platform in real-time. Built with React 19, Next.js 16, Tailwind CSS 4, and Supabase.

## Project Architecture
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 with tw-animate-css
- **UI Components**: Radix UI primitives, shadcn/ui pattern
- **Auth**: Supabase Auth
- **Database**: Supabase (external)
- **Web3**: RainbowKit + wagmi + viem for wallet connectivity
- **State**: React Query (TanStack Query)

## Project Structure
```
app/              - Next.js App Router pages and API routes
  api/            - API endpoints (claims, triples, events, vault)
  auth/           - Auth pages (login, signup, callback)
  dashboard/      - Dashboard page
  vault/          - Vault detail page
components/       - React components
  dashboard/      - Dashboard-specific components
  landing/        - Landing page components
  ui/             - Shared UI components (shadcn/ui)
hooks/            - Custom React hooks
lib/              - Utility functions and service clients
  supabase/       - Supabase client/server utilities
```

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - WalletConnect project ID
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)

## Development
- Dev server: `npm run dev` (runs on port 5000)
- Build: `npm run build`
- Start: `npm run start`

## Recent Changes
- 2026-02-24: Removed "24h %" and "V" (View) columns from all data tables (Vaults, Triples, Atoms). 24h% data is available in the vault detail page. Expanded all column headings to full names (Market Cap, Total Assets, Total Shares, Share Price, Positions). Added mobile-responsive card layout for all tables on small screens with full-width pagination controls.
- 2026-02-12: Initial Replit setup - configured port 5000, allowedDevOrigins, deployment
