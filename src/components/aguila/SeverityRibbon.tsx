'use client'

import { GREEN, AMBER, RED } from '@/lib/design-system'

export type SeverityTone = 'healthy' | 'warning' | 'critical'

const TONE_COLOR: Record<SeverityTone, string> = {
  healthy: GREEN,
  warning: AMBER,
  critical: RED,
}

/**
 * 3px left-edge ribbon rendered as an absolutely-positioned child.
 * Parent must be `position: relative` and `overflow: hidden`.
 * Not a card border — glass borders stay neutral per core-invariants rule 2.
 */
export function SeverityRibbon({ tone, glow = true }: { tone: SeverityTone; glow?: boolean }) {
  const color = TONE_COLOR[tone]
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: color,
        boxShadow: glow ? `0 0 12px ${color}66` : 'none',
        pointerEvents: 'none',
      }}
    />
  )
}

export function severityFromCount(count: number, thresholds: { warn: number; crit: number } = { warn: 1, crit: 6 }): SeverityTone {
  if (count >= thresholds.crit) return 'critical'
  if (count >= thresholds.warn) return 'warning'
  return 'healthy'
}
