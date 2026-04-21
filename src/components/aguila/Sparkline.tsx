'use client'

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
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
}

export function Sparkline({ data, tone = 'silver', height = 28, ariaLabel }: Props) {
  if (!data?.length) return <div style={{ height }} aria-hidden />
  const color = TONE_COLOR[tone]
  const rows = data.map((v, i) => ({ i, v: Number.isFinite(v) ? v : 0 }))
  const gradientId = `spark-${tone}`

  return (
    <div style={{ width: '100%', height }} role="img" aria-label={ariaLabel}>
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
