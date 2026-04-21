'use client'

import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, ReferenceDot } from 'recharts'
import { ACCENT_SILVER, GREEN, AMBER, RED } from '@/lib/design-system'

export type SparklineTone = 'silver' | 'green' | 'amber' | 'red'

const TONE_COLOR: Record<SparklineTone, string> = {
  silver: ACCENT_SILVER,
  green: GREEN,
  amber: AMBER,
  red: RED,
}

interface Props {
  data: number[]
  tone?: SparklineTone
  height?: number
  ariaLabel?: string
  /** Show 7-day labels + value on hover. Default off to preserve the silent default. */
  showTooltip?: boolean
  /** Render a small +N% pill vs prior-half. Default off. */
  showDelta?: boolean
  /** When true, negative deltas render (operator/owner only). Client surfaces
   *  must keep this false — invariant #24 + client-accounting-ethics. */
  allowNegativeDelta?: boolean
  /** Emphasize the most recent point with a solid dot. */
  highlightToday?: boolean
}

interface SparkRow {
  i: number
  v: number
  label: string
}

function halfwayDelta(data: number[]): number | null {
  if (!data || data.length < 2) return null
  const mid = Math.floor(data.length / 2)
  const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const prevSum = sum(data.slice(0, mid))
  const currSum = sum(data.slice(mid))
  if (prevSum === 0) return currSum > 0 ? 100 : null
  return Math.round(((currSum - prevSum) / prevSum) * 100)
}

function dayLabel(i: number, total: number): string {
  const daysAgo = total - 1 - i
  if (daysAgo === 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  return `Hace ${daysAgo} días`
}

interface TooltipRenderProps {
  active?: boolean
  payload?: Array<{ payload?: SparkRow }>
}

function SparkTooltip({ active, payload }: TooltipRenderProps) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(192,197,206,0.18)',
        borderRadius: 8,
        padding: '4px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        lineHeight: 1.3,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: 'var(--portal-fg-4)', fontSize: 9, letterSpacing: '0.04em' }}>
        {row.label.toUpperCase()}
      </div>
      <div style={{ color: 'var(--portal-fg-1)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {row.v}
      </div>
    </div>
  )
}

export function Sparkline({
  data,
  tone = 'silver',
  height = 28,
  ariaLabel,
  showTooltip = false,
  showDelta = false,
  allowNegativeDelta = false,
  highlightToday = false,
}: Props) {
  if (!data?.length) return <div style={{ height }} aria-hidden />
  const color = TONE_COLOR[tone]
  const rows: SparkRow[] = data.map((v, i) => ({
    i,
    v: Number.isFinite(v) ? v : 0,
    label: dayLabel(i, data.length),
  }))
  const gradientId = `spark-${tone}`
  const delta = showDelta ? halfwayDelta(data) : null
  const shouldShowDelta = delta !== null && (allowNegativeDelta || delta > 0)
  const last = rows[rows.length - 1]

  return (
    <div
      style={{ position: 'relative', width: '100%', height }}
      role={showTooltip ? undefined : 'img'}
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            fill={`url(#${gradientId})`}
          />
          {showTooltip && (
            <Tooltip
              cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 1 }}
              content={<SparkTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
          )}
          {highlightToday && last && (
            <ReferenceDot
              x={last.i}
              y={last.v}
              r={2.5}
              fill={color}
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={1}
              ifOverflow="visible"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {shouldShowDelta && delta !== null && (
        <span
          aria-label={`Cambio vs semana pasada ${delta > 0 ? '+' : ''}${delta}%`}
          style={{
            position: 'absolute',
            top: -2,
            right: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: delta > 0 ? 'var(--portal-status-green-fg)' : 'var(--portal-fg-4)',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(192,197,206,0.15)',
            borderRadius: 999,
            padding: '1px 5px',
            lineHeight: 1.2,
            pointerEvents: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      )}
    </div>
  )
}
