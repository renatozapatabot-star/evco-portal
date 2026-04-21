import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

export type PortalCardTier = 'default' | 'raised' | 'interactive' | 'hero'

export interface PortalCardProps {
  children: ReactNode
  tier?: PortalCardTier
  /** Active indicator rail (2px emerald on left edge). */
  active?: boolean
  /** Drill-down target — wraps in <Link>. */
  href?: string
  /** Forwarded padding. Defaults to 20px (card) / 14px (compact). */
  padding?: number | string
  compact?: boolean
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  /** Grid column span. */
  span?: 1 | 2
  /** Optional rendered inside a `position:relative` wrapper — kept so inline overlays (SeverityRibbon, hero gradient) compose without knowing the parent. */
  overlay?: ReactNode
}

const TIER_CLASS: Record<PortalCardTier, string> = {
  default: '',
  raised: 'portal-card--raised',
  interactive: 'portal-card--interactive',
  hero: 'portal-card--hero',
}

export function PortalCard({
  children,
  tier = 'default',
  active = false,
  href,
  padding,
  compact = false,
  className,
  style,
  ariaLabel,
  span,
  overlay,
}: PortalCardProps) {
  const effectiveTier: PortalCardTier = href && tier === 'default' ? 'interactive' : tier
  const defaultPad = compact ? 14 : 20
  const pad = padding ?? defaultPad

  const cls = [
    'portal-card',
    TIER_CLASS[effectiveTier],
    active ? 'portal-card--active' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  const body = (
    <div
      className={cls}
      style={{
        padding: typeof pad === 'number' ? `${pad}px` : pad,
        gridColumn: span === 2 ? 'span 2' : undefined,
        ...style,
      }}
      aria-label={ariaLabel}
    >
      <span className="portal-card__rail" aria-hidden />
      {overlay}
      {children}
    </div>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        gridColumn: span === 2 ? 'span 2' : undefined,
      }}
    >
      {body}
    </Link>
  )
}
