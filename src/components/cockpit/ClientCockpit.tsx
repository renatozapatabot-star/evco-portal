'use client'

import type { ClientData } from './shared/fetchCockpitData'
import { StatusHero } from './client/StatusHero'
import { WeekAheadPanel } from './client/WeekAheadPanel'
import { FinancialPanel } from './client/FinancialPanel'
import { InventoryPanel } from './client/InventoryPanel'
import { AduanaAskPanel } from './client/CruzAskPanel'
import { DemandForecastCard, InventoryEstimateCard, CostInsightsCard, SupplierScoresCard } from './client/IntelligenceCards'

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
          fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {companyName}
        </h1>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: '#6E7681', margin: '4px 0 0' }}>
          ZAPATA AI · Cliente
        </p>
      </div>

      {/* Stacked sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 800 }}>
        <StatusHero
          statusLevel={data.statusLevel}
          statusSentence={data.statusSentence}
          entradasThisMonth={data.entradasThisMonth}
          activeShipments={data.activeShipments}
          nextCrossing={data.nextCrossing}
        />
        <WeekAheadPanel weekAhead={data.weekAhead} />
        <FinancialPanel financial={data.financial} />
        <InventoryPanel inventory={data.inventory} />

        {/* Phase 2: Intelligence products */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <DemandForecastCard />
          <CostInsightsCard />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <InventoryEstimateCard />
          <SupplierScoresCard />
        </div>

        <AduanaAskPanel />
      </div>
    </div>
  )
}
