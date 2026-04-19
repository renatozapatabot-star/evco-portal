'use client'

interface TrendProps {
  delta: number // percentage change: -15, 0, +23
  label?: string // "vs mes anterior"
  size?: 'sm' | 'md'
}

export function Trend({ delta, label, size = 'sm' }: TrendProps) {
  if (delta === 0 || !isFinite(delta)) {
    return (
      <span style={{ color: '#6E7681', fontSize: size === 'sm' ? 11 : 13, fontWeight: 600 }}>
        → {label || 'sin cambio'}
      </span>
    )
  }

  const arrow = delta > 0 ? '↑' : '↓'
  const color = delta > 0 ? 'var(--portal-status-green-fg)' : 'var(--portal-status-red-fg)'

  return (
    <span className="font-mono" style={{
      color,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
    }}>
      {arrow}{Math.abs(Math.round(delta))}%
      {label && <span style={{ color: '#6E7681', fontWeight: 400, marginLeft: 4, fontFamily: 'var(--font-geist-sans)' }}>{label}</span>}
    </span>
  )
}

/** Compute percentage delta between two values. Returns 0 if base is 0. */
export function computeDelta(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}
