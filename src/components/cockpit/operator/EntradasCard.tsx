'use client'

import { useEffect, useState } from 'react'
import { IfThenCard } from '../shared/IfThenCard'

export function EntradasCard() {
  const [data, setData] = useState<{ total: number; sinTrafico: number } | null>(null)

  useEffect(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    fetch(`/api/data?table=entradas&limit=200&gte_field=fecha_llegada_mercancia&gte_value=${sevenDaysAgo}&order_by=fecha_llegada_mercancia&order_dir=desc`)
      .then(r => r.json())
      .then(res => {
        const rows = res.data || []
        const sinTrafico = rows.filter((r: Record<string, unknown>) => !r.trafico).length
        setData({ total: rows.length, sinTrafico })
      })
      .catch(() => setData({ total: 0, sinTrafico: 0 }))
  }, [])

  if (!data) return null

  return (
    <IfThenCard
      id="operator-entradas"
      state={data.sinTrafico > 0 ? 'active' : 'quiet'}
      title="Entradas recientes"
      activeCondition={data.sinTrafico > 0 ? `${data.sinTrafico} entrada${data.sinTrafico !== 1 ? 's' : ''} sin embarque asignado` : undefined}
      activeAction={data.sinTrafico > 0 ? 'Asignar' : undefined}
      actionHref="/entradas"
      quietContent={
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>{data.total}</span>
            <span style={{ fontSize: 'var(--aguila-fs-compact)', color: '#8B949E', marginLeft: 6 }}>esta semana</span>
          </div>
          {data.sinTrafico > 0 && (
            <div>
              <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--portal-status-amber-fg)' }}>{data.sinTrafico}</span>
              <span style={{ fontSize: 'var(--aguila-fs-compact)', color: '#8B949E', marginLeft: 6 }}>sin embarque</span>
            </div>
          )}
        </div>
      }
    />
  )
}
