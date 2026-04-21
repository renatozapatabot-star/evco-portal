'use client'

import type { ClientData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import { computeStatusHeroState } from '../shared/cardStates'

interface Props {
  statusLevel: ClientData['statusLevel']
  statusSentence: string
  entradasThisMonth: number
  activeShipments: number
  nextCrossing: ClientData['nextCrossing']
}

export function StatusHero({ statusLevel, statusSentence, entradasThisMonth, activeShipments, nextCrossing }: Props) {
  const cardState = computeStatusHeroState(activeShipments, entradasThisMonth)
  const dotColor = statusLevel === 'green' ? 'var(--portal-status-green-fg)'
    : statusLevel === 'amber' ? 'var(--portal-status-amber-fg)' : 'var(--portal-status-red-fg)'

  return (
    <IfThenCard
      id="client-status-hero"
      state={cardState.state}
      title="Estado"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/embarques"
      quietContent={
        <>
          {/* Status dot + sentence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: dotColor, display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, color: 'var(--portal-fg-1)' }}>
              {statusLevel === 'green' ? 'Todo en orden' : statusLevel === 'amber' ? 'Atención' : 'Acción requerida'}
            </span>
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginBottom: 10 }}>{statusSentence}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>{entradasThisMonth}</span>
              <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)', marginLeft: 6 }}>entrada{entradasThisMonth !== 1 ? 's' : ''} este mes</span>
            </div>
            <div>
              <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>{activeShipments}</span>
              <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)', marginLeft: 6 }}>envío{activeShipments !== 1 ? 's' : ''} en tránsito</span>
            </div>
          </div>
        </>
      }
      footer={
        activeShipments > 0 ? (
          <AduanaRecommendation
            compact
            recommendation={activeShipments === 1 ? 'PORTAL monitorea tu envío en tiempo real' : `PORTAL monitorea tus ${activeShipments} envíos`}
            confidence={95}
            approveLabel="Ver detalle"
            approveHref="/embarques"
          />
        ) : nextCrossing ? (
          <span style={{ color: 'var(--portal-fg-1)' }}>
            Próximo cruce: <span className="font-mono" style={{ fontWeight: 600 }}>{nextCrossing.trafico}</span>
          </span>
        ) : undefined
      }
    />
  )
}
