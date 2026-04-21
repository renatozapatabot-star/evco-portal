import type { ReactNode } from 'react'

export type PortalMetricTone = 'neutral' | 'live' | 'warn' | 'alert'

export interface PortalMetricProps {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  /** `display` uses Instrument Serif / Geist display weight. Default uses Geist sans semibold. */
  display?: boolean
  tone?: PortalMetricTone
  className?: string
  ariaLabel?: string
}

/**
 * Hero metric primitive — label on top, big number, optional sub-line.
 * Composes `.portal-metric` from portal-components.css. Value is tabular-nums.
 */
export function PortalMetric({
  label,
  value,
  sub,
  display = false,
  tone = 'neutral',
  className,
  ariaLabel,
}: PortalMetricProps) {
  const valueCls = [
    'portal-metric__value',
    display ? 'portal-metric__value--display' : '',
  ].filter(Boolean).join(' ')

  const toneColor =
    tone === 'live'  ? 'var(--portal-green-1)' :
    tone === 'warn'  ? 'var(--portal-amber)'   :
    tone === 'alert' ? 'var(--portal-red)'     :
    undefined

  return (
    <div className={['portal-metric', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <span className="portal-metric__label">{label}</span>
      <span
        className={valueCls}
        style={toneColor ? { color: toneColor } : undefined}
      >
        {value}
      </span>
      {sub != null && <span className="portal-metric__sub">{sub}</span>}
    </div>
  )
}
