'use client'

const TOTAL_REQUIRED = 6

interface Props {
  present: number
  total?: number
}

export function DocCompleteness({ present, total = TOTAL_REQUIRED }: Props) {
  const pct = Math.round((present / total) * 100)
  const color = pct === 100
    ? 'var(--success-500)'
    : pct >= 50
      ? 'var(--warning-500)'
      : 'var(--danger-500)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 90 }}>
      <div style={{
        flex: 1, height: 6, background: 'var(--bg-elevated, #F5F4F0)',
        borderRadius: 99, overflow: 'hidden', minWidth: 40,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 99, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{
        fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, fontFamily: 'var(--font-mono)',
        color, minWidth: 28, textAlign: 'right',
      }}>
        {present}/{total}
      </span>
    </div>
  )
}
