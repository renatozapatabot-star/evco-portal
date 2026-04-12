'use client'

import { fmtUSDCompact } from '../shared/formatters'
import type { ClientData } from '../shared/fetchCockpitData'

interface Props {
  weekAhead: ClientData['weekAhead']
}

export function WeekAheadPanel({ weekAhead }: Props) {
  return (
    <div style={{
      background: 'rgba(9,9,11,0.75)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(192,197,206,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Esta semana — que esperar
      </div>

      {weekAhead.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin envios programados esta semana
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Tráfico', 'Descripción', 'Valor', 'Estado'].map(h => (
                  <th key={h} style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: '#6E7681',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekAhead.map((item, i) => (
                <tr key={item.trafico} style={{
                  background: i % 2 === 0 ? 'rgba(9,9,11,0.75)' : 'rgba(255,255,255,0.02)',
                }}>
                  <td style={{ padding: '10px', fontSize: 16, textAlign: 'center' }}>
                    {item.statusIcon}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px', fontSize: 13, fontWeight: 600, color: '#E8EAED',
                  }}>
                    {item.trafico}
                  </td>
                  <td style={{
                    padding: '10px', fontSize: 12, color: '#E6EDF3',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.description}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px', fontSize: 12, color: '#8B949E',
                  }}>
                    {fmtUSDCompact(item.valor_usd)}
                  </td>
                  <td style={{
                    padding: '10px', fontSize: 12, color: '#8B949E',
                  }}>
                    {item.status}
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
