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
  /** Small secondary line rendered under `value`. Muted, mono,
   *  single-line with ellipsis. Use for companion context that
   *  shouldn't compete with the headline (e.g. absolute date under
   *  a relative "hace N días"). */
  sublabel?: string
  series?: number[]
  previous?: number
  current?: number
  href?: string
  /** Click handler — renders tile as a button instead of a link. Takes precedence
   *  over `href` if both are provided. Use for tiles that open modals or dispatch
   *  client-side actions (e.g. the "Próximo cruce" timeline modal). */
  onClick?: () => void
  /** Forwarded to the button so the opener can restore focus after close. */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  tone?: SparklineTone
  urgent?: boolean
  inverted?: boolean
  compact?: boolean
  ariaLabel?: string
}

export function KPITile({
  label, value, sublabel, series, previous, current, href, onClick, buttonRef, tone = 'silver',
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

  // onClick takes precedence — when set, render the tile as a button (no href
  // to GlassCard so it stays a plain div). Preserves the 60px+ tap target by
  // stretching the button to fill the tile and sharing the glass chrome.
  const card = (
    <GlassCard
      href={onClick ? undefined : href}
      hover={onClick ? true : undefined}
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

      {sublabel && (
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'rgba(148,163,184,0.7)',
            lineHeight: 1.2,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontVariantNumeric: 'tabular-nums',
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
    </GlassCard>
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
        className="aguila-kpi-tap"
      >
        {card}
        <style jsx>{`
          .aguila-kpi-tap:focus-visible {
            outline: 2px solid rgba(201,168,76,0.6);
            outline-offset: 2px;
            border-radius: var(--aguila-radius-card);
          }
          @media (hover: none) {
            .aguila-kpi-tap:active { transform: scale(0.97); transition: transform 80ms ease; }
          }
        `}</style>
      </button>
    )
  }

  return card
}
