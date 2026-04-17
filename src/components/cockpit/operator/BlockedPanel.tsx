'use client'

import Link from 'next/link'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'
import { computeBlockedState } from '../shared/cardStates'
import { escalateBlocked } from '@/app/actions/reviewer'

interface Props {
  blocked: OperatorData['blocked']
  operatorId: string
  onClear?: () => void
}

export function BlockedPanel({ blocked, operatorId, onClear }: Props) {
  const cardState = computeBlockedState(blocked.length)

  if (blocked.length === 0) return null

  return (
    <IfThenCard
      id="operator-blocked"
      state={cardState.state}
      title="Bloqueados"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      urgentCondition={cardState.urgentCondition}
      urgentAction={cardState.urgentAction}
      actionHref="/embarques?estatus=Documentacion"
      onClear={onClear}
      quietContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocked.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.045)', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: '#E8EAED' }}>
                  {item.trafico}
                </span>
                <div style={{ fontSize: 'var(--aguila-fs-compact)', color: '#8B949E', marginTop: 2 }}>{item.reason}</div>
              </div>
              <Link href={`/embarques/${encodeURIComponent(item.trafico)}`} style={{
                background: item.type === 'waiting_doc' ? 'rgba(192,197,206,0.15)' : 'rgba(220,38,38,0.1)',
                color: item.type === 'waiting_doc' ? '#E8EAED' : '#DC2626',
                borderRadius: 8, padding: '8px 16px', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 36,
                display: 'flex', alignItems: 'center',
              }}>
                {item.type === 'waiting_doc' ? 'Ver embarque' : 'Escalar'}
              </Link>
            </div>
          ))}
        </div>
      }
      footer={blocked.length > 0 ? (
        <AduanaRecommendation
          compact
          recommendation={`PORTAL recomienda escalar ${blocked.length} bloqueo${blocked.length !== 1 ? 's' : ''}`}
          confidence={80}
          approveLabel="Escalar"
          onApprove={async () => {
            for (const b of blocked) {
              await escalateBlocked(b.id, b.trafico, b.reason)
            }
          }}
        />
      ) : undefined}
    />
  )
}
