'use client'

import Link from 'next/link'
import type { CompanyRow, PendienteRow } from '@/hooks/use-god-view-data'
import { fmtCurrency } from '@/lib/format-utils'

interface Props {
  companies: CompanyRow[]
  pendientes: PendienteRow[]
  inactiveClients?: { company_id: string; name: string; daysSinceActivity: number }[]
  error?: string
}

export function ClientHealth({ companies, pendientes, inactiveClients, error }: Props) {
  if (error && companies.length === 0) {
    return (
      <div className="god-section">
        <h2 className="god-section-title">Clientes</h2>
        <div className="god-empty">Sin datos de clientes</div>
      </div>
    )
  }

  // Build a lookup for pendientes by company_id
  const pendMap: Record<string, PendienteRow> = {}
  for (const p of pendientes) {
    pendMap[p.company_id] = p
  }

  // Build inactive lookup
  const inactiveMap: Record<string, number> = {}
  for (const c of (inactiveClients ?? [])) {
    inactiveMap[c.company_id] = c.daysSinceActivity
  }

  return (
    <div className="god-section">
      <div className="god-section-header">
        <h2 className="god-section-title">
          Clientes
          <span className="god-badge god-badge--muted">{companies.length}</span>
        </h2>
      </div>

      {companies.length === 0 ? (
        <div className="god-empty">Sin clientes registrados</div>
      ) : (
        <div className="god-client-list">
          {companies.map(co => {
            const pend = pendMap[co.company_id]
            const inactiveDays = inactiveMap[co.company_id]
            const hasIssues = pend && (pend.solicitudes_vencidas > 0 || pend.entradas_sin_trafico > 0)

            return (
              <Link
                key={co.company_id}
                href={`/api/auth/view-as?company=${co.company_id}`}
                className="god-client-row"
                prefetch={false}
              >
                {/* Status dot */}
                <span
                  className="god-client-dot"
                  style={{
                    background: inactiveDays
                      ? 'var(--text-muted)'
                      : hasIssues
                        ? 'var(--warning-500, #D97706)'
                        : 'var(--success-500, #16A34A)',
                  }}
                />

                {/* Name */}
                <span className="god-client-name">{co.name}</span>

                {/* Trafico count */}
                <span className="god-client-count font-mono">{co.trafico_count}</span>

                {/* Valor YTD */}
                <span className="god-client-valor font-mono">
                  {co.valor_ytd > 0 ? fmtCurrency(co.valor_ytd, { currency: 'USD' }) : '—'}
                </span>

                {/* Status label */}
                {inactiveDays ? (
                  <span className="god-client-status god-client-status--inactive">
                    {inactiveDays}d sin actividad
                  </span>
                ) : hasIssues ? (
                  <span className="god-client-status god-client-status--warn">
                    {pend.solicitudes_vencidas > 0 && `${pend.solicitudes_vencidas} sol. vencida${pend.solicitudes_vencidas !== 1 ? 's' : ''}`}
                    {pend.solicitudes_vencidas > 0 && pend.entradas_sin_trafico > 0 && ' · '}
                    {pend.entradas_sin_trafico > 0 && `${pend.entradas_sin_trafico} sin tráfico`}
                  </span>
                ) : (
                  <span className="god-client-status god-client-status--ok">Activo</span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
