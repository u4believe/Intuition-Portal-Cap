'use client'

import { INTERVAL_LABEL, PREMIUM_PLAN, type BillingInterval } from '@/lib/billing/plans'

export default function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval
  onChange: (interval: BillingInterval) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
    >
      {(['monthly', 'yearly'] as const).map((interval) => {
        const selected = value === interval
        const savings = PREMIUM_PLAN.prices[interval].savingsLabel
        return (
          <button
            key={interval}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(interval)}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              selected
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {INTERVAL_LABEL[interval].adjective}
            {savings && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  selected
                    ? 'bg-cyan-400/20 text-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-700'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                }`}
              >
                {savings}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
