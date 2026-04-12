'use client'

import Link from 'next/link'
import { Brain, AlertTriangle, TrendingUp, Zap } from 'lucide-react'
import type { ClientInsight } from '@/components/cockpit/shared/fetchCockpitData'

interface Props {
  computedInsights: ClientInsight[]
  activeShipments: number
  cruzadosYTD: number
  entradasThisMonth: number
}

const severityAccent: Record<ClientInsight['severity'], string> = {
  critical: '#EF4444',
  warning: '#FBBF24',
  info: '#00E5FF',
}

const typeIcon: Record<ClientInsight['type'], typeof AlertTriangle> = {
  anomaly: AlertTriangle,
  positive: TrendingUp,
  action: Zap,
}

export function IntelligencePanel({ computedInsights, activeShipments, cruzadosYTD, entradasThisMonth }: Props) {
  // Contextual header based on most critical insight
  const hasCritical = computedInsights.some(i => i.severity === 'critical')
  const hasWarning = computedInsights.some(i => i.severity === 'warning')
  const headerLabel = hasCritical ? 'Requiere atención' : hasWarning ? 'Pendientes' : 'Estado de operaciones'
  const headerColor = hasCritical ? '#EF4444' : hasWarning ? '#FBBF24' : '#00E5FF'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      {/* Contextual header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
      }}>
        <Brain size={16} color={headerColor} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: headerColor,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {headerLabel}
        </span>
      </div>

      {/* Insights */}
      {computedInsights.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {computedInsights.map((insight, i) => {
            const Icon = typeIcon[insight.type]
            const accentColor = severityAccent[insight.severity]
            const content = (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  borderLeft: `3px solid ${accentColor}`,
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '0 8px 8px 0',
                }}
              >
                <Icon size={14} color={accentColor} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{
                  fontSize: 13, color: '#E6EDF3', lineHeight: 1.5,
                  fontWeight: insight.severity === 'critical' ? 600 : 400,
                }}>
                  {insight.text}
                </span>
              </div>
            )
            if (insight.entityLink) {
              return (
                <Link key={i} href={insight.entityLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {content}
                </Link>
              )
            }
            return content
          })}
        </div>
      ) : (
        <p style={{
          fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 16px',
        }}>
          {activeShipments > 0 ? (
            <>
              {activeShipments} operación{activeShipments !== 1 ? 'es' : ''} en proceso
              {cruzadosYTD > 0 && (
                <>, {cruzadosYTD} cruzado{cruzadosYTD !== 1 ? 's' : ''} en {new Date().getFullYear()}</>
              )}
              {entradasThisMonth > 0 && (
                <>, {entradasThisMonth} entrada{entradasThisMonth !== 1 ? 's' : ''} este mes</>
              )}
              . Todo en orden.
            </>
          ) : (
            'Sin operaciones activas. ADUANA está lista para responder sus preguntas.'
          )}
        </p>
      )}

    </div>
  )
}
