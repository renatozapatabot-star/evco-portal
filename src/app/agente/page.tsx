'use client'

import { useEffect, useState } from 'react'
import { Bot, Activity, CheckCircle, AlertTriangle, Pause, Play } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateTime } from '@/lib/format-utils'
import { WORKFLOWS, LEVEL_NAMES, LEVEL_ICONS } from '@/lib/agent-workflows'

interface Decision {
  id: number
  cycle_id: string
  trigger_type: string
  trigger_id: string | null
  company_id: string | null
  decision: string
  confidence: number | null
  autonomy_level: number
  action_taken: string | null
  was_correct: boolean | null
  created_at: string
}

interface AgentStats {
  total: number
  autonomous: number
  pending: number
  accuracy: number
}

export default function AgentePage() {
  const isMobile = useIsMobile()
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [stats, setStats] = useState<AgentStats>({ total: 0, autonomous: 0, pending: 0, accuracy: 0 })
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)

  const role = getCookieValue('user_role')
  const isAdmin = role === 'admin' || role === 'broker'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }

    fetch('/api/data?table=agent_decisions&limit=50&order_by=created_at&order_dir=desc')
      .then(r => r.json())
      .then(data => {
        const rows = (data.data || []) as Decision[]
        setDecisions(rows)

        const total = rows.length
        const autonomous = rows.filter(d => d.autonomy_level >= 2).length
        const pending = rows.filter(d => d.autonomy_level === 1 && d.was_correct === null).length
        const reviewed = rows.filter(d => d.was_correct !== null)
        const correct = reviewed.filter(d => d.was_correct).length
        const accuracy = reviewed.length > 0 ? Math.round((correct / reviewed.length) * 1000) / 10 : 0

        setStats({ total, autonomous, pending, accuracy })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="page-shell" style={{ textAlign: 'center', padding: 60 }}>
        <Bot size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Acceso restringido</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Panel de agente disponible solo para operadores.</div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={24} style={{ color: 'var(--gold)' }} />
            CRUZ Agent
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {paused ? '⏸️ Pausado' : '🟢 Activo'} · Ciclo cada 5 min · Lun-Sáb 6 AM - 10 PM
          </p>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={paused ? 'Reanudar agente' : 'Pausar agente'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', minHeight: 44, borderRadius: 10,
            background: paused ? 'var(--success)' : 'var(--warning-500)',
            color: 'var(--bg-card)', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
          {paused ? 'Reanudar' : 'Pausar'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Decisiones', value: stats.total, color: 'var(--gold)' },
          { label: 'Autónomas', value: stats.autonomous, color: 'var(--success)' },
          { label: 'Pendientes', value: stats.pending, color: 'var(--warning-500)' },
          { label: 'Precisión', value: stats.accuracy + '%', color: 'var(--info)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Workflow autonomy levels */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Nivel de Autonomía por Workflow
        </div>
        {WORKFLOWS.map(w => (
          <div key={w.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{w.trigger}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {LEVEL_ICONS[w.defaultAutonomy]} {LEVEL_NAMES[w.defaultAutonomy]}
            </span>
          </div>
        ))}
      </div>

      {/* Recent decisions */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12 }}>
          Decisiones Recientes
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : decisions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bot size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>Sin decisiones registradas aún</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>El agente empezará a registrar cuando se active el cron.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {decisions.slice(0, 20).map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: d.was_correct === false ? 'rgba(220,38,38,0.04)' : 'var(--bg-main)',
              }}>
                <span style={{ fontSize: 14, marginTop: 1 }}>
                  {d.autonomy_level >= 2 ? '🟢' : d.autonomy_level === 1 ? '🟡' : '⬜'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {d.decision.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {d.trigger_type} · {d.company_id || '—'} · {d.confidence !== null ? d.confidence + '% conf' : '—'}
                  </div>
                  {d.action_taken && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      → {d.action_taken}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {new Date(d.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
