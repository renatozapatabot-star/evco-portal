import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'

export interface InfoRow {
  label: string
  value: string
  mono?: boolean
}

export function InfoLateralPanel({ rows }: { rows: InfoRow[] }) {
  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: GLASS_SHADOW,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 14,
        }}
      >
        Información
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>{r.label}</span>
            <span
              style={{
                fontSize: 13,
                color: TEXT_PRIMARY,
                fontFamily: r.mono ? 'var(--font-mono)' : undefined,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
