'use client'

import Link from 'next/link'
import { AlertTriangle, FileEdit, Clock } from 'lucide-react'
import type { SmartQueueItem } from '@/hooks/use-god-view-data'
import { fmtId, fmtCurrency } from '@/lib/format-utils'

interface Props {
  queue: SmartQueueItem[]
  total: number
  pendingDrafts: number
  pendingEscalations: number
  error?: string
}

export function SmartQueue({ queue, total, pendingDrafts, pendingEscalations, error }: Props) {
  if (error && queue.length === 0) {
    return (
      <div className="god-section">
        <h2 className="god-section-title">Cola de Trabajo</h2>
        <div className="god-empty">Sin datos de cola disponibles</div>
      </div>
    )
  }

  return (
    <div className="god-section">
      <div className="god-section-header">
        <h2 className="god-section-title">
          Cola de Trabajo
          {total > 0 && <span className="god-badge">{total}</span>}
        </h2>
        <Link href="/traficos?filter=blocking" className="god-link">Ver todo &rarr;</Link>
      </div>

      {queue.length === 0 ? (
        <div className="god-empty god-empty--good">Sin pendientes urgentes</div>
      ) : (
        <div className="god-queue-list">
          {queue.map(item => (
            <Link
              key={item.trafico}
              href={`/traficos/${encodeURIComponent(item.trafico)}`}
              className="god-queue-item"
            >
              <div className="god-queue-left">
                <span className="god-queue-id font-mono">{fmtId(item.trafico)}</span>
                <span className="god-queue-company">{item.company_id?.toUpperCase()}</span>
              </div>
              <div className="god-queue-center">
                <span className="god-queue-reason">{item.reason}</span>
                {item.proveedor && (
                  <span className="god-queue-sub">{item.proveedor}</span>
                )}
              </div>
              <div className="god-queue-right">
                <span className="god-queue-days font-mono">{item.days_active}d</span>
                {item.valor_usd > 0 && (
                  <span className="god-queue-value font-mono">
                    {fmtCurrency(item.valor_usd, { currency: 'USD' })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Summary chips */}
      <div className="god-chips">
        {pendingDrafts > 0 && (
          <Link href="/drafts" className="god-chip god-chip--gold">
            <FileEdit size={14} />
            {pendingDrafts} borrador{pendingDrafts !== 1 ? 'es' : ''} listo{pendingDrafts !== 1 ? 's' : ''}
          </Link>
        )}
        {pendingEscalations > 0 && (
          <Link href="/excepciones" className="god-chip god-chip--red">
            <AlertTriangle size={14} />
            {pendingEscalations} escalaci{pendingEscalations !== 1 ? 'ones' : 'ón'} vencida{pendingEscalations !== 1 ? 's' : ''}
          </Link>
        )}
        {pendingDrafts === 0 && pendingEscalations === 0 && queue.length > 0 && (
          <span className="god-chip god-chip--muted">
            <Clock size={14} />
            Sin escalaciones pendientes
          </span>
        )}
      </div>
    </div>
  )
}
