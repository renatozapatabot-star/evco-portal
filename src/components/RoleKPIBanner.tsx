'use client'

interface Props {
  role: string
  name: string
  thisWeek: number
  lastWeek: number
  metricLabel: string
  celebrationTemplate: (args: { name: string; thisWeek: number; lastWeek: number; delta: number; pct: number }) => string
  /**
   * 'increase' — celebrate when thisWeek > lastWeek (default, backward compat).
   *              Example: more documents classified, more traficos cleared.
   * 'decrease' — celebrate when lastWeek > thisWeek && thisWeek >= 0.
   *              Example: overdue count dropped, morosos resueltos.
   */
  metricDirection?: 'increase' | 'decrease'
}

/**
 * Positive-KPI banner — appears only when the metric moved the right way
 * for this role's job. Glass card, green tint, role-agnostic.
 * Returns null when nothing to celebrate.
 */
export function RoleKPIBanner({
  role: _role,
  name,
  thisWeek,
  lastWeek,
  metricLabel,
  celebrationTemplate,
  metricDirection = 'increase',
}: Props) {
  let shouldShow = false
  let delta = 0
  let displayNumber = 0

  if (metricDirection === 'increase') {
    shouldShow = thisWeek >= 1 && thisWeek > lastWeek
    delta = thisWeek - lastWeek
    displayNumber = thisWeek
  } else {
    // 'decrease' — celebrate when the overdue/problem count dropped.
    shouldShow = thisWeek >= 0 && lastWeek > thisWeek
    delta = lastWeek - thisWeek
    displayNumber = delta
  }

  if (!shouldShow) return null

  const pct = Math.round((delta / Math.max(lastWeek, 1)) * 100)
  const message = celebrationTemplate({ name, thisWeek, lastWeek, delta, pct })

  return (
    <div
      role="status"
      aria-label={metricLabel}
      style={{
        background: 'var(--portal-status-green-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--portal-status-green-ring)',
        borderRadius: 20,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow:
          '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
          fontSize: 'var(--aguila-fs-kpi-mid)',
          fontWeight: 800,
          color: 'var(--portal-status-green-fg)',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {displayNumber}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--aguila-fs-label)',
            fontWeight: 700,
            color: 'var(--portal-status-green-fg)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 2,
          }}
        >
          {metricLabel}
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-1)', fontWeight: 500, lineHeight: 1.35 }}>
          {message}
        </div>
      </div>
    </div>
  )
}
