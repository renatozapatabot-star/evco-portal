'use client'

import Link from 'next/link'
import { fmtUSDCompact } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'

interface Props {
  queue: AdminData['smartQueue']
}

export function SmartQueuePanel({ queue }: Props) {
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
          Cola de trabajo
        </span>
      </div>

      {queue.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Cola vacia — sin traficos pendientes
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {queue.map((item, i) => (
            <Link
              key={item.trafico}
              href={`/traficos/${encodeURIComponent(item.trafico)}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: i === 0 ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.04)',
                textDecoration: 'none',
              }}
            >
              <span className="font-mono" style={{
                fontSize: 13, fontWeight: 600, color: '#C9A84C', flexShrink: 0,
              }}>
                {item.trafico}
              </span>
              <span style={{ fontSize: 12, color: '#8B949E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.company_id} · {item.descripcion || item.reason}
              </span>
              <span className="font-mono" style={{ fontSize: 12, color: '#6E7681', flexShrink: 0 }}>
                {fmtUSDCompact(item.valor_usd)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
