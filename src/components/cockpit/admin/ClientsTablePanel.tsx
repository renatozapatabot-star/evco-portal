'use client'

import { fmtUSDCompact } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'

interface Props {
  companies: AdminData['companies']
}

export function ClientsTablePanel({ companies }: Props) {
  return (
    <div style={{
      background: '#222222',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(201,168,76,0.4)',
      padding: 16,
    }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681',
        }}>
          Clientes
        </span>
      </div>

      {companies.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin clientes con traficos activos
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Cliente', 'Traficos', 'Valor YTD'].map(h => (
                  <th key={h} style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: '#6E7681',
                    textAlign: h === 'Cliente' ? 'left' : 'right',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={c.company_id} style={{
                  background: i % 2 === 0 ? '#1A1A1A' : 'rgba(255,255,255,0.02)',
                }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#E6EDF3' }}>
                    {c.name}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px 12px', fontSize: 13, color: '#E6EDF3', textAlign: 'right',
                  }}>
                    {c.trafico_count}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px 12px', fontSize: 13, color: '#8B949E', textAlign: 'right',
                  }}>
                    {fmtUSDCompact(c.valor_ytd) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
