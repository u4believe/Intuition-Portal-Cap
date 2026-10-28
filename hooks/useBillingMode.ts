'use client'

import { useEffect, useState } from 'react'

export type BillingMode = 'live' | 'test' | null

/** 'test' while the site uses a Sweep test key (Sepolia, no real funds), 'live' on mainnet. */
export function useBillingMode(): BillingMode {
  const [mode, setMode] = useState<BillingMode>(null)
  useEffect(() => {
    fetch('/api/billing/mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMode(d?.mode ?? null))
      .catch(() => {})
  }, [])
  return mode
}
