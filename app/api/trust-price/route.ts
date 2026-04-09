import { NextResponse } from 'next/server'

// Most liquid TRUST/USDC pair: Aerodrome on Base
// Liquidity: ~$360K | Volume 24h: ~$24K
const PAIR_ADDRESS = '0x17f707CF3EDBbd5d9251D4bCDF9Ad70a247D7B84'
const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/pairs/base/${PAIR_ADDRESS}`

export async function GET() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

    let res: Response
    try {
      res = await fetch(DEXSCREENER_URL, {
        next: { revalidate: 30 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PortalCap/1.0)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) throw new Error(`DexScreener responded ${res.status}`)

    const data = await res.json()
    const pair = data?.pairs?.[0]

    if (!pair) throw new Error('Pair not found')

    return NextResponse.json({
      priceUsd: pair.priceUsd,
      priceChange24h: pair.priceChange?.h24 ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      volume24h: pair.volume?.h24 ?? null,
      dex: pair.dexId,
      chain: pair.chainId,
      pairAddress: pair.pairAddress,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[trust-price] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch TRUST price' }, { status: 500 })
  }
}
