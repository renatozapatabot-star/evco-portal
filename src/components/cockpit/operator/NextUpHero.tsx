'use client'

import { fmtUSDCompact } from '../shared/formatters'
import type { OperatorData } from '../shared/fetchCockpitData'

interface Props {
  nextUp: OperatorData['nextUp']
  operatorId: string
}

export function NextUpHero({ nextUp, operatorId }: Props) {
  if (!nextUp) {
    return (
      <div style={{
        background: '#222222', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid rgba(22,163,74,0.5)',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#E6EDF3', marginBottom: 4 }}>
          Sin pendientes
        </div>
        <div style={{ fontSize: 13, color: '#8B949E' }}>
          No hay traficos asignados por ahora
        </div>
      </div>
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

  return (
    <div style={{
      background: '#222222', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '3px solid rgba(201,168,76,0.6)',
      padding: 20,
    }}>
      {/* Label */}
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: '#6E7681', marginBottom: 12,
      }}>
        Ahora — lo siguiente
      </div>

      {/* Trafico info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span className="font-mono" style={{
            fontSize: 20, fontWeight: 700, color: '#C9A84C',
          }}>
            {nextUp.trafico}
          </span>
          <span style={{ fontSize: 13, color: '#8B949E' }}>
            · {nextUp.company}
          </span>
        </div>
        <div style={{ fontSize: 14, color: '#E6EDF3', marginBottom: 4 }}>
          {nextUp.description}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8B949E' }}>
          <span className="font-mono">{fmtUSDCompact(nextUp.valor_usd)}</span>
          <span>llego hace {nextUp.arrived_ago}</span>
        </div>
      </div>

      {/* AI suggestion */}
      {nextUp.suggestion && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#8B949E' }}>🤖 CRUZ sugiere:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="font-mono" style={{
              fontSize: 16, fontWeight: 700, color: '#E6EDF3',
            }}>
              {nextUp.suggestion.fraccion}
            </span>
            <span className="font-mono" style={{
              fontSize: 13, fontWeight: 600,
              color: confidenceColor,
              background: confidenceBg,
              padding: '2px 8px',
              borderRadius: 6,
            }}>
              {nextUp.suggestion.confidence}%
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nextUp.suggestion && (
          <form action="/cockpit/actions" method="POST" style={{ flex: 1 }}>
            <input type="hidden" name="action" value="confirm_and_advance" />
            <input type="hidden" name="decisionId" value={nextUp.suggestion.decision_id} />
            <input type="hidden" name="operatorId" value={operatorId} />
            <input type="hidden" name="traficoId" value={nextUp.id} />
            <button
              type="submit"
              formAction="/cockpit/actions"
              style={{
                width: '100%',
                minHeight: 60,
                background: '#C9A84C',
                color: '#111111',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirmar y avanzar
            </button>
          </form>
        )}
        <form action="/cockpit/actions" method="POST" style={{ flex: nextUp.suggestion ? 'none' : 1 }}>
          <input type="hidden" name="action" value="escalate" />
          <input type="hidden" name="traficoId" value={nextUp.id} />
          <input type="hidden" name="operatorId" value={operatorId} />
          <button
            type="submit"
            formAction="/cockpit/actions"
            style={{
              width: '100%',
              minHeight: 60,
              background: 'transparent',
              color: '#8B949E',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0 24px',
            }}
          >
            Necesito ayuda
          </button>
        </form>
      </div>
    </div>
  )
}
