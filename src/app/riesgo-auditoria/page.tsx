'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface FactorScore {
  score: number
  detail: string
  [key: string]: unknown
}

interface Recommendation {
  priority: number
  action: string
  rationale: string
}

interface Assessment {
  id: string
  company_id: string
  assessment_date: string
  risk_score: number
  risk_level: 'low' | 'moderate' | 'elevated' | 'high'
  risk_trend: 'improving' | 'stable' | 'worsening'
  factor_reconocimiento: FactorScore | null
  factor_value_anomalies: FactorScore | null
  factor_doc_completeness: FactorScore | null
  factor_mve_compliance: FactorScore | null
  factor_network_signals: FactorScore | null
  estimated_audit_probability: number | null
  estimated_penalty_range_low: number | null
  estimated_penalty_range_high: number | null
  predicted_audit_window: string | null
  recommendations: Recommendation[] | null
}

const RISK_COLORS = {
  low: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'BAJO' },
  moderate: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'MODERADO' },
  elevated: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'ELEVADO' },
  high: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'ALTO' },
} as const

const TREND_ICONS = {
  improving: { Icon: TrendingDown, color: '#16A34A', label: 'Mejorando' },
  stable: { Icon: Minus, color: '#6B7280', label: 'Estable' },
  worsening: { Icon: TrendingUp, color: '#DC2626', label: 'Empeorando' },
} as const

export default function RiesgoAuditoriaPage() {
  const isMobile = useIsMobile()
  const [current, setCurrent] = useState<Assessment | null>(null)
  const [history, setHistory] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/audit-risk')
      .then(r => r.json())
      .then(d => {
        setCurrent(d.data?.current || null)
        setHistory(d.data?.history || [])
      })
      .catch((err) => console.error('[riesgo-auditoria] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Shield size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ padding: isMobile ? '16px' : undefined }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, fontSize: isMobile ? 20 : undefined }}>
        <Shield size={24} style={{ color: 'var(--gold)' }} />
        Riesgo de Auditoría SAT
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Evaluación semanal de probabilidad de auditoría — 5 factores de riesgo
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 8 }} />)}
        </div>
      ) : !current ? (
        <EmptyState
          icon="🛡️"
          title="Sin evaluación"
          description="La evaluación de riesgo se genera semanalmente. Aún no hay datos."
        />
      ) : (
        <>
          {/* Main risk gauge */}
          <RiskGauge assessment={current} isMobile={isMobile} />

          {/* Factor breakdown */}
          <div style={{ marginTop: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
              Factores de Riesgo (cada uno 0-20)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FactorBar label="Reconocimientos" factor={current.factor_reconocimiento} />
              <FactorBar label="Valores atípicos" factor={current.factor_value_anomalies} />
              <FactorBar label="Documentación" factor={current.factor_doc_completeness} />
              <FactorBar label="MVE" factor={current.factor_mve_compliance} />
              <FactorBar label="Señales de red" factor={current.factor_network_signals} />
            </div>
          </div>

          {/* Recommendations */}
          {current.recommendations && current.recommendations.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
                Recomendaciones
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {current.recommendations.map((r, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {r.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History trend */}
          {history.length > 1 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
                Historial ({history.length} evaluaciones)
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60, padding: '0 4px' }}>
                {history.slice(0, 12).reverse().map((h, i) => {
                  const risk = RISK_COLORS[h.risk_level]
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', borderRadius: 3,
                        background: risk.color,
                        height: `${Math.max(4, h.risk_score * 0.6)}px`,
                        opacity: 0.7,
                      }} />
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {h.risk_score}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RiskGauge({ assessment: a, isMobile }: { assessment: Assessment; isMobile: boolean }) {
  const risk = RISK_COLORS[a.risk_level]
  const trend = TREND_ICONS[a.risk_trend]
  const TrendIcon = trend.Icon

  return (
    <div style={{
      padding: isMobile ? '16px' : '24px', borderRadius: 12,
      background: risk.bg, border: `1px solid ${risk.border}`,
      borderLeft: `4px solid ${risk.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        {/* Score */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 42, fontWeight: 800, fontFamily: 'var(--font-mono)', color: risk.color }}>
              {a.risk_score}
            </span>
            <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/100</span>
            <span style={{
              fontSize: 11, padding: '2px 10px', borderRadius: 4,
              background: risk.color, color: '#FFF', fontWeight: 700,
            }}>
              {risk.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendIcon size={14} style={{ color: trend.color }} />
            <span style={{ fontSize: 12, color: trend.color, fontWeight: 500 }}>{trend.label}</span>
          </div>
        </div>

        {/* Probability + window */}
        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
          {a.estimated_audit_probability != null && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Probabilidad auditoría: <strong style={{ fontFamily: 'var(--font-mono)', color: risk.color }}>
                {a.estimated_audit_probability}%
              </strong>
            </div>
          )}
          {a.predicted_audit_window && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {a.predicted_audit_window}
            </div>
          )}
          {a.estimated_penalty_range_high != null && a.estimated_penalty_range_high > 0 && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4 }}>
              Rango penalización: ${a.estimated_penalty_range_low?.toLocaleString('es-MX')} — ${a.estimated_penalty_range_high?.toLocaleString('es-MX')} MXN
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Evaluado: {fmtDate(a.assessment_date)}
          </div>
        </div>
      </div>
    </div>
  )
}

function FactorBar({ label, factor }: { label: string; factor: FactorScore | null }) {
  if (!factor) return null
  const pct = (factor.score / 20) * 100
  const color = factor.score >= 14 ? '#DC2626' : factor.score >= 8 ? '#D97706' : factor.score >= 4 ? '#6B7280' : '#16A34A'

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
          {factor.score}/20
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        {factor.detail}
      </div>
    </div>
  )
}
