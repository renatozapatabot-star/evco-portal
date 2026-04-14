'use client'

import Link from 'next/link'
import { fmtDateTime } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import { computeEscalationState } from '../shared/cardStates'
import { approveDraft } from '@/app/actions/reviewer'

interface Props {
  escalations: AdminData['escalations']
}

export function NeedsJudgmentPanel({ escalations }: Props) {
  const overdue = escalations.filter(e => {
    const ageH = (Date.now() - new Date(e.created_at).getTime()) / 3600000
    return ageH > 24
  })

  const cardState = computeEscalationState(escalations.length, overdue.length)

  return (
    <IfThenCard
      id="admin-needs-judgment"
      state={cardState.state}
      title="Necesita tu juicio"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/drafts"
      quietContent={
        escalations.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Sin escalaciones pendientes
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {escalations.slice(0, 5).map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.045)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#E6EDF3', marginBottom: 2 }}>{e.description}</div>
                  <div style={{ fontSize: 11, color: '#6E7681' }}>{e.company} · {fmtDateTime(e.created_at)}</div>
                </div>
                <Link href="/drafts" style={{
                  padding: '8px 16px', background: 'rgba(192,197,206,0.15)',
                  color: '#E8EAED', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', flexShrink: 0, minHeight: 36,
                  display: 'flex', alignItems: 'center',
                }}>
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        )
      }
      footer={escalations.length > 0 ? (
        <AduanaRecommendation
          compact
          recommendation={overdue.length > 0
            ? `${overdue.length} vencida${overdue.length !== 1 ? 's' : ''} — resolver primero`
            : `${escalations.length} pendiente${escalations.length !== 1 ? 's' : ''} — aprobar borrador`
          }
          confidence={overdue.length > 0 ? 65 : 85}
          approveLabel={overdue.length > 0 ? 'Resolver' : 'Aprobar'}
          onApprove={async () => {
            const first = escalations[0]
            if (first) await approveDraft(first.id)
          }}
          reviewLabel="Ver todos"
          reviewHref="/drafts"
        />
      ) : undefined}
    />
  )
}
