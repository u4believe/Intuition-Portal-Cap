'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-10 h-10" />
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-slate-700 dark:text-slate-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
