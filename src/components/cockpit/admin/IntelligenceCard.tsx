'use client'

import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'

interface Props {
  intelligence: AdminData['intelligence']
}

export function IntelligenceCard({ intelligence }: Props) {
  const { riskAlerts, criticalAlerts, emailsToday, classificationsToday, otroRate } = intelligence

  const state = criticalAlerts > 0 ? 'urgent' as const
    : riskAlerts > 0 ? 'active' as const
    : 'quiet' as const

  return (
    <IfThenCard
      id="admin-intelligence"
      state={state}
      title="Inteligencia"
      activeCondition={riskAlerts > 0 ? `${riskAlerts} alerta${riskAlerts !== 1 ? 's' : ''} de riesgo activa${riskAlerts !== 1 ? 's' : ''}` : undefined}
      activeAction={riskAlerts > 0 ? 'Ver alertas' : undefined}
      urgentCondition={criticalAlerts > 0 ? `${criticalAlerts} alerta${criticalAlerts !== 1 ? 's' : ''} crítica${criticalAlerts !== 1 ? 's' : ''}` : undefined}
      urgentAction={criticalAlerts > 0 ? 'Resolver ahora' : undefined}
      actionHref="/riesgo-auditoria"
      quietContent={
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <Stat value={emailsToday} label="emails hoy" />
          <Stat value={classificationsToday} label="clasificaciones" />
          <Stat value={`${otroRate}%`} label="tasa OTRO" color={otroRate > 20 ? '#D97706' : '#8B949E'} />
          <Stat value={riskAlerts} label="alertas" color={riskAlerts > 0 ? '#D97706' : '#8B949E'} />
        </div>
      }
    />
  )
}

function Stat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: color || '#E6EDF3', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2 }}>{label}</div>
    </div>
  )
}
