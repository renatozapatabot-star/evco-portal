import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_PRIMARY,
} from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

interface ContactoInfo {
  nombre: string | null
  email: string | null
  telefono: string | null
  rfc: string | null
}

interface AlertaRow {
  id: number
  decision_type: string
  decision: string
  created_at: string
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
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
          fontSize: 11, fontWeight: 700, color: TEXT_MUTED,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function ContactoPanel({ info }: { info: ContactoInfo }) {
  const rows: Array<[string, string | null, boolean?]> = [
    ['Contacto', info.nombre, false],
    ['Email', info.email, true],
    ['Teléfono', info.telefono, true],
    ['RFC', info.rfc, true],
  ]
  return (
    <Shell title="Contacto">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(([label, value, mono]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>{label}</span>
            <span style={{
              fontSize: 12,
              color: TEXT_PRIMARY,
              fontFamily: mono ? 'var(--font-mono)' : undefined,
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 220,
            }}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

export function AlertasPanel({ rows }: { rows: AlertaRow[] }) {
  return (
    <Shell title="Alertas recientes">
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          Sin alertas recientes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.slice(0, 5).map((r) => (
            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 600 }}>
                {r.decision_type}
              </span>
              <span style={{
                fontSize: 11, color: TEXT_MUTED,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.decision}
              </span>
              <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
                {fmtDateTime(r.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
