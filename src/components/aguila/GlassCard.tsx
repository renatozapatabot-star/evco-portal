'use client'

import type { CSSProperties, ReactNode } from 'react'
import { PortalCard, type PortalCardTier } from '@/components/portal/PortalCard'
import { SeverityRibbon, type SeverityTone } from './SeverityRibbon'

/**
 * Legacy tier names mapped to the PORTAL card tiers (Block DD Phase 3).
 *
 *   hero      → PortalCard tier="hero"       (emerald radial halo · load-bearing KPI chrome)
 *   secondary → PortalCard default           (ink-1 surface for section cards)
 *   tertiary  → PortalCard tier="raised"     (ink-2 for inline chips / drawer interiors)
 *   ghost     → PortalCard default           (kept for back-compat; same as secondary)
 *
 * External API is unchanged — every existing `<GlassCard tier=...>` caller
 * renders with the new chemistry automatically. Inline rgba/backdropFilter
 * retired; chemistry now lives entirely in `.portal-card` classes.
 */
export type GlassTier = 'hero' | 'secondary' | 'tertiary' | 'ghost'

export interface GlassCardProps {
  children: ReactNode
  href?: string
  size?: 'card' | 'compact'
  severity?: SeverityTone
  hover?: boolean
  padding?: number | string
  span?: 1 | 2
  tier?: GlassTier
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}

const TIER_MAP: Record<GlassTier, PortalCardTier> = {
  hero: 'hero',
  secondary: 'default',
  tertiary: 'raised',
  ghost: 'default',
}

export function GlassCard({
  children,
  href,
  size = 'card',
  severity,
  hover,
  padding,
  span,
  tier = 'hero',
  className,
  style,
  ariaLabel,
}: GlassCardProps) {
  const defaultPadding = size === 'compact' ? 14 : 20
  const pad = padding ?? (severity ? (size === 'compact' ? '14px 14px 14px 17px' : '20px 20px 20px 23px') : defaultPadding)
  const portalTier = href && hover !== false ? 'interactive' : TIER_MAP[tier]

  return (
    <PortalCard
      tier={portalTier}
      href={href}
      padding={pad}
      compact={size === 'compact'}
      span={span}
      className={className}
      style={style}
      ariaLabel={ariaLabel}
      overlay={severity ? <SeverityRibbon tone={severity} /> : undefined}
    >
      {children}
    </PortalCard>
  )
}
