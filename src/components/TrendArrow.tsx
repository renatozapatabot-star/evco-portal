export function TrendArrow({
  current, previous, goodDirection = 'up', label = 'vs ant.',
}: { current: number; previous: number; goodDirection?: 'up' | 'down'; label?: string }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>&#8594; sin cambio</span>
  const isUp = pct > 0
  const isGood = (isUp && goodDirection === 'up') || (!isUp && goodDirection === 'down')
  return (
    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isGood ? 'var(--status-green)' : 'var(--status-red)', marginLeft: 6 }}>
      {isUp ? '\u2191' : '\u2193'} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  )
}
