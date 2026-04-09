'use client'

import type { OperatorData } from '../shared/fetchCockpitData'

interface Props {
  blocked: OperatorData['blocked']
  operatorId: string
}

export function BlockedPanel({ blocked, operatorId }: Props) {
  if (blocked.length === 0) return null

  return (
    <div style={{
      background: '#222222', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(220,38,38,0.5)',
      padding: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Bloqueada?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {blocked.map(item => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.04)',
            gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-mono" style={{
                  fontSize: 13, fontWeight: 600, color: '#C9A84C',
                }}>
                  {item.trafico}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>
                {item.reason}
              </div>
            </div>

            <form action="/cockpit/actions" method="POST">
              <input type="hidden" name="traficoId" value={item.id} />
              <input type="hidden" name="operatorId" value={operatorId} />
              <input
                type="hidden"
                name="action"
                value={item.type === 'waiting_doc' ? 'request_update' : 'escalate_to_tito'}
              />
              <button
                type="submit"
                formAction="/cockpit/actions"
                style={{
                  background: item.type === 'waiting_doc'
                    ? 'rgba(201,168,76,0.15)' : 'rgba(220,38,38,0.1)',
                  color: item.type === 'waiting_doc' ? '#C9A84C' : '#DC2626',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minHeight: 36,
                }}
              >
                {item.type === 'waiting_doc' ? 'Pedir update' : 'Escalar a Tito'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
