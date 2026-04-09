'use client'

import Link from 'next/link'
import { fmtUSDCompact } from '../shared/formatters'
import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { CruzRecommendation } from '../shared/CruzRecommendation'
import { computeQueueState } from '../shared/cardStates'
import { takeTrafico } from '@/app/actions/reviewer'

interface Props {
  queue: AdminData['smartQueue']
  onItemClick?: (item: AdminData['smartQueue'][0]) => void
}

export function SmartQueuePanel({ queue, onItemClick }: Props) {
  const cardState = computeQueueState(queue.length)

  return (
    <IfThenCard
      id="admin-smart-queue"
      state={cardState.state}
      title="Cola de trabajo"
      activeCondition={cardState.activeCondition}
      activeAction={cardState.activeAction}
      actionHref={queue.length > 0 ? `/traficos/${encodeURIComponent(queue[0].trafico)}` : undefined}
      quietContent={
        queue.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Cola vacía — sin tráficos pendientes
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.map((item, i) => (
              <div key={item.trafico} onClick={() => onItemClick ? onItemClick(item) : window.location.assign(`/traficos/${encodeURIComponent(item.trafico)}`)} style={{ cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: i === 0 ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)',
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                textDecoration: 'none',
              }}>
                <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C', flexShrink: 0 }}>
                  {item.trafico}
                </span>
                <span style={{ fontSize: 12, color: '#8B949E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.company_id} · {item.descripcion || item.reason}
                </span>
                <span className="font-mono" style={{ fontSize: 12, color: '#6E7681', flexShrink: 0 }}>
                  {fmtUSDCompact(item.valor_usd)}
                </span>
              </div>
            ))}
          </div>
        )
      }
      footer={queue.length > 0 ? (
        <CruzRecommendation
          compact
          recommendation={`Asignar ${queue[0].trafico} al siguiente operador disponible`}
          confidence={82}
          approveLabel="Asignar"
          onApprove={async () => {
            const first = queue[0]
            if (first) await takeTrafico(String(first.valor_usd), first.trafico)
          }}
        />
      ) : undefined}
    />
  )
}
