'use client'

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

interface Decision {
  id: number
  trafico: string | null
  company_id: string | null
  decision_type: string
  decision: string
  reasoning: string | null
  outcome: string | null
  outcome_score: number | null
  created_at: string
}

interface Pattern {
  id: number
  pattern_type: string
  pattern_key: string
  pattern_value: string
  confidence: number | null
  sample_size: number | null
  active: boolean
  last_confirmed: string | null
}

interface Assumption {
  id: number
  assumption: string
  category: string | null
  still_valid: boolean | null
  recommendation: string | null
  checked_at: string
}

const T = {
  gold: 'var(--gold)',
  goldDark: 'var(--gold-dark)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  border: 'var(--border)',
  card: 'var(--bg-card)',
  success: 'var(--success)',
  warning: 'var(--warning-500, #D97706)',
  danger: 'var(--danger-500)',
}

export default function CerebroPage() {
  const isMobile = useIsMobile()
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [loading, setLoading] = useState(true)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }

    Promise.all([
      fetch('/api/data?table=operational_decisions&limit=50&order_by=created_at&order_dir=desc').then(r => r.json()),
      fetch('/api/data?table=learned_patterns&limit=100&order_by=confidence&order_dir=desc').then(r => r.json()),
      fetch('/api/data?table=assumption_audit&limit=20&order_by=checked_at&order_dir=desc').then(r => r.json()),
    ]).then(([decData, patData, assData]) => {
      setDecisions(decData.data || [])
      setPatterns((patData.data || []).filter((p: Pattern) => p.active))
      setAssumptions(assData.data || [])
    }).catch((err) => console.error('[cerebro] fetch failed:', err.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Brain size={48} style={{ color: T.textMuted, marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Acceso restringido</div>
      </div>
    )
  }

  const scoredDecisions = decisions.filter(d => d.outcome_score !== null)
  const avgScore = scoredDecisions.length > 0
    ? Math.round(scoredDecisions.reduce((s, d) => s + (d.outcome_score || 0), 0) / scoredDecisions.length)
    : 0
  const flaggedAssumptions = assumptions.filter(a => a.still_valid === false)

  return (
    <div className="page-shell">
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Brain size={24} style={{ color: T.gold }} />
        AGUILA Operational Brain
      </h1>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 24 }}>
        {patterns.length} patrones activos · {decisions.length} decisiones recientes · Score promedio: {avgScore}/100
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : (
        <>
          {/* Section 1 — KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Patrones activos', value: patterns.length, color: T.gold },
              { label: 'Decisiones (30d)', value: decisions.length, color: T.success },
              { label: 'Score promedio', value: avgScore + '/100', color: avgScore >= 80 ? T.success : T.warning },
              { label: 'Supuestos flagged', value: flaggedAssumptions.length, color: flaggedAssumptions.length === 0 ? T.success : T.danger },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Section 2 — Decision Timeline */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, marginBottom: 12 }}>
              Decisiones Recientes
            </div>
            {decisions.length === 0 ? (
              <EmptyState icon="🧠" title="Sin decisiones recientes" description="Las decisiones autónomas aparecerán aquí." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decisions.slice(0, 15).map(d => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 8, background: 'var(--bg-main)',
                  }}>
                    <span style={{ fontSize: 14, marginTop: 1 }}>
                      {d.outcome === 'excellent' ? '✅' : d.outcome === 'needs_improvement' ? '⚠️' : '🔄'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.decision}</div>
                      {d.reasoning && <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{d.reasoning.substring(0, 100)}</div>}
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                        {d.decision_type} · {d.company_id || '—'} · {d.trafico || '—'}
                      </div>
                    </div>
                    {d.outcome_score !== null && (
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: d.outcome_score >= 80 ? T.success : d.outcome_score >= 60 ? T.warning : T.danger,
                      }}>
                        {d.outcome_score}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(d.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3 — Active Patterns */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textMuted, marginBottom: 12 }}>
              Patrones Aprendidos ({patterns.length})
            </div>
            {patterns.length === 0 ? (
              <EmptyState icon="📊" title="Sin patrones" description="AGUILA aprenderá patrones conforme opere." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {patterns.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: `1px solid ${T.border}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, color: T.text }}>{p.pattern_value}</span>
                      <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 8 }}>{p.pattern_type}</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: (p.confidence || 0) >= 0.9 ? T.success : T.warning }}>
                      {Math.round((p.confidence || 0) * 100)}% · {p.sample_size || 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4 — Flagged Assumptions */}
          {flaggedAssumptions.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.danger, marginBottom: 12 }}>
                Supuestos Cuestionados ({flaggedAssumptions.length})
              </div>
              {flaggedAssumptions.map(a => (
                <div key={a.id} style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                  background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.assumption}</div>
                  {a.recommendation && <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>→ {a.recommendation}</div>}
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>{a.category} · {fmtDateTime(a.checked_at)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
