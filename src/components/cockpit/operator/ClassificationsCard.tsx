'use client'

import { useEffect, useState } from 'react'
import { IfThenCard } from '../shared/IfThenCard'

export function ClassificationsCard() {
  const [data, setData] = useState<{ pending: number; lowConfidence: number } | null>(null)

  useEffect(() => {
    fetch('/api/data?table=agent_decisions&limit=50&order_by=created_at&order_dir=desc')
      .then(r => r.json())
      .then(res => {
        const rows = (res.data || []) as Array<Record<string, unknown>>
        const pending = rows.filter(r => r.was_correct === null && r.trigger_type === 'classification').length
        const lowConf = rows.filter(r => r.was_correct === null && Number(r.confidence || 0) < 0.7).length
        setData({ pending, lowConfidence: lowConf })
      })
      .catch(() => setData({ pending: 0, lowConfidence: 0 }))
  }, [])

  if (!data) return null

  return (
    <IfThenCard
      id="operator-classifications"
      state={data.lowConfidence > 0 ? 'urgent' : data.pending > 0 ? 'active' : 'quiet'}
      title="Clasificaciones"
      activeCondition={data.pending > 0 ? `${data.pending} clasificación${data.pending !== 1 ? 'es' : ''} esperando tu voto` : undefined}
      activeAction={data.pending > 0 ? 'Revisar' : undefined}
      urgentCondition={data.lowConfidence > 0 ? `${data.lowConfidence} de baja confianza — revisar manualmente` : undefined}
      urgentAction={data.lowConfidence > 0 ? 'Revisar ahora' : undefined}
      actionHref="/clasificar"
      quietContent={
        <div style={{ fontSize: 13, color: '#8B949E' }}>
          {data.pending === 0 ? 'Todas las clasificaciones al corriente' : `${data.pending} pendiente${data.pending !== 1 ? 's' : ''}`}
        </div>
      }
    />
  )
}
