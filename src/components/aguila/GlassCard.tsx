'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import {
  BG_ELEVATED, BORDER_HAIRLINE, GLASS_BLUR, GLASS_SHADOW, GLOW_SILVER,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { SeverityRibbon, type SeverityTone } from './SeverityRibbon'

export interface GlassCardProps {
  children: ReactNode
  /** Optional drill-down target. When present, card is focusable + cursor pointer. */
  href?: string
  /** 'card' = 20px radius / 20px padding. 'compact' = 16px radius / 14px padding. */
  size?: 'card' | 'compact'
  /** Adds a positioned SeverityRibbon (amber/red/green). */
  severity?: SeverityTone
  /** Enables hover glow. Defaults true when href is set. */
  hover?: boolean
  /** Override padding for special layouts. */
  padding?: number | string
  /** Grid span. */
  span?: 1 | 2
  /** Passthrough class for stagger/pulse utility classes. */
  className?: string
  /** Passthrough style — use sparingly. Card chrome comes from the primitive. */
  style?: CSSProperties
  ariaLabel?: string
}

/**
 * The ONE glass card chrome. Every authenticated surface composes from this.
 * Inline glass definitions outside src/components/aguila/ violate core-invariants rule 26.
 */
export function GlassCard({
  children, href, size = 'card', severity, hover, padding, span,
  className, style, ariaLabel,
}: GlassCardProps) {
  const enableHover = hover ?? Boolean(href)
  const radiusVar = size === 'compact' ? 'var(--aguila-radius-compact)' : 'var(--aguila-radius-card)'
  const defaultPadding = size === 'compact' ? '14px' : '20px'
  const pad = padding ?? (severity ? (size === 'compact' ? '14px 14px 14px 17px' : '20px 20px 20px 23px') : defaultPadding)

  const body = (
    <div
      className={[enableHover ? 'aguila-glass-card aguila-glass-card--hover' : 'aguila-glass-card', className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: BG_ELEVATED,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER_HAIRLINE}`,
        borderRadius: radiusVar,
        padding: pad,
        boxShadow: GLASS_SHADOW,
        color: TEXT_PRIMARY,
        gridColumn: span === 2 ? 'span 2' : undefined,
        transition: enableHover ? 'background 160ms ease, box-shadow 160ms ease, border-color 160ms ease' : undefined,
        cursor: href ? 'pointer' : 'default',
        ...style,
      }}
    >
      {severity ? <SeverityRibbon tone={severity} /> : null}
      {children}
      <style jsx>{`
        .aguila-glass-card--hover:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(192,197,206,0.2);
          box-shadow:
            0 12px 40px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 0 30px ${GLOW_SILVER};
        }
        @media (prefers-reduced-motion: reduce) {
          .aguila-glass-card { transition: none; }
        }
      `}</style>
    </div>
  )

  if (!href) return body
  return (
    <Link href={href} aria-label={ariaLabel} style={{ textDecoration: 'none', color: 'inherit', display: 'block', gridColumn: span === 2 ? 'span 2' : undefined }}>
      {body}
    </Link>
  )
}
