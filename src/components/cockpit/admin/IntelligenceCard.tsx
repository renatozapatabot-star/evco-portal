'use client'

import type { AdminData } from '../shared/fetchCockpitData'
import { IfThenCard } from '../shared/IfThenCard'
import { AduanaRecommendation } from '../shared/CruzRecommendation'

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
          <Stat value={`${otroRate}%`} label="tasa OTRO" color={otroRate > 20 ? 'var(--portal-status-amber-fg)' : 'var(--portal-fg-4)'} />
          <Stat value={riskAlerts} label="alertas" color={riskAlerts > 0 ? 'var(--portal-status-amber-fg)' : 'var(--portal-fg-4)'} />
        </div>
      }
      footer={riskAlerts > 0 || otroRate > 15 ? (
        <AduanaRecommendation
          compact
          recommendation={criticalAlerts > 0
            ? `${criticalAlerts} alerta${criticalAlerts !== 1 ? 's' : ''} crítica${criticalAlerts !== 1 ? 's' : ''} — intervenir`
            : otroRate > 15
              ? `Tasa OTRO al ${otroRate}% — revisar clasificaciones`
              : `${riskAlerts} señal${riskAlerts !== 1 ? 'es' : ''} de riesgo activa${riskAlerts !== 1 ? 's' : ''}`
          }
          confidence={criticalAlerts > 0 ? 60 : 78}
          approveLabel={criticalAlerts > 0 ? 'Resolver' : 'Revisar'}
          approveHref="/riesgo-auditoria"
        />
      ) : undefined}
    />
  )
}

function Stat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: color || 'var(--portal-fg-1)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-4)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
