'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface AnomalyRow {
  id: number
  company_id: string
  metric: string
  current_value: number | null
  previous_value: number | null
  severity: string
  details: Record<string, unknown> | null
  created_at: string
  resolved_at?: string | null
  resolved_by?: string | null
}

const SEVERITY_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  critical: { icon: '🔴', color: 'var(--danger-500)', bg: 'rgba(239,68,68,0.1)', label: 'Crítico' },
  warning:  { icon: '🟡', color: 'var(--warning-500, #D97706)', bg: 'rgba(192,197,206,0.08)', label: 'Advertencia' },
  info:     { icon: '🔵', color: 'var(--info)', bg: 'rgba(59,130,246,0.1)', label: 'Información' },
  ok:       { icon: '✅', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)', label: 'OK' },
}

const METRIC_LABELS: Record<string, string> = {
  zombie_traficos: 'Embarques zombie (>30 días)',
  missing_tmec: 'T-MEC faltante',
  duplicate_descriptions: 'Posible doble entrada',
  duplicate_pedimentos: 'Pedimentos duplicados',
  high_value_outliers: 'Valores atípicos',
  row_count_traficos: 'Conteo de embarques',
  row_count_entradas: 'Conteo de entradas',
  expediente_coverage: 'Cobertura de expedientes',
  stale_traficos: 'Embarques sin pedimento',
}

export default function AlertasInternasPage() {
  const isMobile = useIsMobile()
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [resolving, setResolving] = useState<number | null>(null)

  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'

  useEffect(() => {
    supabase
      .from('anomaly_log')
      .select('*')
      .neq('severity', 'ok')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setAnomalies((data || []) as AnomalyRow[])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return anomalies
    return anomalies.filter(a => a.severity === filter)
  }, [anomalies, filter])

  const counts = useMemo(() => ({
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
    resolved: anomalies.filter(a => a.resolved_at).length,
  }), [anomalies])

  async function resolve(id: number) {
    setResolving(id)
    await supabase.from('anomaly_log').update({
      resolved_at: new Date().toISOString(),
      resolved_by: getCookieValue('user_role') || 'admin',
    }).eq('id', id)
    await supabase.from('audit_log').insert({
      action: 'anomaly_resolved',
      details: { anomaly_id: id },
      actor: getCookieValue('user_role') || 'admin',
      timestamp: new Date().toISOString(),
    }).then(() => {}, (e) => console.error('[alertas-internas] audit log:', e.message))
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, resolved_at: new Date().toISOString() } : a))
    setResolving(null)
  }

  if (!isBroker) return <EmptyState icon="🔒" title="Acceso restringido" description="Solo para uso interno" />

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, margin: '0 0 4px' }}>Alertas Internas</h1>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
        Anomalías detectadas por el pipeline nocturno · {anomalies.length} registros
      </p>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Críticas', count: counts.critical, color: 'var(--danger-500)' },
          { label: 'Advertencias', count: counts.warning, color: 'var(--warning-500, #D97706)' },
          { label: 'Info', count: counts.info, color: 'var(--info)' },
          { label: 'Resueltas', count: counts.resolved, color: 'var(--success)' },
        ].map(k => (
          <div key={k.label} style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid #E8E5E0' }}>
            <div style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: k.color }}>{k.count}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16, borderBottom: '1px solid #E8E5E0' }}>
        {(['all', 'critical', 'warning', 'info'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 'var(--aguila-fs-body)', fontWeight: filter === f ? 700 : 500,
            color: filter === f ? 'var(--gold)' : 'var(--text-secondary)',
            borderBottom: filter === f ? '2px solid #eab308' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {f === 'all' ? 'Todas' : (SEVERITY_CONFIG[f]?.label || f)}
          </button>
        ))}
      </div>

      {/* Anomaly list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 64, borderRadius: 8 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="✅" title="Sin anomalías activas" description="El sistema está operando correctamente" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(a => {
            const sev = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info
            const isResolved = !!a.resolved_at
            return (
              <div key={a.id} style={{
                padding: '12px 16px', borderRadius: 8,
                background: isResolved ? '#F5F4F0' : sev.bg,
                border: `1px solid ${isResolved ? 'var(--border)' : sev.color}20`,
                borderLeft: `4px solid ${isResolved ? 'var(--text-muted)' : sev.color}`,
                opacity: isResolved ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 'var(--aguila-fs-body-lg)', flexShrink: 0 }}>{isResolved ? '✓' : sev.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {METRIC_LABELS[a.metric] || a.metric}
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', marginLeft: 8 }}>{a.company_id}</span>
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)', display: 'flex', gap: 12, marginTop: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDateTime(a.created_at)}</span>
                    {a.current_value != null && <span>Valor: <b>{a.current_value}</b></span>}
                    {isResolved && <span style={{ color: 'var(--success)' }}>Resuelto</span>}
                  </div>
                </div>
                {!isResolved && (
                  <button
                    onClick={() => resolve(a.id)}
                    disabled={resolving === a.id}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: 'var(--aguila-fs-compact)', fontWeight: 700,
                      background: 'var(--bg-card)', border: '1px solid #E8E5E0',
                      cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
                      minHeight: 36,
                    }}
                  >
                    {resolving === a.id ? '...' : 'Resolver'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
