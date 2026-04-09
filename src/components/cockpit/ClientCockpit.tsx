'use client'

import type { ClientData } from './shared/fetchCockpitData'
import { StatusHero } from './client/StatusHero'
import { WeekAheadPanel } from './client/WeekAheadPanel'
import { FinancialPanel } from './client/FinancialPanel'
import { InventoryPanel } from './client/InventoryPanel'
import { CruzAskPanel } from './client/CruzAskPanel'

interface Props {
  data: ClientData
  companyName: string
}

export function ClientCockpit({ data, companyName }: Props) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {companyName}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7681', margin: '4px 0 0' }}>
          Portal de cliente — CRUZ
        </p>
      </div>

      {/* Stacked sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 800 }}>
        <StatusHero
          statusLevel={data.statusLevel}
          statusSentence={data.statusSentence}
          entradasThisWeek={data.entradasThisWeek}
          activeShipments={data.activeShipments}
          nextCrossing={data.nextCrossing}
        />
        <WeekAheadPanel weekAhead={data.weekAhead} />
        <FinancialPanel financial={data.financial} />
        <InventoryPanel inventory={data.inventory} />
        <CruzAskPanel />
      </div>
    </div>
  )
}
