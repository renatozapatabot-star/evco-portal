'use client'

import Link from 'next/link'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_MUTED, AMBER, RED, GLOW_SILVER,
} from '@/lib/design-system'
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
  ariaLabel?: string
}

export function KPITile({
  label, value, series, previous, current, href, tone = 'silver',
  urgent = false, inverted = false, ariaLabel,
}: Props) {
  const numberColor = urgent ? RED : TEXT_PRIMARY
  const sparkSeries = series && series.length > 7 ? series.slice(-7) : series
  const numericValue = typeof value === 'number' ? value : current ?? 0
  const showDelta = previous !== undefined && (current !== undefined || typeof value === 'number')

  const card = (
    <div className="aguila-kpi-tile" style={{
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 20,
      padding: '18px',
      boxShadow: GLASS_SHADOW,
      minHeight: 140,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      color: TEXT_PRIMARY,
      transition: 'background 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      cursor: href ? 'pointer' : 'default',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: TEXT_MUTED,
        }}>
          {label}
        </span>
        {urgent && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: AMBER,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>URGENTE</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span
          className={urgent ? 'aguila-kpi-pulse' : ''}
          style={{
            fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: '-0.03em',
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

      <div style={{ marginTop: 'auto', minHeight: 28 }}>
        {sparkSeries && sparkSeries.length > 0 ? (
          <Sparkline data={sparkSeries} tone={urgent ? 'red' : tone} ariaLabel={ariaLabel || `${label} 7 días`} />
        ) : (
          <div style={{ height: 28 }} aria-hidden />
        )}
      </div>

      <style jsx>{`
        .aguila-kpi-tile:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(192,197,206,0.2);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 30px ${GLOW_SILVER};
        }
        @keyframes aguila-kpi-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.72; }
        }
        .aguila-kpi-pulse { animation: aguila-kpi-pulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aguila-kpi-pulse { animation: none; }
          .aguila-kpi-tile { transition: none; }
        }
        @media (max-width: 640px) {
          .aguila-kpi-tile :global(span) { font-size: inherit; }
        }
      `}</style>
    </div>
  )

  if (!href) return card
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }} aria-label={ariaLabel || label}>
      {card}
    </Link>
  )
}
