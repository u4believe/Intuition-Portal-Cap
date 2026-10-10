'use client'

import { useCallback, useEffect, useState } from 'react'
import { billingAuthHeaders } from '@/lib/billing/auth-headers'
import type { BillingInterval, PlanId } from '@/lib/billing/plans'

export type SubscriptionStatus =
  | 'pending'
  | 'authorized'
  | 'active'
  | 'incomplete'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface SubscriptionInfo {
  plan: PlanId
  planName: string
  interval: BillingInterval
  amount: number
  amountDisplay: string
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  nextChargeAt: string | null
  lastFailureCode: string | null
}

interface State {
  subscription: SubscriptionInfo | null
  isPremium: boolean
  isLoading: boolean
  /** Set when the server could not verify who is signed in. */
  authError: string | null
  error: string | null
}

/**
 * Fetches the signed-in user's Premium status.
 * Pass enabled=false until the user is known to be signed in.
 */
export function useSubscription(enabled = true) {
  const [state, setState] = useState<State>({
    subscription: null,
    isPremium: false,
    isLoading: enabled,
    authError: null,
    error: null,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/subscription', {
        headers: billingAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (res.status === 401) {
        setState({ subscription: null, isPremium: false, isLoading: false, authError: data?.error?.message ?? 'Please sign in.', error: null })
        return null
      }
      if (!res.ok) {
        setState((s) => ({ ...s, isLoading: false, error: data?.error?.message ?? 'Could not load your subscription.' }))
        return null
      }
      setState({ subscription: data.subscription, isPremium: !!data.isPremium, isLoading: false, authError: null, error: null })
      return data.subscription as SubscriptionInfo | null
    } catch {
      setState((s) => ({ ...s, isLoading: false, error: 'Could not reach the server.' }))
      return null
    }
  }, [])

  useEffect(() => {
    if (enabled) refresh()
  }, [enabled, refresh])

  return { ...state, refresh }
}
