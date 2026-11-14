'use client'

/**
 * The only file that knows the chart is a TradingView widget. Props are
 * generic (our instrument id, interval, theme, height) so swapping this for
 * Advanced Charts later touches nothing else. Nothing outside this file may
 * reach into the widget's DOM.
 *
 * The widget is a sealed, TradingView-hosted iframe showing TradingView's
 * data: market overview only — never attach orders or positions to it.
 */
import { useEffect, useRef, useState } from 'react'
import { getInstrument } from '@/lib/markets'

const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'

// Below this width the drawing toolbar is dropped so the candles get the room.
const COMPACT_QUERY = '(max-width: 767px)'

const SURFACE = {
  dark: { backgroundColor: 'rgba(15, 23, 42, 1)', gridColor: 'rgba(148, 163, 184, 0.08)' },
  light: { backgroundColor: 'rgba(255, 255, 255, 1)', gridColor: 'rgba(15, 23, 42, 0.06)' },
}

export interface MarketChartProps {
  /** Our instrument id from lib/markets */
  instrumentId: string
  /** Minutes as a number string, or D / W / M */
  interval?: string
  theme?: 'light' | 'dark'
  /** Any CSS height. The chart fills it, so it must resolve to a real height. */
  height?: number | string
}

export default function MarketChart({ instrumentId, interval = 'D', theme = 'dark', height = 600 }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [failed, setFailed] = useState(false)
  const instrument = getInstrument(instrumentId)
  const symbol = instrument?.tvSymbol

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY)
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // The widget has no API to change symbol in place: rebuild it on every change.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !symbol) return
    setFailed(false)

    container.innerHTML = `
      <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px)"></div>
      <div class="tradingview-widget-copyright" style="height:32px;line-height:32px;text-align:center;font-size:12px">
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          Track all markets on TradingView
        </a>
      </div>`

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.type = 'text/javascript'
    script.async = true
    // The config is the script's text content, not an attribute.
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Africa/Lagos',
      theme,
      style: '1',
      locale: 'en',
      // Our own picker drives the symbol.
      allow_symbol_change: false,
      hide_side_toolbar: compact,
      withdateranges: !compact,
      ...SURFACE[theme],
      support_host: 'https://www.tradingview.com',
    })
    // No offline mode: if TradingView's CDN is unreachable, show a fallback instead of a blank box.
    script.onerror = () => setFailed(true)

    container.appendChild(script)
    // Clearing the container is what stops orphaned iframes piling up.
    return () => {
      container.innerHTML = ''
    }
  }, [symbol, interval, theme, compact])

  const tvUrl = symbol ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}` : 'https://www.tradingview.com/'

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} className="tradingview-widget-container h-full text-slate-500 dark:text-slate-400" />
      {(failed || !symbol) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-900 px-6 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            The chart could not be loaded
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            Charts are provided by TradingView and need a connection to tradingview.com. Check your connection or ad blocker.
          </p>
          <a
            href={tvUrl}
            target="_blank"
            rel="noopener nofollow"
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Open {instrument?.label ?? 'markets'} on TradingView
          </a>
        </div>
      )}
    </div>
  )
}
