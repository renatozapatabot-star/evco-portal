'use client'

import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts'
import { ACCENT_SILVER, GREEN } from '@/lib/design-system'

export interface RevenueLinePoint {
  /** YYYY-MM */
  month: string
  /** Pedimento count for the month */
  count: number
  /** Estimated revenue in MXN */
  estimatedMXN: number
  /** Real billed revenue in MXN (may be null if no data) */
  realMXN: number | null
}

interface Props {
  data: RevenueLinePoint[]
  /** "count" plots pedimento count; "revenue" plots MXN revenue with a real-data overlay when present */
  metric: 'count' | 'revenue'
  height?: number
}

const MONTH_ABBR_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function fmtMonthShort(ym: string): string {
  const [, m] = ym.split('-').map(Number)
  return MONTH_ABBR_ES[(m - 1) % 12] ?? ym
}

function fmtTooltipValue(value: number, metric: 'count' | 'revenue'): string {
  if (!Number.isFinite(value)) return '—'
  if (metric === 'count') return Math.round(value).toLocaleString('es-MX')
  // MXN currency
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value)
}

export function RevenueLineChart({ data, metric, height = 220 }: Props) {
  if (!data?.length) return <div style={{ height, color: 'var(--portal-fg-3)' }}>Sin datos</div>

  const rows = data.map(d => ({
    month: d.month,
    monthLabel: fmtMonthShort(d.month),
    primary: metric === 'count' ? d.count : d.estimatedMXN,
    real: metric === 'revenue' ? d.realMXN : null,
  }))

  const tooltipBg = 'rgba(10, 10, 12, 0.92)'
  const tooltipBorder = 'rgba(192,197,206,0.18)'

  return (
    <div style={{ width: '100%', height }} role="img" aria-label={metric === 'count' ? 'Pedimentos por mes' : 'Ingresos estimados por mes'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(192,197,206,0.08)" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: 'var(--portal-fg-3)', fontSize: 11, fontFamily: 'var(--portal-font-mono)' }}
            axisLine={{ stroke: 'rgba(192,197,206,0.18)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--portal-fg-3)', fontSize: 11, fontFamily: 'var(--portal-font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={(v: number) => {
              if (metric === 'count') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
              if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
              return `$${v}`
            }}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 12,
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 12,
              color: 'var(--portal-fg-1)',
            }}
            labelStyle={{ color: 'var(--portal-fg-2)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            formatter={((value: unknown, name: unknown) => [
              fmtTooltipValue(Number(value), metric),
              name === 'primary' ? (metric === 'count' ? 'Pedimentos' : 'Estimado') : 'Real',
            ]) as never}
            labelFormatter={((label: unknown) => String(label ?? '')) as never}
          />
          <Line
            type="monotone"
            dataKey="primary"
            stroke={ACCENT_SILVER}
            strokeWidth={2}
            dot={{ r: 3, fill: ACCENT_SILVER, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: ACCENT_SILVER }}
            isAnimationActive={false}
          />
          {metric === 'revenue' && (
            <Line
              type="monotone"
              dataKey="real"
              stroke={GREEN}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: GREEN, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
