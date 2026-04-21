'use client'

/**
 * AguilaInsightCard — one signal from the intelligence layer,
 * rendered with calm-tone defaults.
 *
 * Three tones:
 *   - 'opportunity' → green-ring (good news, worth celebrating)
 *   - 'watch'       → amber-ring (worth attention, not urgent)
 *   - 'anomaly'     → red-ring (investigate, rule-based)
 *
 * Calm-tone rules:
 *   - The ring color signals; the background stays glass neutral
 *   - No pulsing, no emoji-bomb. Subtle and operator-trustworthy
 *   - Primary action is optional — an insight without action is still
 *     valuable ("noticing"). The action surfaces when it makes sense.
 *
 * V1 token-pure. No hex.
 */

import Link from 'next/link'
import { GlassCard } from './GlassCard'

export type InsightTone = 'opportunity' | 'watch' | 'anomaly'

export interface InsightAction {
  label: string
  href: string
}

interface Props {
  tone: InsightTone
  eyebrow?: string
  headline: string
  body?: React.ReactNode
  action?: InsightAction
  /** Optional content to render below the body (e.g. an AguilaStreakBar). */
  visual?: React.ReactNode
  /** Monospace metadata (e.g., "Último cruce · hace 3 días"). Right-aligned. */
  meta?: string
}

function ringColor(tone: InsightTone): string {
  if (tone === 'opportunity') return 'var(--portal-status-green-ring)'
  if (tone === 'watch') return 'var(--portal-status-amber-ring)'
  return 'var(--portal-status-red-ring)'
}

function eyebrowColor(tone: InsightTone): string {
  if (tone === 'opportunity') return 'var(--portal-status-green-fg)'
  if (tone === 'watch') return 'var(--portal-status-amber-fg)'
  return 'var(--portal-status-red-fg)'
}

export function AguilaInsightCard({
  tone,
  eyebrow,
  headline,
  body,
  action,
  visual,
  meta,
}: Props) {
  return (
    <GlassCard tier="hero" padding={18} style={{ borderColor: ringColor(tone) }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 6,
        }}
      >
        {eyebrow && (
          <span
            className="portal-eyebrow"
            style={{
              fontSize: 'var(--portal-fs-tiny)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: eyebrowColor(tone),
              fontFamily: 'var(--portal-font-mono)',
            }}
          >
            {eyebrow}
          </span>
        )}
        {meta && (
          <span
            style={{
              fontSize: 'var(--portal-fs-tiny)',
              color: 'var(--portal-fg-5)',
              fontFamily: 'var(--portal-font-mono)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {meta}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 'var(--portal-fs-md)',
          fontWeight: 600,
          color: 'var(--portal-fg-1)',
          lineHeight: 1.35,
          marginBottom: body || visual ? 6 : 10,
        }}
      >
        {headline}
      </div>

      {body && (
        <div
          style={{
            fontSize: 'var(--portal-fs-sm)',
            color: 'var(--portal-fg-3)',
            lineHeight: 1.5,
            marginBottom: visual ? 10 : action ? 12 : 0,
          }}
        >
          {body}
        </div>
      )}

      {visual && <div style={{ marginBottom: action ? 12 : 0 }}>{visual}</div>}

      {action && (
        <Link
          href={action.href}
          className="portal-btn portal-btn--ghost"
          style={{
            minHeight: 36,
            padding: '0 14px',
            fontSize: 'var(--portal-fs-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          {action.label} →
        </Link>
      )}
    </GlassCard>
  )
}
