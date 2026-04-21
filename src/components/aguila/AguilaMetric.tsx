'use client'

import type { ReactNode } from 'react'
import { GlassCard } from './GlassCard'

export type AguilaMetricTone = 'neutral' | 'positive' | 'negative' | 'attention'

export interface AguilaMetricProps {
  /** Big number (pre-formatted string — caller handles locale). */
  value: string
  /** Above the value: small uppercase label. */
  label: string
  /** Below the value: one-line supporting context. */
  sub?: ReactNode
  /** Tonal color — drives number hue + card border accent. */
  tone?: AguilaMetricTone
  /** Optional suffix/prefix unit (€, %, min). Rendered at 60% of value size. */
  unit?: string
  /** Optional icon element (lucide icon, etc) rendered next to the label. */
  icon?: ReactNode
  /** Make value mono (default true — it's data). */
  mono?: boolean
  /** Card padding override. */
  padding?: number | string
  /** Optional href turns the whole tile into a link. */
  href?: string
}

const TONE_COLOR: Record<AguilaMetricTone, string> = {
  neutral: 'var(--portal-fg-1)',
  positive: 'var(--portal-status-green-fg)',
  negative: 'var(--portal-status-red-fg)',
  attention: 'var(--portal-status-amber-fg)',
}

/**
 * AguilaMetric — the reusable KPI + metric tile for pitch decks,
 * case studies, public landing pages, and internal cockpits.
 *
 * Composes <GlassCard> for chrome. Value + unit render in the same row
 * with unit at 60% of the value's size (so "22 min" reads as "22" big
 * with "min" small, without the caller having to split the string).
 *
 * Keep this primitive presentational — no data fetching, no side effects.
 * A wrapper that fetches + animates a counter can compose on top.
 */
export function AguilaMetric({
  value,
  label,
  sub,
  tone = 'neutral',
  unit,
  icon,
  mono = true,
  padding = 20,
  href,
}: AguilaMetricProps) {
  const numberColor = TONE_COLOR[tone]

  return (
    <GlassCard tier="hero" padding={padding} href={href}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {icon ? (
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--portal-fg-4)',
            }}
          >
            {icon}
          </span>
        ) : null}
        <span
          className="portal-label"
          style={{
            fontSize: 'var(--portal-fs-label, 10px)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          lineHeight: 1,
        }}
      >
        <span
          className={mono ? 'portal-num' : undefined}
          style={{
            fontSize: 'var(--portal-fs-3xl, 44px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: numberColor,
          }}
        >
          {value}
        </span>
        {unit ? (
          <span
            className={mono ? 'portal-num' : undefined}
            style={{
              fontSize: '60%',
              fontWeight: 600,
              color: 'var(--portal-fg-3)',
              letterSpacing: '0.02em',
            }}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-4)',
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      ) : null}
    </GlassCard>
  )
}
