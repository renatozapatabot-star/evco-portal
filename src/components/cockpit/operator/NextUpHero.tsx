'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { fmtUSDCompact } from '../shared/formatters'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import { computeNextUp } from '../shared/computeNextUp'
import { approveClassification } from '@/app/actions/reviewer'

interface Props {
  data: OperatorData
  operatorName: string
}

export function NextUpHero({ data, operatorName }: Props) {
  const nextAction = computeNextUp(data)
  const nextUp = data.nextUp

  if (!nextAction) {
    return (
      <IfThenCard
        id="operator-mi-turno"
        state="quiet"
        title="Mi turno"
        quietContent={
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              margin: '0 auto 10px',
              width: 44, height: 44, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(192,197,206,0.08)',
              border: '1px solid rgba(192,197,206,0.3)',
              color: '#E8EAED',
            }}>
              <Check size={22} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 600, color: '#E6EDF3', marginBottom: 4 }}>
              Todo al corriente
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>
              No hay pendientes para ti, {operatorName.split(' ')[0]}. Buen trabajo.
            </div>
          </div>
        }
      />
    )
  }

  const confidenceColor = nextUp?.suggestion
    ? nextUp.suggestion.confidence >= 85 ? '#16A34A'
    : nextUp.suggestion.confidence >= 70 ? '#D97706'
    : '#DC2626'
    : '#6E7681'

  const confidenceBg = nextUp?.suggestion
    ? nextUp.suggestion.confidence >= 85 ? 'rgba(22,163,74,0.1)'
    : nextUp.suggestion.confidence >= 70 ? 'rgba(217,119,6,0.1)'
    : 'rgba(220,38,38,0.1)'
    : 'transparent'

  return (
    <IfThenCard
      id="operator-mi-turno"
      state={nextAction.urgencyScore >= 90 ? 'urgent' : 'active'}
      title="Mi turno · lo siguiente"
      activeCondition={nextAction.urgencyReason}
      activeAction={nextAction.actionLabel}
      urgentCondition={nextAction.urgencyScore >= 90 ? nextAction.urgencyReason : undefined}
      urgentAction={nextAction.urgencyScore >= 90 ? nextAction.actionLabel : undefined}
      actionHref={nextAction.actionHref}
      quietContent={
        nextUp ? (
          <>
            {/* Trafico info */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: '#E8EAED' }}>
                  {nextUp.trafico}
                </span>
                <span style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>· {nextUp.company}</span>
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-section)', color: '#E6EDF3', marginBottom: 4 }}>{nextUp.description}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 'var(--aguila-fs-body)', color: '#8B949E' }}>
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
                  <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#8B949E' }}>Documentos:</span>
                  <span className="font-mono" style={{
                    fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
                    color: nextUp.docs.present === nextUp.docs.total ? '#16A34A' : nextUp.docs.missing.length > 2 ? '#DC2626' : '#D97706',
                  }}>
                    {nextUp.docs.present}/{nextUp.docs.total}
                  </span>
                  <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <div style={{
                      width: `${(nextUp.docs.present / Math.max(nextUp.docs.total, 1)) * 100}%`,
                      height: '100%', borderRadius: 2,
                      background: nextUp.docs.present === nextUp.docs.total ? '#16A34A' : '#E8EAED',
                    }} />
                  </div>
                </div>
                {nextUp.docs.missing.length > 0 && (
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#D97706' }}>
                    Falta: {nextUp.docs.missing.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* CRUZ Recommendation */}
            {nextUp.suggestion && (
              <AduanaRecommendation
                recommendation={`Clasificar como ${nextUp.suggestion.fraccion}`}
                confidence={nextUp.suggestion.confidence}
                approveLabel="Confirmar clasificación"
                onApprove={async () => {
                  const result = await approveClassification(nextUp.suggestion!.decision_id, nextUp.suggestion!.fraccion)
                  if (!result.ok) { /* error handled by sound/haptic in AduanaRecommendation */ }
                }}
                reviewLabel="Revisar"
                reviewHref={`/embarques/${encodeURIComponent(nextUp.trafico)}`}
                reasoning={[
                  `Fracción sugerida: ${nextUp.suggestion.fraccion}`,
                  `Basado en ${nextUp.suggestion.confidence >= 85 ? 'alta' : nextUp.suggestion.confidence >= 70 ? 'media' : 'baja'} similitud con clasificaciones previas`,
                ]}
              />
            )}
          </>
        ) : (
          <div style={{ fontSize: 'var(--aguila-fs-section)', color: '#E6EDF3' }}>
            {nextAction.description || nextAction.urgencyReason}
          </div>
        )
      }
    />
  )
}
