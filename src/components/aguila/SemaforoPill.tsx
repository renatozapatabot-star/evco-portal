/**
 * SemaforoPill — the verde/amarillo/rojo customs light as a pill.
 *
 * Core customs domain detail: the traficos.semaforo column stores
 * 0 | 1 | 2 where 0=verde (sin revisión), 1=amarillo (revisión en puente),
 * 2=rojo (reconocimiento físico). Users should never see the raw integer.
 *
 * Colors resolve through --portal-semaforo-* vars in portal-tokens.css so
 * a palette change cascades to every list/detail page without hunting inline rgba.
 */

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
    return {
      label: 'Verde',
      color: 'var(--portal-semaforo-verde-fg)',
      bg: 'var(--portal-semaforo-verde-bg)',
    }
  }
  if (value === 1) {
    return {
      label: 'Amarillo',
      color: 'var(--portal-semaforo-amarillo-fg)',
      bg: 'var(--portal-semaforo-amarillo-bg)',
    }
  }
  if (value === 2) {
    return {
      label: 'Rojo',
      color: 'var(--portal-semaforo-rojo-fg)',
      bg: 'var(--portal-semaforo-rojo-bg)',
    }
  }
  return {
    label: 'Sin revisión',
    color: 'var(--portal-semaforo-none-fg)',
    bg: 'var(--portal-semaforo-none-bg)',
  }
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
