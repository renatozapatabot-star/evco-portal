'use client'

import { fmtUSDCompact } from '../shared/formatters'
import type { ClientData } from '../shared/fetchCockpitData'

interface Props {
  weekAhead: ClientData['weekAhead']
}

export function WeekAheadPanel({ weekAhead }: Props) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(192,197,206,0.4)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--portal-fg-5)', marginBottom: 12,
      }}>
        Esta semana — que esperar
      </div>

      {weekAhead.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--portal-fg-5)', fontSize: 'var(--aguila-fs-body)' }}>
          Sin envios programados esta semana
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Embarque', 'Descripción', 'Valor', 'Estado'].map(h => (
                  <th key={h} style={{
                    fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--portal-fg-5)',
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
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
                }}>
                  <td style={{ padding: '10px', fontSize: 'var(--aguila-fs-body-lg)', textAlign: 'center' }}>
                    {item.statusIcon}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px', fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--portal-fg-1)',
                  }}>
                    {item.trafico}
                  </td>
                  <td style={{
                    padding: '10px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-1)',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.description}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)',
                  }}>
                    {fmtUSDCompact(item.valor_usd)}
                  </td>
                  <td style={{
                    padding: '10px', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)',
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
