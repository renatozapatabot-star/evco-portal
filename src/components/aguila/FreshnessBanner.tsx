/**
 * FreshnessBanner — tenant-scoped sync-freshness signal.
 *
 * Spec: `.claude/rules/sync-contract.md`. Ursula must never read a
 * stale border-state number without being told it's stale.
 *
 * Three rendering modes:
 *   1. Fresh (≤90 min): inline microcopy under the page header,
 *      muted silver, JetBrains Mono, "Sincronizado hace 18 min".
 *   2. Stale (>90 min): calm amber banner (NOT red) with reassuring
 *      copy — "Revisando datos con el servidor de aduanas — puede
 *      tardar unos minutos." Client surfaces stay calm (invariant #24).
 *   3. No data: renders nothing. Pre-activation tenants shouldn't see
 *      a placeholder that would confuse the first-use moment.
 */

import type { FreshnessReading } from '@/lib/cockpit/freshness'
import { formatFreshness } from '@/lib/cockpit/freshness'

interface Props {
  reading: FreshnessReading
  /** Render mode — inline is for page headers, banner is full-width. */
  mode?: 'inline' | 'banner'
}

export function FreshnessBanner({ reading, mode = 'inline' }: Props) {
  if (!reading.hasData) return null
  const text = formatFreshness(reading)
  if (!text) return null

  // Stale → banner regardless of requested mode (the stale state is
  // load-bearing information; inline microcopy is easy to miss).
  if (reading.isStale) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          marginTop: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.28)',
          color: '#FBBF24',
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.01em',
          lineHeight: 1.45,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#FBBF24',
            flexShrink: 0,
            animation: 'aguila-dot-pulse 2s ease-in-out infinite',
          }}
        />
        <span>
          Revisando datos con el servidor de aduanas — puede tardar unos minutos.{' '}
          <span style={{ opacity: 0.72, fontFamily: 'var(--font-mono)' }}>{text}</span>
        </span>
      </div>
    )
  }

  // Fresh → compact inline microcopy. Renders under LiveTimestamp.
  if (mode === 'inline') {
    return (
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'rgba(192,197,206,0.55)',
          letterSpacing: '0.02em',
        }}
      >
        {text}
      </span>
    )
  }

  // Fresh + banner mode — reserved for future pages that want a full
  // row confirmation. Same copy, muted chrome.
  return (
    <div
      role="status"
      style={{
        marginTop: 12,
        padding: '8px 14px',
        borderRadius: 10,
        background: 'rgba(192,197,206,0.05)',
        border: '1px solid rgba(192,197,206,0.12)',
        color: 'rgba(192,197,206,0.72)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
      }}
    >
      {text}
    </div>
  )
}
