'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BillingHeader from '@/components/billing/billing-header'
import { useAuthCheck } from '@/hooks/useAuth'
import { useSubscription, type SubscriptionInfo } from '@/hooks/useSubscription'

const POLL_MS = 3_000
// Charges settle cross-chain in "seconds to minutes"; stop polling after this.
const POLL_TIMEOUT_MS = 5 * 60_000

const FAILURE_MESSAGES: Record<string, string> = {
  insufficient_funds:
    'None of your approved networks held the full amount in USDC. Top up one network and try again — balances aren’t combined across networks.',
  mandate_period_consumed: 'Your approval was already used for this billing period.',
  period_cap_exceeded: 'This payment is larger than what’s left on your approval for this period.',
  mandate_revoked: 'The approval was revoked before the payment went through.',
  mandate_not_active: 'The approval wasn’t completed in your wallet.',
  mandate_expired: 'The approval has expired.',
}

type View = 'waiting_signature' | 'collecting' | 'success' | 'failed' | 'timeout' | 'none'

function viewFor(sub: SubscriptionInfo | null, isPremium: boolean): View {
  if (!sub) return 'none'
  if (isPremium && (sub.status === 'active' || sub.status === 'past_due')) return 'success'
  if (sub.status === 'authorized') return 'collecting'
  if (sub.status === 'pending') return 'waiting_signature'
  if (sub.status === 'incomplete') return 'failed'
  if (isPremium) return 'success'
  return 'failed'
}

export default function CheckoutReturnPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const { subscription, isPremium, isLoading, refresh } = useSubscription(isAuthenticated)
  const [timedOut, setTimedOut] = useState(false)
  const startedAt = useRef(Date.now())

  const view: View = timedOut ? 'timeout' : viewFor(subscription, isPremium)
  const settled = view === 'success' || view === 'failed' || view === 'none'

  useEffect(() => {
    if (!isAuthenticated || isLoading || settled || timedOut) return
    const id = window.setTimeout(() => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) setTimedOut(true)
      else refresh()
    }, POLL_MS)
    return () => window.clearTimeout(id)
  }, [isAuthenticated, isLoading, settled, timedOut, subscription, refresh])

  const loading = authLoading || (isAuthenticated && isLoading)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <BillingHeader />
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
          {loading ? (
            <Loader2 className="mx-auto w-8 h-8 animate-spin text-cyan-500" />
          ) : !isAuthenticated ? (
            <Status
              icon={<AlertTriangle className="w-10 h-10 text-amber-500" />}
              title="Sign in to see your subscription"
              body="Your payment is linked to the account you checked out with."
              action={<Link href="/auth/login"><Button>Sign in</Button></Link>}
            />
          ) : view === 'success' ? (
            <Status
              icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
              title="Welcome to Premium"
              body={
                subscription?.nextChargeAt
                  ? `Payment received. Your plan renews on ${new Date(subscription.nextChargeAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                  : 'Payment received. Premium is now active on your account.'
              }
              action={<Link href="/analyst"><Button>Try the AI Analyst</Button></Link>}
            />
          ) : view === 'collecting' ? (
            <Status
              icon={<Loader2 className="w-10 h-10 animate-spin text-cyan-500" />}
              title="Confirming your payment"
              body="Your approval went through. We’re collecting the first payment — this usually takes under a minute. You can leave this page; Premium activates automatically."
            />
          ) : view === 'waiting_signature' ? (
            <Status
              icon={<Clock className="w-10 h-10 text-slate-400" />}
              title="Waiting for your approval"
              body="We haven’t received your wallet approval yet. If you closed the MetaMask window, start checkout again."
              action={
                <Link href={`/checkout?plan=${subscription?.plan ?? 'premium'}&interval=${subscription?.interval ?? 'monthly'}`}>
                  <Button variant="outline">Back to checkout</Button>
                </Link>
              }
            />
          ) : view === 'timeout' ? (
            <Status
              icon={<Clock className="w-10 h-10 text-amber-500" />}
              title="Still processing"
              body="This is taking longer than usual. Premium will activate automatically once the payment settles — check back in a few minutes."
              action={<Link href="/dashboard"><Button variant="outline">Go to dashboard</Button></Link>}
            />
          ) : view === 'failed' ? (
            <Status
              icon={<AlertTriangle className="w-10 h-10 text-red-500" />}
              title="Payment didn’t go through"
              body={
                (subscription?.lastFailureCode && FAILURE_MESSAGES[subscription.lastFailureCode]) ??
                'We couldn’t collect your payment. Nothing was charged.'
              }
              action={
                <Link href={`/checkout?plan=${subscription?.plan ?? 'premium'}&interval=${subscription?.interval ?? 'monthly'}`}>
                  <Button>Try again</Button>
                </Link>
              }
            />
          ) : (
            <Status
              icon={<AlertTriangle className="w-10 h-10 text-slate-400" />}
              title="No checkout found"
              body="We couldn’t find a subscription for this account."
              action={<Link href="/pricing"><Button>View plans</Button></Link>}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function Status({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
