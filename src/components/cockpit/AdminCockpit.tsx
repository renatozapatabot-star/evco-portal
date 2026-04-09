'use client'

import type { AdminData } from './shared/fetchCockpitData'
import { CruzAutonomoPanel } from './admin/CruzAutonomoPanel'
import { NeedsJudgmentPanel } from './admin/NeedsJudgmentPanel'
import { SmartQueuePanel } from './admin/SmartQueuePanel'
import { TeamPanel } from './admin/TeamPanel'
import { ClientsTablePanel } from './admin/ClientsTablePanel'
import { RightRail } from './admin/RightRail'

interface Props {
  data: AdminData
  operatorName: string
}

export function AdminCockpit({ data, operatorName }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {greeting}, {operatorName || 'Administrador'}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7681', margin: '4px 0 0' }}>
          Panel de control — CRUZ
        </p>
      </div>

      {/* Main layout: column + right rail */}
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}>
        {/* Main column */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <CruzAutonomoPanel
            decisions={data.agentDecisions24h}
            workflow={data.workflowEvents24h}
            actions={data.operatorActions24h}
          />
          <NeedsJudgmentPanel escalations={data.escalations} />
          <SmartQueuePanel queue={data.smartQueue} />
          <TeamPanel team={data.teamStats} unassigned={data.unassignedCount} />
          <ClientsTablePanel companies={data.companies} />
        </div>

        {/* Right rail — hidden on mobile, 320px on desktop */}
        <div style={{
          width: 320,
          flexShrink: 0,
          display: 'none',
        }} className="admin-right-rail">
          <RightRail />
        </div>
      </div>

      {/* Mobile: right rail stacks below */}
      <div style={{ marginTop: 12 }} className="admin-right-rail-mobile">
        <RightRail />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .admin-right-rail { display: block !important; }
          .admin-right-rail-mobile { display: none !important; }
        }
        @media (max-width: 767px) {
          .admin-right-rail { display: none !important; }
          .admin-right-rail-mobile { display: block !important; }
        }
      `}</style>
    </div>
  )
}
