'use client'

import Link from 'next/link'
import { fmtUSDCompact, fmtDateTime } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'

interface Props {
  companies: AdminData['companies']
}

export function ClientsTablePanel({ companies }: Props) {
  return (
    <div style={{
      background: 'rgba(9,9,11,0.75)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(192,197,206,0.4)',
      padding: 16,
    }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681',
        }}>
          Cartera de clientes
        </span>
        <span style={{ fontSize: 11, color: '#6E7681' }}>
          {companies.length} con embarques activos
        </span>
      </div>

      {companies.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin clientes con embarques activos
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Cliente', 'Embarques', 'Valor USD', 'Última actividad'].map(h => (
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
                  background: i % 2 === 0 ? 'rgba(9,9,11,0.75)' : 'rgba(255,255,255,0.02)',
                }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#E6EDF3' }}>
                    <Link
                      href={`/embarques?company=${encodeURIComponent(c.company_id)}`}
                      style={{ color: '#E6EDF3', textDecoration: 'none' }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px 12px', fontSize: 13, color: '#E8EAED', textAlign: 'right', fontWeight: 600,
                  }}>
                    {c.trafico_count}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px 12px', fontSize: 13,
                    color: c.valor_ytd > 0 ? '#E6EDF3' : '#6E7681',
                    textAlign: 'right',
                  }}>
                    {c.valor_ytd > 0 ? fmtUSDCompact(c.valor_ytd) : '—'}
                  </td>
                  <td className="font-mono" style={{
                    padding: '10px 12px', fontSize: 12,
                    color: '#8B949E', textAlign: 'right',
                  }}>
                    {c.last_activity ? fmtDateTime(c.last_activity) : '—'}
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
