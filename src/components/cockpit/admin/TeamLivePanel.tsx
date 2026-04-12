'use client'

import { useEffect, useState } from 'react'
import { IfThenCard } from '../shared/IfThenCard'

interface OperatorActivity {
  id: string
  name: string
  actionsToday: number
  lastAction: string | null
  lastActionType: string | null
}

export function TeamLivePanel() {
  const [operators, setOperators] = useState<OperatorActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/data?table=operators&limit=20')
      .then(r => r.json())
      .then(async (res) => {
        const ops = (res.data || []).filter((o: Record<string, unknown>) => o.active)

        // Fetch today's actions for each operator
        const today = new Date().toISOString().split('T')[0]
        const actionsRes = await fetch(`/api/data?table=operator_actions&limit=500&gte_field=created_at&gte_value=${today}T00:00:00&order_by=created_at&order_dir=desc`)
          .then(r => r.json()).catch(() => ({ data: [] }))
        const actions = actionsRes.data || []

        const opActivities: OperatorActivity[] = ops.map((op: Record<string, unknown>) => {
          const opActions = actions.filter((a: Record<string, unknown>) => a.operator_id === op.id)
          const lastAction = opActions[0] as Record<string, unknown> | undefined
          return {
            id: op.id as string,
            name: op.full_name as string,
            actionsToday: opActions.length,
            lastAction: lastAction?.created_at as string | null || null,
            lastActionType: lastAction?.action_type as string | null || null,
          }
        }).sort((a: OperatorActivity, b: OperatorActivity) => b.actionsToday - a.actionsToday)

        setOperators(opActivities)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const activeCount = operators.filter(o => o.actionsToday > 0).length
  const totalActions = operators.reduce((s, o) => s + o.actionsToday, 0)

  return (
    <IfThenCard
      id="admin-team-live"
      state={activeCount === 0 ? 'quiet' : 'active'}
      title="Equipo en vivo"
      activeCondition={activeCount > 0 ? `${activeCount} operador${activeCount !== 1 ? 'es' : ''} activo${activeCount !== 1 ? 's' : ''} · ${totalActions} acciones hoy` : undefined}
      activeAction={activeCount > 0 ? 'Ver actividad' : undefined}
      actionHref="/acciones"
      quietContent={
        loading ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Cargando equipo...
          </div>
        ) : operators.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Sin operadores registrados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {operators.map(op => {
              const isActive = op.actionsToday > 0
              const lastTime = op.lastAction
                ? new Date(op.lastAction).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })
                : null

              return (
                <div key={op.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 6,
                  background: isActive ? 'rgba(192,197,206,0.04)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isActive ? '#16A34A' : '#6E7681',
                      display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 13, color: '#E6EDF3', fontWeight: isActive ? 600 : 400 }}>
                      {op.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {op.actionsToday > 0 && (
                      <span className="font-mono" style={{ fontSize: 12, color: '#E8EAED', fontWeight: 600 }}>
                        {op.actionsToday}
                      </span>
                    )}
                    {lastTime && (
                      <span className="font-mono" style={{ fontSize: 11, color: '#6E7681' }}>
                        {lastTime}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    />
  )
}
