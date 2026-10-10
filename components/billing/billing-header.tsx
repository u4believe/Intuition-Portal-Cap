'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export default function BillingHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <img src="/logo.jpg" alt="Portal Cap Logo" className="h-10 w-auto rounded-full" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/" className="hidden sm:block">
            <Button variant="ghost" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              Home
            </Button>
          </Link>
          <Link href="/analyst">
            <Button variant="ghost" className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300">
              AI Analyst
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              Dashboard
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
