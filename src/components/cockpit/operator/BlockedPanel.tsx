'use client'

import Link from 'next/link'
import type { OperatorData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { CruzRecommendation } from '../shared/CruzRecommendation'
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
      actionHref="/traficos?estatus=Documentacion"
      onClear={onClear}
      quietContent={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocked.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C' }}>
                  {item.trafico}
                </span>
                <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{item.reason}</div>
              </div>
              <Link href={`/traficos/${encodeURIComponent(item.trafico)}`} style={{
                background: item.type === 'waiting_doc' ? 'rgba(201,168,76,0.15)' : 'rgba(220,38,38,0.1)',
                color: item.type === 'waiting_doc' ? '#C9A84C' : '#DC2626',
                borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600,
                textDecoration: 'none', whiteSpace: 'nowrap', minHeight: 36,
                display: 'flex', alignItems: 'center',
              }}>
                {item.type === 'waiting_doc' ? 'Ver tráfico' : 'Escalar'}
              </Link>
            </div>
          ))}
        </div>
      }
      footer={blocked.length > 0 ? (
        <CruzRecommendation
          compact
          recommendation={`CRUZ recomienda escalar ${blocked.length} bloqueo${blocked.length !== 1 ? 's' : ''}`}
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
