'use client'

import { Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface InfoTooltipProps {
  text: string
  width?: string   // Tailwind width class, e.g. 'w-52' or 'w-56'
  iconClass?: string
}

/**
 * Info icon with tooltip that works on both hover (desktop) and tap (mobile).
 * Click toggles; clicking outside or pressing Escape dismisses.
 */
export function InfoTooltip({ text, width = 'w-52', iconClass = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function dismiss(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('touchstart', dismiss)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('touchstart', dismiss)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex group">
      <Info
        className={`w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 ${iconClass}`}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        aria-label="More info"
      />
      {/* Tooltip — visible on CSS hover (desktop) OR when open state is true (touch) */}
      <span
        className={[
          'absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[60]',
          width,
          'rounded-lg bg-slate-900 dark:bg-slate-950 px-3 py-2',
          'text-[11px] text-white font-normal leading-relaxed shadow-xl',
          'border border-slate-700 dark:border-slate-600',
          'pointer-events-none transition-opacity duration-150',
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        ].join(' ')}
      >
        {text}
      </span>
    </span>
  )
}
