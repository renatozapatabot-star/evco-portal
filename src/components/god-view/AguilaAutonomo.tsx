'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bot } from 'lucide-react'
import type { OpsCenterData } from '@/hooks/use-god-view-data'
import { useIsMobile } from '@/hooks/use-mobile'

interface Props {
  opsCenter: OpsCenterData | null
  agentDecisions24h: number
  agentAccuracy: number
  error?: string
}

const WORKFLOW_STEPS = [
  { key: 'intake', label: 'Intake' },
  { key: 'classify', label: 'Clasificar' },
  { key: 'docs', label: 'Docs' },
  { key: 'pedimento', label: 'Pedimento' },
  { key: 'crossing', label: 'Cruce' },
  { key: 'post_op', label: 'Post-op' },
  { key: 'invoice', label: 'Factura' },
]

export function AguilaAutonomo({ opsCenter, agentDecisions24h, agentAccuracy, error }: Props) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(!isMobile)

  if (error && !opsCenter) {
    return (
      <div className="god-section">
        <h2 className="god-section-title">
          <Bot size={16} /> ZAPATA AI Autónomo
        </h2>
        <div className="god-empty">Sin datos del agente</div>
      </div>
    )
  }

  const corrections = opsCenter?.recentLearnings ?? []
  const accuracy = agentAccuracy > 0 ? agentAccuracy : opsCenter?.accuracyCurrent ?? 0

  return (
    <div className="god-section">
      <button
        className="god-section-header god-section-header--toggle"
        onClick={() => setExpanded(v => !v)}
        type="button"
      >
        <h2 className="god-section-title">
          <span className="god-pulse-dot" />
          ZAPATA AI Autónomo
        </h2>
        <div className="god-autonomo-summary">
          <span className="font-mono god-autonomo-stat">
            {agentDecisions24h} decisiones
          </span>
          {accuracy > 0 && (
            <span className="font-mono god-autonomo-stat god-autonomo-stat--accent">
              {accuracy}% precisión
            </span>
          )}
          {isMobile && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      </button>

      {expanded && (
        <div className="god-autonomo-body">
          {/* Workflow chain */}
          <div className="god-workflow-chain">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.key} className="god-workflow-step">
                <div className="god-workflow-node" />
                <span className="god-workflow-label">{step.label}</span>
                {i < WORKFLOW_STEPS.length - 1 && <div className="god-workflow-connector" />}
              </div>
            ))}
          </div>

          {/* Ops metrics row */}
          <div className="god-autonomo-metrics">
            <div className="god-metric-mini">
              <span className="god-metric-mini-value font-mono">{opsCenter?.autoProcessedToday ?? 0}</span>
              <span className="god-metric-mini-label">Auto-procesados</span>
            </div>
            <div className="god-metric-mini">
              <span className="god-metric-mini-value font-mono">{opsCenter?.pendingClassifications ?? 0}</span>
              <span className="god-metric-mini-label">Clasificaciones pendientes</span>
            </div>
            <div className="god-metric-mini">
              <span className="god-metric-mini-value font-mono">{opsCenter?.correctionsThisWeek ?? 0}</span>
              <span className="god-metric-mini-label">Correcciones semana</span>
            </div>
          </div>

          {/* Recent corrections */}
          {corrections.length > 0 && (
            <div className="god-corrections">
              <div className="god-corrections-title">Últimas correcciones</div>
              {corrections.slice(0, 3).map((c, i) => (
                <div key={i} className="god-correction-row">
                  <span className="god-correction-old">{c.original}</span>
                  <span className="god-correction-arrow">&rarr;</span>
                  <span className="god-correction-new">{c.corrected}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
