'use client'

import { useGodViewData } from '@/hooks/use-god-view-data'
import { SystemHeartbeat } from './SystemHeartbeat'
import { SmartQueue } from './SmartQueue'
import { CruzAutonomo } from './CruzAutonomo'
import { OperationalKPIs } from './OperationalKPIs'
import { ClientHealth } from './ClientHealth'
import { BorderIntel } from './BorderIntel'

export function GodView() {
  const data = useGodViewData()

  if (data.loading) {
    return (
      <div className="god-shell">
        <div className="god-heartbeat">
          <div className="skeleton-shimmer" style={{ height: 20, width: 200 }} />
        </div>
        <div className="god-section">
          <div className="skeleton-shimmer" style={{ height: 24, width: 160, marginBottom: 12 }} />
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 64, marginBottom: 8 }} />
          ))}
        </div>
        <div className="god-grid">
          <div className="god-grid-wide">
            <div className="skeleton-shimmer" style={{ height: 200 }} />
          </div>
          <div className="god-grid-narrow">
            <div className="skeleton-shimmer" style={{ height: 200 }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="god-shell">
      {/* A: System Heartbeat */}
      <SystemHeartbeat
        heartbeat={data.heartbeat}
        syncSources={data.syncSources}
        syncAllHealthy={data.syncAllHealthy}
        error={data.sectionErrors.heartbeat}
      />

      {/* B: Smart Queue */}
      <SmartQueue
        queue={data.smartQueue}
        total={data.smartQueueTotal}
        pendingDrafts={data.pendingDrafts}
        pendingEscalations={data.pendingEscalations}
        error={data.sectionErrors.queue}
      />

      {/* C + D: Autonomo (wide) + KPIs (narrow) */}
      <div className="god-grid">
        <div className="god-grid-wide">
          <CruzAutonomo
            opsCenter={data.opsCenter}
            agentDecisions24h={data.agentDecisions24h}
            agentAccuracy={data.agentAccuracy}
            error={data.sectionErrors.opsCenter}
          />
        </div>
        <div className="god-grid-narrow">
          <OperationalKPIs
            enProceso={data.enProceso}
            cruzadosHoy={data.cruzadosHoy}
            listosDespacho={data.listosDespacho}
            emailsHoy={data.emailsHoy}
            tipoCambio={data.tipoCambio}
            ahorroTmec={data.ahorroTmec}
          />
        </div>
      </div>

      {/* E + F: Clients (wide) + Border (narrow) */}
      <div className="god-grid">
        <div className="god-grid-wide">
          <ClientHealth
            companies={data.companies}
            pendientes={data.pendientes}
            inactiveClients={data.opsCenter?.inactiveClients}
            error={data.sectionErrors.companies}
          />
        </div>
        <div className="god-grid-narrow">
          <BorderIntel
            bridges={data.bridges}
            recommendedBridge={data.recommendedBridge}
            intelFeed={data.intelFeed}
            error={data.sectionErrors.bridges}
          />
        </div>
      </div>
    </div>
  )
}
