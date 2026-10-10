'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, Info, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BillingHeader from '@/components/billing/billing-header'
import { useAuthCheck, logout } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { billingAuthHeaders } from '@/lib/billing/auth-headers'
import {
  addInterval,
  BILLING_TESTNET,
  formatUsdc,
  INTERVAL_LABEL,
  isBillingInterval,
  PAYMENT_CHAIN_LABELS,
  PAYMENT_CHAINS,
  PREMIUM_PLAN,
  type BillingInterval,
} from '@/lib/billing/plans'

const LIVE_STATUSES = ['authorized', 'active', 'past_due']

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialInterval = searchParams.get('interval')
  const [interval, setBillingInterval] = useState<BillingInterval>(
    isBillingInterval(initialInterval) ? initialInterval : 'monthly'
  )
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; reauth?: boolean } | null>(null)

  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const { subscription, isLoading: subLoading, authError } = useSubscription(isAuthenticated)

  // Keep the URL shareable as the period changes.
  useEffect(() => {
    router.replace(`/checkout?plan=${PREMIUM_PLAN.id}&interval=${interval}`, { scroll: false })
  }, [interval, router])

  const price = PREMIUM_PLAN.prices[interval]
  const noun = INTERVAL_LABEL[interval].noun
  const today = useMemo(() => new Date(), [])
  // A cancelled-but-paid period carries over: the first charge waits until it ends.
  const paidThrough =
    subscription?.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > today
      ? new Date(subscription.currentPeriodEnd)
      : null
  const firstChargeDate = paidThrough ?? today
  const renewalDate = addInterval(firstChargeDate, interval)
  const alreadySubscribed = !!subscription && LIVE_STATUSES.includes(subscription.status)

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...billingAuthHeaders() },
        body: JSON.stringify({ plan: PREMIUM_PLAN.id, interval, email: email.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.authorizationUrl) {
        setError({
          message: data?.error?.message ?? 'Could not start checkout. Please try again.',
          reauth: res.status === 401,
        })
        setSubmitting(false)
        return
      }
      // Leave the button in its loading state while the browser navigates away.
      window.location.href = data.authorizationUrl
    } catch {
      setError({ message: 'Could not reach the server. Check your connection and try again.' })
      setSubmitting(false)
    }
  }

  if (authLoading || (isAuthenticated && subLoading)) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (!isAuthenticated || authError) {
    return (
      <CenteredCard
        title="Sign in to continue"
        body={authError ?? 'Premium is linked to your Portal Cap account. Sign in with your wallet or Discord to subscribe.'}
        action={
          authError ? (
            <Button onClick={logout}>Sign in again</Button>
          ) : (
            <Link href="/auth/login"><Button>Sign in</Button></Link>
          )
        }
      />
    )
  }

  if (alreadySubscribed) {
    return (
      <CenteredCard
        title="You’re already on Premium"
        body={
          subscription?.nextChargeAt
            ? `Your ${subscription.interval} plan renews on ${formatDate(new Date(subscription.nextChargeAt))}.`
            : 'Your subscription is being set up.'
        }
        action={<Link href="/dashboard"><Button>Go to dashboard</Button></Link>}
      />
    )
  }

  return (
    <form onSubmit={handleCheckout} className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
      {/* Left — choices and what is being authorized */}
      <div className="space-y-6">
        <div>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">Subscribe to Premium</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Pay in USDC from your wallet. One signature covers every renewal.</p>
        </div>

        <fieldset className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-white">Billing period</legend>
          <div role="radiogroup" className="mt-2 grid sm:grid-cols-2 gap-3">
            {(['monthly', 'yearly'] as const).map((option) => {
              const selected = interval === option
              const optionPrice = PREMIUM_PLAN.prices[option]
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setBillingInterval(option)}
                  className={`text-left rounded-lg border p-4 transition-colors cursor-pointer ${
                    selected
                      ? 'border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white">{INTERVAL_LABEL[option].adjective}</span>
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                    {formatUsdc(optionPrice.amount)} USDC / {INTERVAL_LABEL[option].noun}
                  </p>
                  {optionPrice.savingsLabel && (
                    <p className="mt-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400">{optionPrice.savingsLabel}</p>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
          <Label htmlFor="receipt-email" className="text-sm font-semibold text-slate-900 dark:text-white">
            Receipt email <span className="font-normal text-slate-400">(optional)</span>
          </Label>
          <Input
            id="receipt-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Our payment provider emails a receipt for every charge. Leave blank to skip receipts.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            What you’ll approve in your wallet
          </h2>
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Spending cap</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white tabular-nums">
                {formatUsdc(price.amount)} USDC per {noun}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pay from</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                {PAYMENT_CHAINS.map((c) => PAYMENT_CHAIN_LABELS[c]).join(', ')}
                {BILLING_TESTNET && <span className="font-normal text-slate-500"> (Sepolia)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Wallet</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">MetaMask (ERC-7715)</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Cancel</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">Revoke anytime in your wallet</dd>
            </div>
          </dl>
          <div className="mt-5 flex gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
            <Info className="w-4 h-4 shrink-0 text-slate-400" />
            <p>
              Each charge is taken from a single network that holds the full {formatUsdc(price.amount)} USDC. The first
              approval on a network sets up MetaMask’s smart account (a few cents of gas, once); renewals are gasless.
            </p>
          </div>
        </div>
      </div>

      {/* Right — order summary */}
      <aside className="lg:sticky lg:top-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Order summary</h2>
          {BILLING_TESTNET && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Testnet
            </span>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 text-white">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium text-slate-900 dark:text-white">Portal Cap {PREMIUM_PLAN.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Billed {INTERVAL_LABEL[interval].adjective.toLowerCase()}</p>
          </div>
          <p className="font-medium text-slate-900 dark:text-white tabular-nums">{formatUsdc(price.amount)}</p>
        </div>

        <dl className="mt-6 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Network fees</dt>
            <dd className="text-slate-900 dark:text-white">Covered</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-slate-900 dark:text-white">{paidThrough ? `Due ${formatDate(paidThrough)}` : 'Due today'}</dt>
            <dd className="text-slate-900 dark:text-white tabular-nums">{formatUsdc(price.amount)} USDC</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {paidThrough
            ? `You’ve already paid through ${formatDate(paidThrough)}, so nothing is charged today.`
            : `Then ${formatUsdc(price.amount)} USDC every ${noun}, next on ${formatDate(renewalDate)}.`}
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error.message}
            {error.reauth && (
              <button type="button" onClick={logout} className="mt-1 block font-medium underline cursor-pointer">
                Sign in again
              </button>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full h-11 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening authorization…
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Authorize with MetaMask
            </>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          You’ll sign on Sweep Console’s secure page and return here. Funds go straight from your wallet to ours —
          no one else holds them.
        </p>
      </aside>
    </form>
  )
}

function CenteredCard({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto my-16 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
      <div className="pt-2">{action}</div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <BillingHeader />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Suspense fallback={null}>
          <CheckoutContent />
        </Suspense>
      </main>
    </div>
  )
}
