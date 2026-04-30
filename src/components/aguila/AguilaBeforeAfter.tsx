'use client'

import { GlassCard } from './GlassCard'

export interface AguilaBeforeAfterProps {
  /** Before-state value (e.g. "22 min"). */
  before: string
  /** Before-state caption (e.g. "Proceso manual"). */
  beforeLabel: string
  /** After-state value (e.g. "2 min"). */
  after: string
  /** After-state caption (e.g. "Con PORTAL"). */
  afterLabel: string
  /** Optional title rendered above the strip. */
  title?: string
  /** Gap between tiles. Defaults to 12px. */
  gap?: number
}

/**
 * AguilaBeforeAfter — the "manual vs. PORTAL" delta tile strip.
 *
 * Used on /demo, /pitch, sales landing pages. Before tile renders in
 * status-red chrome (the customer's current pain), after tile in
 * status-green (PORTAL's outcome). Numbers in big mono.
 *
 * Keep it a pure presentational primitive so the same strip composes
 * on the web, exports cleanly to screenshots, and lives inside slide
 * decks without extra wrapping. No inline hex — borders and
 * backgrounds are token-routed.
 */
export function AguilaBeforeAfter({
  before,
  beforeLabel,
  after,
  afterLabel,
  title,
  gap = 12,
}: AguilaBeforeAfterProps) {
  return (
    <div>
      {title ? (
        <div
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-tiny)',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap }}>
        <GlassCard
          tier="secondary"
          padding="16px 12px"
          style={{
            flex: 1,
            textAlign: 'center',
            borderColor: 'var(--portal-status-red-ring)',
            background: 'var(--portal-status-red-bg)',
          }}
        >
          <div
            className="portal-num"
            style={{
              fontSize: 'var(--portal-fs-2xl, 28px)',
              fontWeight: 800,
              color: 'var(--portal-status-red-fg)',
              letterSpacing: '-0.02em',
            }}
          >
            {before}
          </div>
          <div
            style={{
              fontSize: 'var(--portal-fs-tiny)',
              color: 'var(--portal-fg-4)',
              marginTop: 4,
            }}
          >
            {beforeLabel}
          </div>
        </GlassCard>
        <GlassCard
          tier="secondary"
          padding="16px 12px"
          style={{
            flex: 1,
            textAlign: 'center',
            borderColor: 'var(--portal-status-green-ring)',
            background: 'var(--portal-status-green-bg)',
          }}
        >
          <div
            className="portal-num"
            style={{
              fontSize: 'var(--portal-fs-2xl, 28px)',
              fontWeight: 800,
              color: 'var(--portal-status-green-fg)',
              letterSpacing: '-0.02em',
            }}
          >
            {after}
          </div>
          <div
            style={{
              fontSize: 'var(--portal-fs-tiny)',
              color: 'var(--portal-fg-4)',
              marginTop: 4,
            }}
          >
            {afterLabel}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
