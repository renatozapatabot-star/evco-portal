'use client'

import Link from 'next/link'
import type { AdminData } from '../shared/fetchCockpitData'

const WORKFLOW_STAGES = ['intake', 'classify', 'docs', 'pedimento', 'crossing', 'post_op', 'invoice']
const STAGE_LABELS: Record<string, string> = {
  intake: 'Recepción',
  classify: 'Clasificación',
  docs: 'Documentos',
  pedimento: 'Pedimento',
  crossing: 'Cruce',
  post_op: 'Post-Op',
  invoice: 'Facturación',
}

interface Props {
  decisions: AdminData['agentDecisions24h']
  decisions30d: AdminData['agentDecisions30d']
  decisionsAllTime: AdminData['agentDecisionsAllTime']
  workflow: AdminData['workflowEvents24h']
  workflow30d: AdminData['workflowEvents30d']
  actions: AdminData['operatorActions24h']
  actions30d: AdminData['operatorActions30d']
}

export function AguilaAutonomoPanel({ decisions, decisions30d, decisionsAllTime, workflow, workflow30d, actions, actions30d }: Props) {
  // Use 30d metrics when 24h is zero for a less empty-looking dashboard
  const showDecisions = decisions.total > 0 ? decisions : decisions30d
  const showActions = actions.total > 0 ? actions : actions30d
  const period = decisions.total > 0 ? 'hoy' : '30 días'
  const actionPeriod = actions.total > 0 ? 'hoy' : '30 días'

  const urgencyColor = showDecisions.accuracy >= 90
    ? 'rgba(22,163,74,0.5)'
    : showDecisions.accuracy >= 70
      ? 'rgba(217,119,6,0.6)'
      : showDecisions.total === 0
        ? 'rgba(192,197,206,0.4)' // gold/neutral when no data
        : 'rgba(220,38,38,0.7)'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: `3px solid ${urgencyColor}`,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--portal-fg-5)',
        }}>
          PORTAL Autónomo
        </span>
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', margin: '4px 0 0' }}>
          {decisions.total > 0
            ? 'La IA está trabajando'
            : decisionsAllTime.total > 0
              ? `${decisionsAllTime.total.toLocaleString('es-MX')} decisiones desde lanzamiento`
              : 'Sistema listo — esperando actividad'
          }
        </p>
      </div>

      {/* KPIs row */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <KPI
          value={showDecisions.total}
          label={`decisiones · ${period}`}
          sub={decisions.total === 0 && decisionsAllTime.total > 0
            ? `${decisionsAllTime.total} total`
            : undefined
          }
        />
        <KPI
          value={showDecisions.total > 0 ? `${showDecisions.accuracy}%` : '—'}
          label="precisión"
          sub={showDecisions.total > 0 ? `${showDecisions.correct} correctas` : undefined}
        />
        <KPI
          value={showActions.hoursSaved}
          label={`horas ahorradas · ${actionPeriod}`}
        />
      </div>

      {/* Workflow chain — show 30d counts if 24h is empty */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {WORKFLOW_STAGES.map((stage, i) => {
          const count = workflow.byStage[stage] || 0
          return (
            <div key={stage} style={{
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Link
                href={`/admin/pipeline/${stage}`}
                aria-label={`Ver eventos recientes de ${STAGE_LABELS[stage]}`}
                className="pipeline-stage-link"
                style={{
                  background: count > 0 ? 'rgba(192,197,206,0.08)' : 'rgba(255,255,255,0.045)',
                  border: `1px solid ${count > 0 ? 'rgba(192,197,206,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  textAlign: 'center' as const,
                  minWidth: 60,
                  minHeight: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  transition: 'border-color 180ms ease, background 180ms ease',
                }}
              >
                <div className="font-mono" style={{
                  fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700,
                  color: count > 0 ? 'var(--portal-fg-1)' : 'var(--portal-fg-5)',
                }}>
                  {count}
                </div>
                <div style={{
                  fontSize: 'var(--aguila-fs-label)', color: 'var(--portal-fg-4)',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  {STAGE_LABELS[stage]}
                </div>
              </Link>
              {i < WORKFLOW_STAGES.length - 1 && (
                <span style={{ color: 'var(--portal-fg-5)', fontSize: 'var(--aguila-fs-compact)' }}>→</span>
              )}
            </div>
          )
        })}
        <style jsx>{`
          :global(.pipeline-stage-link:hover) {
            background: rgba(192,197,206,0.14) !important;
            border-color: rgba(192,197,206,0.35) !important;
          }
          :global(.pipeline-stage-link:focus-visible) {
            outline: 2px solid #C0C5CE;
            outline-offset: 2px;
          }
        `}</style>
      </div>

      {/* 30d workflow total if available */}
      {workflow30d.total > 0 && (
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', textAlign: 'right', marginTop: 4 }}>
          {workflow30d.total.toLocaleString('es-MX')} eventos en 30 días
        </div>
      )}
    </div>
  )
}

function KPI({ value, label, sub }: { value: number | string; label: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono" style={{
        fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: 'var(--portal-fg-1)', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
