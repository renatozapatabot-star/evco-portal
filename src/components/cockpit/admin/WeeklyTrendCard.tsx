'use client'

import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'

interface Props {
  trend: AdminData['weeklyTrend']
}

export function WeeklyTrendCard({ trend }: Props) {
  const totalActions = trend.reduce((s, d) => s + d.actions, 0)
  const maxActions = Math.max(...trend.map(d => d.actions), 1)
  const todayActions = trend.length > 0 ? trend[trend.length - 1].actions : 0

  return (
    <IfThenCard
      id="admin-weekly-trend"
      state={totalActions === 0 ? 'quiet' : 'active'}
      title="Actividad semanal"
      activeCondition={totalActions > 0 ? `${totalActions} acciones esta semana · ${todayActions} hoy` : undefined}
      activeAction={totalActions > 0 ? 'Ver detalle' : undefined}
      actionHref="/acciones"
      quietContent={
        trend.length === 0 ? (
          <div style={{ padding: '8px 0', color: '#6E7681', fontSize: 'var(--aguila-fs-body)' }}>
            Sin actividad registrada
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
            {trend.map((d, i) => {
              const pct = (d.actions / maxActions) * 100
              const isToday = i === trend.length - 1
              return (
                <div key={d.day} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <div style={{
                    width: '100%', minHeight: 4,
                    height: `${Math.max(pct, 6)}%`,
                    background: isToday ? 'var(--portal-fg-1)' : 'rgba(192,197,206,0.3)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 300ms ease',
                  }} />
                  <span style={{
                    fontSize: 9, color: isToday ? 'var(--portal-fg-1)' : '#6E7681',
                    fontFamily: 'var(--font-jetbrains-mono)',
                    fontWeight: isToday ? 700 : 400,
                  }}>
                    {d.day}
                  </span>
                </div>
              )
            })}
          </div>
        )
      }
    />
  )
}
