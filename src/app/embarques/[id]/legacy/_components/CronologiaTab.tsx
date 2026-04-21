import { fmtDateTime } from '@/lib/format-utils'
import { ACCENT_SILVER, BORDER, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

export interface DecisionRow {
  id: number
  decision_type: string
  decision: string
  reasoning: string | null
  created_at: string
}

export function CronologiaTab({ decisions }: { decisions: DecisionRow[] }) {
  if (decisions.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
        Sin decisiones registradas todavía. Cada cambio de estatus o nota
        quedará asentado aquí para la cadena de custodia SAT.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {decisions.map((d, i) => (
        <div
          key={d.id}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 0',
            borderBottom: i < decisions.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: ACCENT_SILVER,
              boxShadow: `0 0 8px ${ACCENT_SILVER}`,
              marginTop: 8,
              flexShrink: 0,
            }}
            aria-hidden
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  fontWeight: 700,
                  color: TEXT_MUTED,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {d.decision_type.replace(/_/g, ' ')}
              </div>
              <div
                style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  color: TEXT_MUTED,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtDateTime(d.created_at)}
              </div>
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, marginTop: 4 }}>{d.decision}</div>
            {d.reasoning && (
              <div style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, marginTop: 2 }}>{d.reasoning}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
