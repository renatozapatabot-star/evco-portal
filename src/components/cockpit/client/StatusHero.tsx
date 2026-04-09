'use client'

import type { ClientData } from '../shared/fetchCockpitData'

interface Props {
  statusLevel: ClientData['statusLevel']
  statusSentence: string
  entradasThisWeek: number
  activeShipments: number
  nextCrossing: ClientData['nextCrossing']
}

export function StatusHero({ statusLevel, statusSentence, entradasThisWeek, activeShipments, nextCrossing }: Props) {
  const dotColor = statusLevel === 'green' ? '#16A34A'
    : statusLevel === 'amber' ? '#D97706' : '#DC2626'

  const urgencyBorder = statusLevel === 'green' ? 'rgba(22,163,74,0.5)'
    : statusLevel === 'amber' ? 'rgba(217,119,6,0.6)' : 'rgba(220,38,38,0.7)'

  return (
    <div style={{
      background: '#222222', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: `3px solid ${urgencyBorder}`,
      padding: 20,
    }}>
      {/* Status dot + sentence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
          background: dotColor, display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontSize: 18, fontWeight: 600, color: '#E6EDF3' }}>
          {statusLevel === 'green' ? 'Todo en orden' : statusLevel === 'amber' ? 'Atención' : 'Acción requerida'}
        </span>
      </div>

      {/* Sentence */}
      <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 12 }}>
        {statusSentence}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3' }}>
            {entradasThisWeek}
          </span>
          <span style={{ fontSize: 12, color: '#8B949E', marginLeft: 6 }}>
            entrada{entradasThisWeek !== 1 ? 's' : ''} esta semana
          </span>
        </div>
        <div>
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3' }}>
            {activeShipments}
          </span>
          <span style={{ fontSize: 12, color: '#8B949E', marginLeft: 6 }}>
            envío{activeShipments !== 1 ? 's' : ''} en tránsito
          </span>
        </div>
      </div>

      {/* Next crossing */}
      {nextCrossing && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(201,168,76,0.06)',
          borderRadius: 8,
          border: '1px solid rgba(201,168,76,0.15)',
          fontSize: 13, color: '#C9A84C',
        }}>
          Próximo cruce esperado: <span className="font-mono" style={{ fontWeight: 600 }}>{nextCrossing.trafico}</span>
        </div>
      )}
    </div>
  )
}
