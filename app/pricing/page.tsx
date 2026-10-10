'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles, Wallet, PenLine, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BillingHeader from '@/components/billing/billing-header'
import IntervalToggle from '@/components/billing/interval-toggle'
import { useAuthCheck } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import {
  BILLING_TESTNET,
  FREE_FEATURES,
  formatUsdc,
  INTERVAL_LABEL,
  PAYMENT_CHAIN_LABELS,
  PAYMENT_CHAINS,
  PREMIUM_PLAN,
  type BillingInterval,
} from '@/lib/billing/plans'

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect MetaMask',
    body: `Pay in USDC from ${PAYMENT_CHAINS.map((c) => PAYMENT_CHAIN_LABELS[c]).join(', ')}. No card, no account to create.`,
  },
  {
    icon: PenLine,
    title: 'Sign once',
    body: 'Approve a spending cap equal to the plan price. It is the most that can ever be collected per period.',
  },
  {
    icon: RefreshCw,
    title: 'Renews automatically',
    body: 'Each renewal is collected gaslessly. Revoke the permission in your wallet at any time to cancel.',
  },
]

const FAQ = [
  {
    q: 'Which wallet do I need?',
    a: 'A wallet that supports ERC-7715 permissions — MetaMask today. The first authorization on a network also sets up MetaMask’s smart account, which costs a few cents of gas once.',
  },
  {
    q: 'Where does the USDC come from?',
    a: 'Any one of Base, Arbitrum or Optimism. Each charge is taken from a single network that holds the full amount — balances are not combined across networks.',
  },
  {
    q: 'How do I cancel?',
    a: 'Revoke the permission in your wallet. You keep Premium until the end of the period you already paid for.',
  },
  {
    q: 'Can I be charged more than the price?',
    a: 'No. Your wallet enforces the cap you sign, so nothing above the plan price per period can be collected.',
  },
]

export default function PricingPage() {
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly')
  const { isAuthenticated, isLoading: authLoading } = useAuthCheck()
  const { isPremium } = useSubscription(isAuthenticated)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const price = PREMIUM_PLAN.prices[interval]
  const monthlyEquivalent = interval === 'yearly' ? price.amount / 12 : null
  const checkoutHref = `/checkout?plan=${PREMIUM_PLAN.id}&interval=${interval}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <BillingHeader />

      <main className="max-w-6xl mx-auto px-4 py-12 sm:py-16 space-y-16">
        <section className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
            <Sparkles className="w-3.5 h-3.5" />
            Portal Cap Premium
            {BILLING_TESTNET && <span className="text-cyan-600/70 dark:text-cyan-400/70">· Testnet</span>}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            Understand every claim, faster
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-slate-500 dark:text-slate-400">
            Premium adds an AI analyst to Portal Cap. Pay in USDC straight from your wallet — sign once, cancel anytime.
          </p>
          <div className="pt-2">
            <IntervalToggle value={interval} onChange={setBillingInterval} />
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Free</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Monitor the Intuition graph in real time.</p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-slate-900 dark:text-white">0</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">USDC</span>
            </p>
            <ul className="mt-6 space-y-3 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/" className="mt-8">
              <Button variant="outline" className="w-full border-slate-300 dark:border-slate-700 bg-transparent">
                {mounted && isAuthenticated && !isPremium ? 'Your current plan' : 'Explore for free'}
              </Button>
            </Link>
          </div>

          {/* Premium */}
          <div className="relative flex flex-col rounded-2xl p-[1.5px] bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-500 shadow-xl shadow-cyan-500/10">
            <div className="flex flex-col flex-1 rounded-[calc(1rem-1.5px)] bg-white dark:bg-slate-900 p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-500" />
                  {PREMIUM_PLAN.name}
                </h2>
                <span className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  AI included
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{PREMIUM_PLAN.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums">{formatUsdc(price.amount)}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">USDC / {INTERVAL_LABEL[interval].noun}</span>
              </p>
              <p className="mt-1 h-5 text-xs text-slate-500 dark:text-slate-400">
                {monthlyEquivalent !== null && `≈ ${formatUsdc(monthlyEquivalent)} USDC per month`}
              </p>
              <ul className="mt-5 space-y-3 flex-1">
                {PREMIUM_PLAN.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-cyan-500" />
                    {f}
                  </li>
                ))}
              </ul>
              {mounted && isPremium ? (
                <Link href="/dashboard" className="mt-8">
                  <Button className="w-full" variant="outline">You’re on Premium — go to dashboard</Button>
                </Link>
              ) : (
                <Link href={mounted && !authLoading && !isAuthenticated ? '/auth/login' : checkoutHref} className="mt-8">
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0">
                    {mounted && !authLoading && !isAuthenticated ? 'Sign in to upgrade' : 'Upgrade with USDC'}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">How paying with USDC works</h2>
          <ol className="mt-6 grid sm:grid-cols-3 gap-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="max-w-3xl mx-auto">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">Questions</h2>
          <dl className="mt-6 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="p-5">
                <dt className="font-medium text-slate-900 dark:text-white">{q}</dt>
                <dd className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  )
}
