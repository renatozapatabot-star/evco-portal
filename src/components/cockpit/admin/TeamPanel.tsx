'use client'

import type { AdminData } from '../shared/fetchCockpitData'

interface Props {
  team: AdminData['teamStats']
  unassigned: number
}

export function TeamPanel({ team, unassigned }: Props) {
  return (
    <div style={{
      background: 'rgba(9,9,11,0.75)',
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
          Equipo
        </span>
      </div>

      {team.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
          Sin operadores activos
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.map(op => (
            <div key={op.operator_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 13, color: '#E6EDF3' }}>{op.name}</span>
              <span className="font-mono" style={{ fontSize: 13, color: '#8B949E' }}>
                {op.assigned} asignados
              </span>
            </div>
          ))}

          {unassigned > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(217,119,6,0.06)',
              borderRadius: 8,
              border: '1px solid rgba(217,119,6,0.15)',
            }}>
              <span style={{ fontSize: 13, color: '#D97706' }}>Sin asignar</span>
              <span className="font-mono" style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                {unassigned}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
