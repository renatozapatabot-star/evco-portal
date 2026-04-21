/**
 * AguilaStreakBar — a horizontal row of colored dots showing the
 * semáforo result of the last N crossings for a SKU or proveedor.
 *
 * Newest-left-to-oldest-right. Powered a glance-scannable "verde streak"
 * visualization that complements the textual "Cruzó verde 4 de 4"
 * summary shipped in M7/M8.
 *
 * V1 token-pure. No hex, no inline glass chemistry. Respects
 * prefers-reduced-motion (no dot pulse when reduced).
 *
 * Example:
 *
 *   <AguilaStreakBar values={[0, 0, 0, 0, 1, 0]} />
 *
 * Renders: 🟢 🟢 🟢 🟢 🟡 🟢 (newest first)
 */

import type { SemaforoValue } from '@/components/aguila/SemaforoPill'

interface Props {
  /** Array of semáforo values — newest first. 0 verde · 1 amarillo · 2 rojo · null unknown. */
  values: SemaforoValue[]
  /** Cap the row at this many dots (older ones are dropped). Default 10. */
  max?: number
  /** Bigger dots for a spotlight surface (hero insight card). Default 8. */
  dotSize?: number
  /** Optional aria-label describing the streak. */
  label?: string
}

function colorFor(v: SemaforoValue): string {
  if (v === 0) return 'var(--portal-status-green-fg)'
  if (v === 1) return 'var(--portal-status-amber-fg)'
  if (v === 2) return 'var(--portal-status-red-fg)'
  return 'var(--portal-fg-5)' // unknown
}

export function AguilaStreakBar({ values, max = 10, dotSize = 8, label }: Props) {
  const capped = values.slice(0, max)
  return (
    <div
      role="img"
      aria-label={label ?? `Últimos ${capped.length} cruces`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {capped.map((v, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: colorFor(v),
            flexShrink: 0,
            // Slightly dim older dots so the eye lands on the newest run.
            opacity: 1 - i * 0.06,
          }}
        />
      ))}
      {capped.length === 0 && (
        <span
          style={{
            fontSize: 'var(--portal-fs-tiny)',
            color: 'var(--portal-fg-5)',
            fontFamily: 'var(--portal-font-mono)',
            letterSpacing: '0.08em',
          }}
        >
          sin cruces
        </span>
      )}
    </div>
  )
}
