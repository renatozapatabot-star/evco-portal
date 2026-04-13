'use client'

import {
  TEXT_PRIMARY, TEXT_MUTED, AMBER, RED,
} from '@/lib/design-system'
import { GlassCard } from './GlassCard'
import { Sparkline, type SparklineTone } from './Sparkline'
import { DeltaIndicator } from './DeltaIndicator'

interface Props {
  label: string
  value: number | string
  series?: number[]
  previous?: number
  current?: number
  href?: string
  tone?: SparklineTone
  urgent?: boolean
  inverted?: boolean
  compact?: boolean
  ariaLabel?: string
}

export function KPITile({
  label, value, series, previous, current, href, tone = 'silver',
  urgent = false, inverted = false, compact = false, ariaLabel,
}: Props) {
  const numberColor = urgent ? RED : TEXT_PRIMARY
  const sparkSeries = series && series.length > 7 ? series.slice(-7) : series
  const numericValue = typeof value === 'number' ? value : current ?? 0
  const showDelta = previous !== undefined && (current !== undefined || typeof value === 'number')
  const sparkHeight = compact ? 20 : 28
  const numberSize = compact
    ? 'var(--aguila-fs-kpi-compact, 32px)'
    : 'var(--aguila-fs-kpi-hero, 48px)'
  const minHeight = compact ? 108 : 140

  return (
    <GlassCard
      href={href}
      size={compact ? 'compact' : 'card'}
      ariaLabel={ariaLabel || label}
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--aguila-gap-stack, 12px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          color: TEXT_MUTED,
        }}>
          {label}
        </span>
        {urgent && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: AMBER,
            textTransform: 'uppercase', letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          }}>URGENTE</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span
          className={urgent ? 'aguila-pulse' : ''}
          style={{
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
            fontSize: `calc(${numberSize} * 0.92)`,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
            color: numberColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {showDelta && previous !== undefined && (
          <DeltaIndicator current={current ?? numericValue} previous={previous} inverted={inverted} />
        )}
      </div>

      <div style={{ marginTop: 'auto', minHeight: sparkHeight }}>
        {sparkSeries && sparkSeries.length > 0 ? (
          <Sparkline data={sparkSeries} tone={urgent ? 'red' : tone} height={sparkHeight} ariaLabel={ariaLabel || `${label} 7 días`} />
        ) : (
          <div style={{ height: sparkHeight }} aria-hidden />
        )}
      </div>
    </GlassCard>
  )
}
