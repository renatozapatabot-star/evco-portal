import { BORDER, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

export interface PartidaRow {
  id?: number
  numero_parte?: string | null
  descripcion?: string | null
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  cantidad?: number | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  valor_comercial?: number | null
  regimen?: string | null
}

export function PartidasTab({ partidas }: { partidas: PartidaRow[] }) {
  if (partidas.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
        Sin partidas registradas. Aparecerán cuando se procese el pedimento.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Núm. de Parte', 'Fracción', 'Descripción', 'Bultos', 'Peso (kg)', 'Régimen'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 700,
                  color: TEXT_MUTED,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '10px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {partidas.map((p, i) => (
            <tr key={p.id ?? i}>
              <td style={cell(true)}>{p.numero_parte ?? '—'}</td>
              <td style={cell(true)}>{p.fraccion_arancelaria ?? p.fraccion ?? '—'}</td>
              <td style={cellDesc}>{p.descripcion ?? '—'}</td>
              <td style={cell(true, 'right')}>{p.cantidad_bultos ?? p.cantidad ?? '—'}</td>
              <td style={cell(true, 'right')}>
                {p.peso_bruto ? Number(p.peso_bruto).toLocaleString('es-MX') : '—'}
              </td>
              <td style={cell(false)}>{p.regimen ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function cell(mono: boolean, align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: `1px solid ${BORDER}`,
    fontFamily: mono ? 'var(--font-mono)' : undefined,
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: align,
    whiteSpace: 'nowrap',
  }
}

const cellDesc: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${BORDER}`,
  fontSize: 13,
  color: TEXT_PRIMARY,
  maxWidth: 320,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
