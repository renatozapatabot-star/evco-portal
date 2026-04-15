import { BORDER, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'

export interface FraccionRow {
  fraccion: string
  count: number
  descripcion: string | null
}

export function FraccionesTab({ rows }: { rows: FraccionRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
        Sin fracciones arancelarias registradas.
      </div>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Fracción</th>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Descripción</th>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, textAlign: 'right' }}>Partidas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fraccion}>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>
                {r.fraccion}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: TEXT_PRIMARY, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.descripcion ?? '—'}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'var(--font-mono)', textAlign: 'right', color: TEXT_PRIMARY }}>
                {r.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
