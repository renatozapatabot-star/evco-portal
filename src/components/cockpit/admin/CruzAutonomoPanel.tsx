'use client'

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

export function AduanaAutonomoPanel({ decisions, decisions30d, decisionsAllTime, workflow, workflow30d, actions, actions30d }: Props) {
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
        ? 'rgba(201,168,76,0.4)' // gold/neutral when no data
        : 'rgba(220,38,38,0.7)'

  return (
    <div style={{
      background: '#222222',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: `3px solid ${urgencyColor}`,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: '#6E7681',
        }}>
          ADUANA Autónomo
        </span>
        <p style={{ fontSize: 13, color: '#8B949E', margin: '4px 0 0' }}>
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
              <div style={{
                background: count > 0 ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${count > 0 ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                padding: '6px 10px',
                textAlign: 'center' as const,
                minWidth: 60,
              }}>
                <div className="font-mono" style={{
                  fontSize: 16, fontWeight: 700,
                  color: count > 0 ? '#C9A84C' : '#6E7681',
                }}>
                  {count}
                </div>
                <div style={{
                  fontSize: 10, color: '#8B949E',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}>
                  {STAGE_LABELS[stage]}
                </div>
              </div>
              {i < WORKFLOW_STAGES.length - 1 && (
                <span style={{ color: '#6E7681', fontSize: 12 }}>→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* 30d workflow total if available */}
      {workflow30d.total > 0 && (
        <div style={{ fontSize: 11, color: '#6E7681', textAlign: 'right', marginTop: 4 }}>
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
        fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#6E7681', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
