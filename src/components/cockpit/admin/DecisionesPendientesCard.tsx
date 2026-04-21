'use client'

import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import type { AdminData } from '../shared/fetchCockpitData'
import { approveDraft } from '@/app/actions/reviewer'

interface Props {
  escalations: AdminData['escalations']
  queue: AdminData['smartQueue']
}

/**
 * Shows pending decisions across the firm that need admin approval.
 * Combines escalations + unassigned queue into one action surface.
 * Replaces the passive Team Live Panel.
 */
export function DecisionesPendientesCard({ escalations, queue }: Props) {
  const totalPending = escalations.length + queue.length

  const decisions: Array<{ id: string; label: string; confidence: number; action: () => Promise<void> }> = []

  // Escalations → approve draft
  for (const e of escalations.slice(0, 3)) {
    decisions.push({
      id: e.id,
      label: `${e.description} · ${e.company}`,
      confidence: 85,
      action: async () => { await approveDraft(e.id) },
    })
  }

  // Queue → assign
  for (const q of queue.slice(0, 2)) {
    decisions.push({
      id: q.trafico,
      label: `Asignar ${q.trafico} · ${q.company_id}`,
      confidence: 78,
      action: async () => {},
    })
  }

  return (
    <IfThenCard
      id="admin-decisiones-pendientes"
      state={totalPending > 3 ? 'urgent' : totalPending > 0 ? 'active' : 'quiet'}
      title="Decisiones pendientes"
      activeCondition={totalPending > 0 ? `${totalPending} decisión${totalPending !== 1 ? 'es' : ''} esperando tu aprobación` : undefined}
      activeAction="Resolver"
      urgentCondition={totalPending > 3 ? `${totalPending} decisiones acumuladas — intervenir` : undefined}
      urgentAction="Resolver ahora"
      actionHref="/drafts"
      quietContent={
        decisions.length === 0 ? (
          <div style={{ padding: '8px 0', color: 'var(--portal-fg-5)', fontSize: 'var(--aguila-fs-body)', textAlign: 'center' }}>
            Sin decisiones pendientes — todo aprobado
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {decisions.slice(0, 4).map(d => (
              <AduanaRecommendation
                key={d.id}
                compact
                recommendation={d.label}
                confidence={d.confidence}
                approveLabel="Aprobar"
                onApprove={d.action}
              />
            ))}
          </div>
        )
      }
    />
  )
}
