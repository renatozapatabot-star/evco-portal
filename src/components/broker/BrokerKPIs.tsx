'use client'

import { fmtDateCompact } from '@/lib/format-utils'
import { type OpsMetrics, type StaffConfig } from '@/lib/ops-roles'

const T = {
  card: 'var(--card-bg)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--status-green)',
  amber: 'var(--gold-700)',
  red: 'var(--status-red)',
} as const

interface BrokerKPIsProps {
  staffConfig: StaffConfig
  opsMetrics: OpsMetrics
}

export function BrokerKPIs({ staffConfig, opsMetrics }: BrokerKPIsProps) {
  return (
    <>
      {/* Role-specific cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16, marginBottom: 32,
      }}>
        {staffConfig.role === 'director' && (
          <>
            <OpsCard title="Excepciones" value={String(opsMetrics.exceptionsToday)} sub="Requieren revision" accent={opsMetrics.exceptionsToday > 0 ? T.amber : T.green} />
            <OpsCard title="Auto-procesadas" value={String(opsMetrics.autoProcessedToday)} sub="Hoy sin intervencion" accent={T.green} />
            <OpsCard title="Clientes en riesgo" value={String(opsMetrics.clientsAtRisk.length)} sub="7+ dias sin actividad" accent={opsMetrics.clientsAtRisk.length > 0 ? T.red : T.green} />
          </>
        )}
        {staffConfig.role === 'classifier' && (
          <>
            <OpsCard title="Pendientes" value={String(opsMetrics.pendingClassifications)} sub="Clasificaciones por revisar" accent={opsMetrics.pendingClassifications > 0 ? T.amber : T.green} />
            <OpsCard title="Precision" value={`${Math.round(opsMetrics.accuracyCurrent * 100)}%`} sub="Ultimas 30 clasificaciones" accent={opsMetrics.accuracyCurrent >= 0.9 ? T.green : T.amber} />
            <OpsCard title="Correcciones" value={String(opsMetrics.correctionsThisWeek)} sub="Esta semana" accent={T.gold} />
          </>
        )}
        {staffConfig.role === 'coordinator' && (
          <>
            <OpsCard title="Escalaciones" value={String(opsMetrics.pendingEscalations)} sub="Documentos vencidos" accent={opsMetrics.pendingEscalations > 0 ? T.red : T.green} />
            <OpsCard title="Clientes activos" value={`${opsMetrics.activeClients7d}/${opsMetrics.totalClients}`} sub="Últimos 7 días" accent={T.green} />
            <OpsCard title="Correos hoy" value={String(opsMetrics.emailsProcessedToday)} sub="Procesados automáticamente" accent={T.gold} />
          </>
        )}
      </div>

      {/* Learnings (classifier only) */}
      {staffConfig.role === 'classifier' && opsMetrics.recentLearnings.length > 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 20, marginBottom: 32,
        }}>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, marginBottom: 12 }}>
            Lo que ZAPATA AI aprendió esta semana
          </div>
          {opsMetrics.recentLearnings.map((l, i) => (
            <div key={i} style={{
              padding: '8px 0', borderBottom: i < opsMetrics.recentLearnings.length - 1 ? `1px solid ${T.border}` : 'none',
              fontSize: 'var(--aguila-fs-body)', color: T.text,
            }}>
              <span style={{ color: T.red, textDecoration: 'line-through' }}>{l.original}</span>
              {' \u2192 '}
              <span style={{ color: T.green, fontWeight: 600 }}>{l.corrected}</span>
              <span style={{ fontSize: 'var(--aguila-fs-meta)', color: T.textMuted, marginLeft: 8, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {fmtDateCompact(l.date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Inactive clients (coordinator only) */}
      {staffConfig.role === 'coordinator' && opsMetrics.inactiveClients.length > 0 && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 20, marginBottom: 32,
        }}>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, marginBottom: 12 }}>
            Clientes sin actividad (7+ dias)
          </div>
          {opsMetrics.inactiveClients.map(c => (
            <div key={c.company_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: T.text }}>{c.name}</span>
              <span style={{ fontSize: 'var(--aguila-fs-meta)', color: T.amber, fontFamily: 'var(--font-jetbrains-mono)' }}>
                {c.daysSinceActivity}+ dias
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function OpsCard({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)', border: `1px solid var(--border)`, borderRadius: 8,
      borderTop: `3px solid ${accent}`, padding: 16,
    }}>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}
