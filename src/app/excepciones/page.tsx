'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Search, AlertTriangle, CheckCircle2, Clock, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { SeverityRibbon, type SeverityTone } from '@/components/aguila'

const SEVERITY_TONE: Record<ExceptionDiagnosis['severity'], SeverityTone> = {
  critical: 'critical',
  high: 'critical',
  medium: 'warning',
  low: 'healthy',
}

interface Hypothesis {
  rank: number
  hypothesis: string
  confidence: number
  evidence: string
}

interface ExceptionDiagnosis {
  id: string
  company_id: string
  trafico: string | null
  exception_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detected_at: string
  hypotheses: Hypothesis[]
  primary_hypothesis: string
  primary_confidence: number
  recommended_action: string | null
  recommended_action_type: string | null
  estimated_resolution_hours: number | null
  client_message_draft: string | null
  internal_message_draft: string | null
  context: Record<string, unknown> | null
  status: 'open' | 'monitoring' | 'resolved' | 'false_alarm'
  resolved_at: string | null
  hypothesis_correct: boolean | null
}

interface ResolvedItem {
  id: string
  trafico: string | null
  exception_type: string
  severity: string
  primary_hypothesis: string
  primary_confidence: number
  status: string
  resolved_at: string | null
  hypothesis_correct: boolean | null
  detected_at: string
}

interface ExceptionData {
  open: ExceptionDiagnosis[]
  resolved: ResolvedItem[]
  summary: {
    total_open: number
    critical: number
    high: number
    total_resolved: number
    accuracy: number | null
  }
}

const SEVERITY_CONFIG = {
  critical: { color: '#DC2626', bg: 'rgba(239,68,68,0.1)', border: '#FECACA', label: 'CRÍTICO' },
  high: { color: '#D97706', bg: 'rgba(192,197,206,0.08)', border: 'rgba(192,197,206,0.2)', label: 'ALTO' },
  medium: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'MEDIO' },
  low: { color: '#9CA3AF', bg: '#F9FAFB', border: '#F3F4F6', label: 'BAJO' },
} as const

const TYPE_LABELS: Record<string, string> = {
  delayed_crossing: 'Cruce demorado',
  overdue_document: 'Documento pendiente',
  stuck_trafico: 'Embarque detenido',
  value_anomaly: 'Anomalía de valor',
  reconocimiento: 'Reconocimiento',
}

export default function ExcepcionesPage() {
  const isMobile = useIsMobile()
  const [data, setData] = useState<ExceptionData | null>(null)
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetch('/api/exceptions')
      .then(r => r.json())
      .then(d => setData(d.data || null))
      .catch((err) => console.error('[excepciones] fetch failed:', err.message))
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
        <Search size={24} style={{ color: 'var(--gold)' }} />
        Inteligencia de Excepciones
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Diagnóstico automático de anomalías con hipótesis y acciones recomendadas
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 8 }} />)}
        </div>
      ) : !data || (data.open.length === 0 && data.resolved.length === 0) ? (
        <EmptyState
          icon="🔍"
          title="Sin excepciones"
          description="No hay anomalías detectadas. El sistema monitorea cada 15 minutos."
        />
      ) : (
        <>
          {/* KPI bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
            gap: 12, marginBottom: 24,
          }}>
            <KPICard label="Abiertas" value={data.summary.total_open} color={data.summary.total_open > 0 ? '#D97706' : '#16A34A'} />
            <KPICard label="Críticas" value={data.summary.critical} color={data.summary.critical > 0 ? '#DC2626' : '#16A34A'} />
            <KPICard label="Altas" value={data.summary.high} color={data.summary.high > 0 ? '#D97706' : '#6B7280'} />
            <KPICard label="Resueltas" value={data.summary.total_resolved} color="#16A34A" />
            <KPICard label="Precisión" value={data.summary.accuracy != null ? `${data.summary.accuracy}%` : '—'} color="var(--gold-dark)" />
          </div>

          {/* Open exceptions */}
          {data.open.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gold-dark)', marginBottom: 12 }}>
                Excepciones abiertas ({data.open.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {data.open.map(ex => <ExceptionCard key={ex.id} exception={ex} isMobile={isMobile} />)}
              </div>
            </>
          )}

          {/* Resolved */}
          {data.resolved.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
                Resueltas recientes ({data.resolved.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.resolved.slice(0, 10).map(r => (
                  <div key={r.id} style={{
                    padding: '10px 16px', borderRadius: 8,
                    background: 'var(--bg-main)', border: '1px solid var(--border)', opacity: 0.7,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={12} style={{ color: '#16A34A', display: 'inline', marginRight: 4 }} />
                        {r.trafico || '—'} · {TYPE_LABELS[r.exception_type] || r.exception_type}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {r.resolved_at ? fmtDate(r.resolved_at) : '—'}
                        {r.hypothesis_correct !== null && (
                          <span style={{ marginLeft: 8, color: r.hypothesis_correct ? '#16A34A' : '#DC2626' }}>
                            {r.hypothesis_correct ? '✓ correcta' : '✗ incorrecta'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</div>
    </div>
  )
}

function ExceptionCard({ exception: ex, isMobile }: { exception: ExceptionDiagnosis; isMobile: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const sev = SEVERITY_CONFIG[ex.severity]
  const hoursSince = Math.round((Date.now() - new Date(ex.detected_at).getTime()) / 3600000)

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: `1px solid ${sev.border}`,
      background: sev.bg,
      position: 'relative',
    }}>
      <SeverityRibbon tone={SEVERITY_TONE[ex.severity]} />
      {/* Main row */}
      <div
        style={{ padding: '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <AlertTriangle size={14} style={{ color: sev.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {TYPE_LABELS[ex.exception_type] || ex.exception_type}
              </span>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                background: sev.color, color: '#FFF', fontWeight: 700,
              }}>
                {sev.label}
              </span>
              {ex.trafico && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {ex.trafico}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {ex.primary_hypothesis}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 70 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: sev.color }}>
              {Math.round(ex.primary_confidence * 100)}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {hoursSince}h
            </div>
            {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginTop: 4 }} />}
          </div>
        </div>

        {/* Action preview */}
        {ex.recommended_action && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 6,
            background: 'rgba(255,255,255,0.6)', fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
            {ex.recommended_action}
            {ex.estimated_resolution_hours && (
              <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
                ~{ex.estimated_resolution_hours}h
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded: all hypotheses + drafts */}
      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${sev.border}` }}>
          {/* All hypotheses */}
          {ex.hypotheses.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Hipótesis ({ex.hypotheses.length})
              </div>
              {ex.hypotheses.map((h, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 6, marginBottom: 4,
                  background: i === 0 ? 'rgba(255,255,255,0.8)' : 'transparent',
                  border: i === 0 ? `1px solid ${sev.border}` : 'none',
                  fontSize: 11,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>
                      H{h.rank}: {h.hypothesis}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: sev.color, fontWeight: 600, marginLeft: 8, whiteSpace: 'nowrap' }}>
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Evidencia: {h.evidence}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Context */}
          {ex.context && Object.keys(ex.context).length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {Object.entries(ex.context).map(([k, v]) => (
                <span key={k} style={{ marginRight: 12 }}>{k}: {String(v)}</span>
              ))}
            </div>
          )}

          {/* Detected time */}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            Detectado: {fmtDateTime(ex.detected_at)}
          </div>
        </div>
      )}
    </div>
  )
}
