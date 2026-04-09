'use client'

import Link from 'next/link'
import { fmtUSDCompact } from '../shared/formatters'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'

interface Props {
  nextUp: OperatorData['nextUp']
  operatorId: string
}

export function NextUpHero({ nextUp, operatorId }: Props) {
  if (!nextUp) {
    return (
      <IfThenCard
        id="operator-next-up"
        state="quiet"
        title="Ahora — lo siguiente"
        quietContent={
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#E6EDF3', marginBottom: 4 }}>
              Día al corriente
            </div>
            <div style={{ fontSize: 13, color: '#8B949E' }}>
              No hay tráficos asignados por ahora
            </div>
          </div>
        }
      />
    )
  }

  const confidenceColor = nextUp.suggestion
    ? nextUp.suggestion.confidence >= 85 ? '#16A34A'
    : nextUp.suggestion.confidence >= 70 ? '#D97706'
    : '#DC2626'
    : '#6E7681'

  const confidenceBg = nextUp.suggestion
    ? nextUp.suggestion.confidence >= 85 ? 'rgba(22,163,74,0.1)'
    : nextUp.suggestion.confidence >= 70 ? 'rgba(217,119,6,0.1)'
    : 'rgba(220,38,38,0.1)'
    : 'transparent'

  const cardState = nextUp.suggestion && nextUp.suggestion.confidence < 70 ? 'urgent' as const : 'active' as const

  return (
    <IfThenCard
      id="operator-next-up"
      state={cardState}
      title="Ahora — lo siguiente"
      activeCondition={`Siguiente: ${nextUp.trafico} · ${nextUp.company}`}
      activeAction="Ver tráfico"
      urgentCondition={nextUp.suggestion ? `Clasificación requiere revisión · ${nextUp.suggestion.confidence}% confianza` : undefined}
      urgentAction="Revisar clasificación"
      actionHref={`/traficos/${encodeURIComponent(nextUp.trafico)}`}
      quietContent={
        <>
          {/* Trafico info */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: '#C9A84C' }}>
                {nextUp.trafico}
              </span>
              <span style={{ fontSize: 13, color: '#8B949E' }}>· {nextUp.company}</span>
            </div>
            <div style={{ fontSize: 14, color: '#E6EDF3', marginBottom: 4 }}>{nextUp.description}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8B949E' }}>
              <span className="font-mono">{fmtUSDCompact(nextUp.valor_usd)}</span>
              <span>llegó hace {nextUp.arrived_ago}</span>
            </div>
          </div>

          {/* Document checklist */}
          {nextUp.docs && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#8B949E' }}>Documentos:</span>
                <span className="font-mono" style={{
                  fontSize: 12, fontWeight: 600,
                  color: nextUp.docs.present === nextUp.docs.total ? '#16A34A' : nextUp.docs.missing.length > 2 ? '#DC2626' : '#D97706',
                }}>
                  {nextUp.docs.present}/{nextUp.docs.total}
                </span>
                {/* Progress bar */}
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{
                    width: `${(nextUp.docs.present / nextUp.docs.total) * 100}%`,
                    height: '100%', borderRadius: 2,
                    background: nextUp.docs.present === nextUp.docs.total ? '#16A34A' : '#C9A84C',
                  }} />
                </div>
              </div>
              {nextUp.docs.missing.length > 0 && (
                <div style={{ fontSize: 11, color: '#D97706' }}>
                  Falta: {nextUp.docs.missing.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* AI suggestion */}
          {nextUp.suggestion && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 4 }}>🤖 CRUZ sugiere:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3' }}>
                  {nextUp.suggestion.fraccion}
                </span>
                <span className="font-mono" style={{
                  fontSize: 13, fontWeight: 600, color: confidenceColor,
                  background: confidenceBg, padding: '2px 8px', borderRadius: 6,
                }}>
                  {nextUp.suggestion.confidence}%
                </span>
              </div>
            </div>
          )}
        </>
      }
    />
  )
}
