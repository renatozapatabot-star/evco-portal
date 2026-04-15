/**
 * SemaforoPill — the verde/amarillo/rojo customs light as a pill.
 *
 * Core customs domain detail: the traficos.semaforo column stores
 * 0 | 1 | 2 where 0=verde (sin revisión), 1=amarillo (revisión en puente),
 * 2=rojo (reconocimiento físico). Users should never see the raw integer.
 *
 * Pill design mirrors login's restraint:
 *   · green for verde (calm, healthy)
 *   · amber for amarillo (attention, not emergency)
 *   · red for rojo (real event)
 *   · muted for unknown/null
 */

import { AMBER, GREEN, RED, TEXT_MUTED } from '@/lib/design-system'

export type SemaforoValue = 0 | 1 | 2 | null | undefined

interface Props {
  /** Raw semáforo value from traficos.semaforo — 0, 1, 2, or null. */
  value: SemaforoValue
  /** Compact variant for table rows. */
  size?: 'default' | 'compact'
  /** Include text label. Default true. */
  showLabel?: boolean
}

function mapValue(value: SemaforoValue): { label: string; color: string; bg: string } {
  if (value === 0) {
    return { label: 'Verde', color: GREEN, bg: 'rgba(34,197,94,0.14)' }
  }
  if (value === 1) {
    return { label: 'Amarillo', color: AMBER, bg: 'rgba(251,191,36,0.14)' }
  }
  if (value === 2) {
    return { label: 'Rojo', color: RED, bg: 'rgba(239,68,68,0.14)' }
  }
  return { label: 'Sin revisión', color: TEXT_MUTED, bg: 'rgba(148,163,184,0.1)' }
}

export function SemaforoPill({ value, size = 'default', showLabel = true }: Props) {
  const { label, color, bg } = mapValue(value)
  const padding = size === 'compact' ? '2px 8px' : '4px 12px'
  const fontSize = size === 'compact' ? 11 : 12

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        borderRadius: 999,
        background: bg,
        color,
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={`Semáforo: ${label}`}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 0 2px ${bg}`,
        }}
      />
      {showLabel && label}
    </span>
  )
}
