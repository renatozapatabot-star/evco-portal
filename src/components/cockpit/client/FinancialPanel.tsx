'use client'

import { fmtMXNCompact, fmtDelta } from '../shared/formatters'
import type { ClientData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { computeFinancialState } from '../shared/cardStates'

interface Props {
  financial: ClientData['financial']
}

export function FinancialPanel({ financial }: Props) {
  const facturadoDelta = fmtDelta(financial.facturadoThisMonth, financial.facturadoLastMonth)
  const arancelesDelta = fmtDelta(financial.arancelesThisMonth, financial.arancelesLastMonth)
  const cardState = computeFinancialState(financial.facturadoThisMonth, financial.facturadoLastMonth)

  return (
    <IfThenCard
      id="client-financial"
      state={cardState.state}
      title="Financiero"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/financiero"
      quietContent={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>
              {fmtMXNCompact(financial.facturadoThisMonth) || '$0 MXN'}
            </div>
            <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>facturado este mes</div>
            <div className="font-mono" style={{
              fontSize: 13, marginTop: 2,
              color: facturadoDelta.startsWith('▲') ? '#16A34A' : facturadoDelta.startsWith('▼') ? '#DC2626' : '#8B949E',
            }}>
              {facturadoDelta} vs mes anterior
            </div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>
              {fmtMXNCompact(financial.arancelesThisMonth) || '$0 MXN'}
            </div>
            <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>aranceles pagados</div>
            <div className="font-mono" style={{
              fontSize: 13, marginTop: 2,
              color: arancelesDelta.startsWith('▲') ? '#DC2626' : arancelesDelta.startsWith('▼') ? '#16A34A' : '#8B949E',
            }}>
              {arancelesDelta} vs mes anterior
            </div>
          </div>
        </div>
      }
    />
  )
}
