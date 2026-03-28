import { NextResponse } from 'next/server'

// TEMPORARY DEBUG ENDPOINT — DELETE AFTER FIXING
// Visit /api/debug-env after deploying to see what Vercel actually has
export async function GET() {
  return NextResponse.json({
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID
      ? `SET (starts with: ${process.env.DISCORD_CLIENT_ID.slice(0, 4)}...)`
      : 'MISSING ❌',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET
      ? 'SET ✅'
      : 'MISSING ❌',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING ❌',
    NODE_ENV: process.env.NODE_ENV,
  })
}
