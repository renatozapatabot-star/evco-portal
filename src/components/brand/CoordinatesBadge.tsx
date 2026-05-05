/**
 * CoordinatesBadge — Laredo, TX geolocation mark in silver mono.
 * Sits alongside <AguilaMark /> + <AguilaWordmark /> on the pedimento header.
 * Two tones: `silver` (ACCENT_SILVER) or `silver-dim` (ACCENT_SILVER_DIM).
 */

import type { CSSProperties } from 'react'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'

export type CoordinatesBadgeTone = 'silver' | 'silver-dim'

export interface CoordinatesBadgeProps {
  tone?: CoordinatesBadgeTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function CoordinatesBadge({
  tone = 'silver',
  className,
  style,
  'aria-label': ariaLabel = 'Laredo, Texas — 27.5036°N 99.5076°W',
}: CoordinatesBadgeProps) {
  const color = tone === 'silver' ? ACCENT_SILVER : ACCENT_SILVER_DIM

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--aguila-fs-label)',
        letterSpacing: '0.06em',
        lineHeight: 1.1,
        color,
        ...style,
      }}
    >
      <span>27.5036° N</span>
      <span>99.5076° W</span>
    </div>
  )
}

export default CoordinatesBadge
