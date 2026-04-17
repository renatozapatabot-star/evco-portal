'use client'

import { PortalCard } from '@/components/portal/PortalCard'
import { Sparkline, type SparklineTone } from './Sparkline'
import { DeltaIndicator } from './DeltaIndicator'

interface Props {
  label: string
  value: number | string
  sublabel?: string
  series?: number[]
  previous?: number
  current?: number
  href?: string
  onClick?: () => void
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  tone?: SparklineTone
  urgent?: boolean
  inverted?: boolean
  compact?: boolean
  ariaLabel?: string
}

/**
 * Value-content detector: true when the value reads best in Geist Mono
 * (numeric / currency / percentage / dash-only). False for prose
 * ("hace 36 días", "Sin cruces aún", status labels).
 */
export function isNumericValue(value: number | string): boolean {
  if (typeof value === 'number') return true
  const s = String(value).trim()
  if (s.length === 0) return true
  return /^[\d.,$\s€£¥%—\-+:]+$/.test(s)
}

/**
 * KPI tile — composes `<PortalCard tier="hero">` with an emerald radial
 * halo (live/healthy signal) + label + big display number + optional
 * delta indicator + optional sparkline. The core numeric-vs-prose
 * font logic is preserved from v6 — relative-time phrases render in
 * Geist sans to avoid line-wrap at display size, real numbers render
 * in Geist Mono tabular-nums.
 */
export function KPITile({
  label, value, sublabel, series, previous, current, href, onClick, buttonRef, tone = 'silver',
  urgent = false, inverted = false, compact = false, ariaLabel,
}: Props) {
  const sparkSeries = series && series.length > 7 ? series.slice(-7) : series
  const numericValue = typeof value === 'number' ? value : current ?? 0
  const showDelta = previous !== undefined && (current !== undefined || typeof value === 'number')
  const sparkHeight = compact ? 20 : 28
  const numberSize = compact
    ? 'var(--aguila-fs-kpi-compact, 32px)'
    : 'var(--aguila-fs-kpi-hero, 48px)'
  const minHeight = compact ? 108 : 140
  const valueIsNumeric = isNumericValue(value)
  const valueFontFamily = valueIsNumeric
    ? 'var(--portal-font-mono)'
    : 'var(--portal-font-sans)'
  const numberColor = urgent ? 'var(--portal-red)' : 'var(--portal-fg-1)'

  const card = (
    <PortalCard
      tier="hero"
      href={onClick ? undefined : href}
      ariaLabel={ariaLabel || label}
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--portal-s-3)',
      }}
      compact={compact}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span
          className="portal-metric__label"
          style={{
            fontSize: 'var(--portal-fs-micro)',
            letterSpacing: '0.22em',
          }}
        >
          {label}
        </span>
        {urgent && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: 'var(--portal-amber)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: 'var(--portal-font-mono)',
            }}
          >URGENTE</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span
          data-value-font={valueIsNumeric ? 'mono' : 'sans'}
          className={urgent ? 'portal-pulse' : undefined}
          style={{
            fontFamily: valueFontFamily,
            fontSize: valueIsNumeric
              ? `calc(${numberSize} * 0.92)`
              : `calc(${numberSize} * 0.62)`,
            fontWeight: valueIsNumeric ? 600 : 500,
            lineHeight: 1.05,
            letterSpacing: valueIsNumeric ? '-0.03em' : '-0.01em',
            color: numberColor,
            fontVariantNumeric: valueIsNumeric ? 'tabular-nums lining-nums' : 'normal',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minHeight: `calc(${numberSize} * 1)`,
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: '100%',
          }}
        >
          {value}
        </span>
        {showDelta && previous !== undefined && (
          <DeltaIndicator current={current ?? numericValue} previous={previous} inverted={inverted} />
        )}
      </div>

      {sublabel && (
        <div
          className="portal-meta"
          style={{
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={sublabel}
        >
          {sublabel}
        </div>
      )}

      <div style={{ marginTop: 'auto', minHeight: sparkHeight }}>
        {sparkSeries && sparkSeries.length > 0 ? (
          <Sparkline data={sparkSeries} tone={urgent ? 'red' : tone} height={sparkHeight} ariaLabel={ariaLabel || `${label} 7 días`} />
        ) : (
          <div style={{ height: sparkHeight }} aria-hidden />
        )}
      </div>
    </PortalCard>
  )

  if (onClick) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        style={{
          display: 'block',
          width: '100%',
          minHeight: 60,
          padding: 0,
          margin: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        {card}
      </button>
    )
  }

  return card
}
