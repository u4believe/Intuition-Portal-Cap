'use client'

type ForceColor = 'blue' | 'purple' | 'green' | 'red'

interface SparklineProps {
  data: number[]
  change?: number
  width?: number
  height?: number
  /** Override automatic green/red colouring with a fixed colour */
  forceColor?: ForceColor
}

const COLOR_MAP: Record<ForceColor, { stroke: string; fill: string }> = {
  blue:   { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.10)' },   // sky-400
  purple: { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.10)' },  // violet-400
  green:  { stroke: '#10b981', fill: 'rgba(16,185,129,0.08)' },   // emerald-500
  red:    { stroke: '#f43f5e', fill: 'rgba(244,63,94,0.08)' },    // rose-500
}

export default function Sparkline({ data, change = 0, width = 56, height = 22, forceColor }: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center opacity-25">
        <div className="w-full border-t border-dashed border-slate-400 dark:border-slate-600" />
      </div>
    )
  }

  let stroke: string
  let fill: string
  if (forceColor) {
    ;({ stroke, fill } = COLOR_MAP[forceColor])
  } else {
    const isUp = change >= 0
    stroke = isUp ? COLOR_MAP.green.stroke : COLOR_MAP.red.stroke
    fill   = isUp ? COLOR_MAP.green.fill   : COLOR_MAP.red.fill
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const pad = 2
  const w = width  - pad * 2
  const h = height - pad * 2

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w
    const y = pad + (1 - (v - min) / range) * h
    return [x, y] as [number, number]
  })

  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')

  const areaPath =
    linePath +
    ` L${pts[pts.length - 1][0].toFixed(2)},${(height - pad).toFixed(2)}` +
    ` L${pts[0][0].toFixed(2)},${(height - pad).toFixed(2)} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="overflow-visible">
      <path d={areaPath} fill={fill} />
      <path d={linePath} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
