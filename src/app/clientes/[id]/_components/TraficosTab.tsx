import Link from 'next/link'
import { ACCENT_CYAN, BORDER, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { fmtDateTime, fmtUSD } from '@/lib/format-utils'

export interface TraficoRow {
  trafico: string
  estatus: string | null
  pedimento: string | null
  importe_total: number | null
  updated_at: string | null
  created_at: string | null
}

export function TraficosTab({ rows }: { rows: TraficoRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_MUTED, fontSize: 13 }}>
        Sin tráficos registrados para este cliente.
      </div>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: TEXT_MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Tráfico</th>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Estatus</th>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Valor</th>
            <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}` }}>Últ. actualización</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r) => (
            <tr key={r.trafico}>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'var(--font-mono)' }}>
                <Link href={`/traficos/${encodeURIComponent(r.trafico)}`} style={{ color: ACCENT_CYAN, textDecoration: 'none' }}>
                  {r.trafico}
                </Link>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}>
                {r.estatus ?? '—'}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'var(--font-mono)', color: TEXT_PRIMARY }}>
                {r.importe_total != null ? `${fmtUSD(Number(r.importe_total))} USD` : '—'}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'var(--font-mono)', color: TEXT_MUTED }}>
                {fmtDateTime(r.updated_at ?? r.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
