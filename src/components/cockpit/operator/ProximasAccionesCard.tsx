'use client'

import { IfThenCard } from '../shared/IfThenCard'
import { CruzRecommendation } from '../shared/CruzRecommendation'
import type { OperatorData } from '../shared/fetchCockpitData'
import { computeNextUp } from '../shared/computeNextUp'

interface Props {
  data: OperatorData
}

/**
 * Shows the top 3 proposed actions for this operator.
 * Each one has a one-tap approve button.
 * Replaces the passive "My Day" stats card.
 */
export function ProximasAccionesCard({ data }: Props) {
  const nextAction = computeNextUp(data)

  // Build action list from available data
  const actions: Array<{ label: string; confidence: number; href: string }> = []

  if (nextAction) {
    actions.push({
      label: nextAction.urgencyReason,
      confidence: Math.min(nextAction.urgencyScore, 99),
      href: nextAction.actionHref,
    })
  }

  // Add blocked items as actions
  for (const b of data.blocked.slice(0, 2)) {
    actions.push({
      label: `${b.trafico}: ${b.missingDocs.length > 0 ? b.missingDocs.slice(0, 2).join(', ') : b.reason}`,
      confidence: 80,
      href: `/traficos/${encodeURIComponent(b.trafico)}`,
    })
  }

  // Pad with unassigned if needed
  if (actions.length < 3 && data.unassignedCount > 0) {
    actions.push({
      label: `${data.unassignedCount} tráfico${data.unassignedCount !== 1 ? 's' : ''} sin asignar en cola`,
      confidence: 70,
      href: '/traficos',
    })
  }

  return (
    <IfThenCard
      id="operator-proximas-acciones"
      state={actions.length > 0 ? 'active' : 'quiet'}
      title="Próximas acciones"
      activeCondition={actions.length > 0 ? `${actions.length} acción${actions.length !== 1 ? 'es' : ''} pendiente${actions.length !== 1 ? 's' : ''}` : undefined}
      activeAction={actions.length > 0 ? 'Revisar' : undefined}
      actionHref={actions.length > 0 ? actions[0].href : undefined}
      quietContent={
        actions.length === 0 ? (
          <div style={{ padding: '8px 0', color: '#6E7681', fontSize: 13, textAlign: 'center' }}>
            Sin acciones pendientes — día al corriente
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.slice(0, 3).map((a, i) => (
              <CruzRecommendation
                key={i}
                compact
                recommendation={a.label}
                confidence={a.confidence}
                approveLabel="Ir"
                approveHref={a.href}
              />
            ))}
          </div>
        )
      }
    />
  )
}
