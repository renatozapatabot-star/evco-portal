'use client'

import Link from 'next/link'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { computeMyDayState } from '../shared/cardStates'

interface Props {
  myDay: OperatorData['myDay']
  teamStats: OperatorData['teamStats']
  unassignedCount: number
  operatorId: string
}

export function MyDayPanel({ myDay, teamStats, unassignedCount }: Props) {
  const cardState = computeMyDayState(myDay.assigned, myDay.inProgress)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {/* MI DÍA */}
      <IfThenCard
        id="operator-my-day"
        state={cardState.state}
        title="Mi día"
        activeCondition={cardState.activeCondition}
        activeAction={cardState.activeAction}
        actionHref="/embarques"
        quietContent={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatRow label="Asignados" value={myDay.assigned} />
            <StatRow label="✅ Completados" value={myDay.completed} color="var(--portal-status-green-fg)" />
            <StatRow label="⏳ En progreso" value={myDay.inProgress} color="var(--portal-status-amber-fg)" />
            {myDay.nextDeadline && (
              <div style={{
                padding: '8px 12px', background: 'rgba(217,119,6,0.06)',
                borderRadius: 8, border: '1px solid rgba(217,119,6,0.15)',
                fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-status-amber-fg)',
              }}>
                Próximo vencimiento: {myDay.nextDeadline.trafico}
              </div>
            )}
          </div>
        }
      />

      {/* EQUIPO */}
      <IfThenCard
        id="operator-team"
        state={unassignedCount > 0 ? 'active' : 'quiet'}
        title="Equipo"
        activeCondition={unassignedCount > 0 ? `${unassignedCount} listos para asignar` : undefined}
        activeAction={unassignedCount > 0 ? 'Ver cola' : undefined}
        actionHref="/embarques"
        quietContent={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teamStats.map(op => (
              <div key={op.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0',
              }}>
                <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)' }}>{op.name}</span>
                <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>{op.assigned}</span>
              </div>
            ))}
            {unassignedCount > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                marginTop: 4, paddingTop: 10,
              }}>
                <span style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>
                  Listos para asignar: {unassignedCount}
                </span>
                <Link href="/embarques" style={{
                  background: 'rgba(192,197,206,0.15)', color: 'var(--portal-fg-1)',
                  borderRadius: 8, padding: '8px 16px', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
                  textDecoration: 'none', minHeight: 36, display: 'flex', alignItems: 'center',
                }}>
                  Ver cola
                </Link>
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0',
    }}>
      <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-1)' }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: color || 'var(--portal-fg-1)' }}>
        {value}
      </span>
    </div>
  )
}
