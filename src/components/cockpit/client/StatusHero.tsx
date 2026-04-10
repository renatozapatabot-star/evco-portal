'use client'

import type { ClientData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import { computeStatusHeroState } from '../shared/cardStates'

interface Props {
  statusLevel: ClientData['statusLevel']
  statusSentence: string
  entradasThisWeek: number
  activeShipments: number
  nextCrossing: ClientData['nextCrossing']
}

export function StatusHero({ statusLevel, statusSentence, entradasThisWeek, activeShipments, nextCrossing }: Props) {
  const cardState = computeStatusHeroState(activeShipments, entradasThisWeek)
  const dotColor = statusLevel === 'green' ? '#16A34A'
    : statusLevel === 'amber' ? '#D97706' : '#DC2626'

  return (
    <IfThenCard
      id="client-status-hero"
      state={cardState.state}
      title="Estado"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/traficos"
      quietContent={
        <>
          {/* Status dot + sentence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: dotColor, display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#E6EDF3' }}>
              {statusLevel === 'green' ? 'Todo en orden' : statusLevel === 'amber' ? 'Atención' : 'Acción requerida'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 10 }}>{statusSentence}</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>{entradasThisWeek}</span>
              <span style={{ fontSize: 12, color: '#8B949E', marginLeft: 6 }}>entrada{entradasThisWeek !== 1 ? 's' : ''} esta semana</span>
            </div>
            <div>
              <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>{activeShipments}</span>
              <span style={{ fontSize: 12, color: '#8B949E', marginLeft: 6 }}>envío{activeShipments !== 1 ? 's' : ''} en tránsito</span>
            </div>
          </div>
        </>
      }
      footer={
        activeShipments > 0 ? (
          <AduanaRecommendation
            compact
            recommendation={activeShipments === 1 ? 'ADUANA monitorea tu envío en tiempo real' : `ADUANA monitorea tus ${activeShipments} envíos`}
            confidence={95}
            approveLabel="Ver detalle"
            approveHref="/traficos"
          />
        ) : nextCrossing ? (
          <span style={{ color: '#C9A84C' }}>
            Próximo cruce: <span className="font-mono" style={{ fontWeight: 600 }}>{nextCrossing.trafico}</span>
          </span>
        ) : undefined
      }
    />
  )
}
