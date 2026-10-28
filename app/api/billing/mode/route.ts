import { NextResponse } from 'next/server'
import { sweepMode } from '@/lib/billing/sweep'

// GET: whether payments are live (real USDC on mainnet) or test (Sepolia), from the configured key
export async function GET() {
  return NextResponse.json({ mode: sweepMode() }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
