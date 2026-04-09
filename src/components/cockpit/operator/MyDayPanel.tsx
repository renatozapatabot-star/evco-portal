'use client'

import type { OperatorData } from '../shared/fetchCockpitData'

interface Props {
  myDay: OperatorData['myDay']
  teamStats: OperatorData['teamStats']
  unassignedCount: number
  operatorId: string
}

export function MyDayPanel({ myDay, teamStats, unassignedCount, operatorId }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {/* MI DIA */}
      <div style={{
        background: '#222222', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid rgba(201,168,76,0.4)',
        padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
        }}>
          Mi día
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StatRow label="Asignados" value={myDay.assigned} />
          <StatRow label="✅ Completados" value={myDay.completed} color="#16A34A" />
          <StatRow label="⏳ En progreso" value={myDay.inProgress} color="#D97706" />
          {myDay.nextDeadline && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(217,119,6,0.06)',
              borderRadius: 8,
              border: '1px solid rgba(217,119,6,0.15)',
              fontSize: 12, color: '#D97706',
            }}>
              Próximo vencimiento: {myDay.nextDeadline.trafico}
            </div>
          )}
        </div>
      </div>

      {/* EQUIPO */}
      <div style={{
        background: '#222222', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid rgba(201,168,76,0.4)',
        padding: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
        }}>
          Equipo
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teamStats.map(op => (
            <div key={op.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0',
            }}>
              <span style={{ fontSize: 13, color: '#E6EDF3' }}>{op.name}</span>
              <span className="font-mono" style={{ fontSize: 13, color: '#8B949E' }}>
                {op.assigned}
              </span>
            </div>
          ))}
          {unassignedCount > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
              marginTop: 4, paddingTop: 10,
            }}>
              <span style={{ fontSize: 13, color: '#8B949E' }}>
                Listos para asignar: {unassignedCount}
              </span>
              <form action="/cockpit/actions" method="POST">
                <input type="hidden" name="action" value="take_from_queue" />
                <input type="hidden" name="operatorId" value={operatorId} />
                <button
                  type="submit"
                  formAction="/cockpit/actions"
                  style={{
                    background: 'rgba(201,168,76,0.15)',
                    color: '#C9A84C',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    minHeight: 36,
                  }}
                >
                  Tomar de la cola
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 13, color: '#E6EDF3' }}>{label}</span>
      <span className="font-mono" style={{
        fontSize: 16, fontWeight: 700, color: color || '#E6EDF3',
      }}>
        {value}
      </span>
    </div>
  )
}
