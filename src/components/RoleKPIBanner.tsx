'use client'

interface Props {
  role: string
  name: string
  thisWeek: number
  lastWeek: number
  metricLabel: string
  celebrationTemplate: (args: { name: string; thisWeek: number; pct: number }) => string
}

/**
 * Positive-KPI banner — appears only when this week's count beats last week's.
 * Glass card, green tint, role-agnostic. Returns null when nothing to celebrate.
 */
export function RoleKPIBanner({
  role: _role,
  name,
  thisWeek,
  lastWeek,
  metricLabel,
  celebrationTemplate,
}: Props) {
  if (!(thisWeek >= 1 && thisWeek > lastWeek)) return null

  const pct = Math.round(((thisWeek - lastWeek) / Math.max(lastWeek, 1)) * 100)
  const message = celebrationTemplate({ name, thisWeek, pct })

  return (
    <div
      role="status"
      aria-label={metricLabel}
      style={{
        background: 'rgba(34,197,94,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(34,197,94,0.25)',
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
          fontSize: 28,
          fontWeight: 800,
          color: '#22C55E',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {thisWeek}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#22C55E',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 2,
          }}
        >
          {metricLabel}
        </div>
        <div style={{ fontSize: 14, color: '#E6EDF3', fontWeight: 500, lineHeight: 1.35 }}>
          {message}
        </div>
      </div>
    </div>
  )
}
