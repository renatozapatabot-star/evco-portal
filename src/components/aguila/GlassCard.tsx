'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import {
  BG_ELEVATED, BORDER_HAIRLINE, BORDER_SILVER, BORDER_SILVER_HOVER,
  GLASS_BLUR, GLASS_HERO, GLASS_SECONDARY, GLASS_TERTIARY,
  GLASS_SHADOW, SHADOW_HERO, SHADOW_HERO_HOVER, GLOW_SILVER,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { SeverityRibbon, type SeverityTone } from './SeverityRibbon'

/**
 * Glass tier — controls card chemistry depth.
 *   · hero       — login-parity: rgba(0,0,0,0.4) + silver border + halo shadow
 *   · secondary  — rgba(0,0,0,0.25) — for section cards + info panels
 *   · tertiary   — rgba(0,0,0,0.12) — for inline chips + drawer interiors
 *   · ghost      — legacy rgba(255,255,255,0.04) — kept for back-compat only
 *
 * Default is `hero` on v1 (April 2026 rebrand). Existing callers without a
 * `tier` prop land on hero and immediately inherit the login's weight.
 */
export type GlassTier = 'hero' | 'secondary' | 'tertiary' | 'ghost'

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
  /** V1 glass tier — see GlassTier. Default 'hero'. */
  tier?: GlassTier
  /** Passthrough class for stagger/pulse utility classes. */
  className?: string
  /** Passthrough style — use sparingly. Card chrome comes from the primitive. */
  style?: CSSProperties
  ariaLabel?: string
}

const TIER_BG: Record<GlassTier, string> = {
  hero: GLASS_HERO,
  secondary: GLASS_SECONDARY,
  tertiary: GLASS_TERTIARY,
  ghost: BG_ELEVATED,
}
const TIER_BORDER: Record<GlassTier, string> = {
  hero: BORDER_SILVER,
  secondary: BORDER_SILVER,
  tertiary: BORDER_HAIRLINE,
  ghost: BORDER_HAIRLINE,
}
const TIER_SHADOW: Record<GlassTier, string> = {
  hero: SHADOW_HERO,
  secondary: SHADOW_HERO,
  tertiary: GLASS_SHADOW,
  ghost: GLASS_SHADOW,
}

/**
 * The ONE glass card chrome. Every authenticated surface composes from this.
 * Inline glass definitions outside src/components/aguila/ violate core-invariants rule 26.
 */
export function GlassCard({
  children, href, size = 'card', severity, hover, padding, span,
  tier = 'hero',
  className, style, ariaLabel,
}: GlassCardProps) {
  const enableHover = hover ?? Boolean(href)
  const radiusVar = size === 'compact' ? 'var(--aguila-radius-compact)' : 'var(--aguila-radius-card)'
  const defaultPadding = size === 'compact' ? '14px' : '20px'
  const pad = padding ?? (severity ? (size === 'compact' ? '14px 14px 14px 17px' : '20px 20px 20px 23px') : defaultPadding)

  const body = (
    <div
      className={[enableHover ? 'aguila-glass-card aguila-glass-card--hover' : 'aguila-glass-card', `aguila-glass-card--${tier}`, className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: TIER_BG[tier],
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${TIER_BORDER[tier]}`,
        borderRadius: radiusVar,
        padding: pad,
        boxShadow: TIER_SHADOW[tier],
        color: TEXT_PRIMARY,
        gridColumn: span === 2 ? 'span 2' : undefined,
        transition: enableHover ? 'background 160ms ease, box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease' : undefined,
        cursor: href ? 'pointer' : 'default',
        ...style,
      }}
    >
      {severity ? <SeverityRibbon tone={severity} /> : null}
      {children}
      <style jsx>{`
        .aguila-glass-card--hover:hover {
          border-color: ${BORDER_SILVER_HOVER};
          box-shadow: ${SHADOW_HERO_HOVER};
          transform: translateY(-1px);
        }
        .aguila-glass-card--ghost.aguila-glass-card--hover:hover {
          background: rgba(255,255,255,0.06);
          box-shadow:
            0 12px 40px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 0 30px ${GLOW_SILVER};
        }
        @media (prefers-reduced-motion: reduce) {
          .aguila-glass-card { transition: none; }
          .aguila-glass-card--hover:hover { transform: none; }
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
