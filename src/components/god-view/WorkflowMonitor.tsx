'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react'

// ── Types ──

interface WorkflowEvent {
  id: string
  workflow: string
  event_type: string
  trigger_id: string | null
  payload: Record<string, unknown> | null
  status: 'pending' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

interface StageStats {
  pending: number
  completedToday: number
  total: number
  successRate: number
}

const PIPELINE_STAGES = [
  { key: 'intake', label: 'Intake' },
  { key: 'classify', label: 'Clasificar' },
  { key: 'docs', label: 'Docs' },
  { key: 'pedimento', label: 'Pedimento' },
  { key: 'crossing', label: 'Cruce' },
  { key: 'post_op', label: 'Post-op' },
  { key: 'invoice', label: 'Factura' },
] as const

const STATUS_COLORS: Record<string, string> = {
  pending: '#C0C5CE',
  completed: '#22C55E',
  failed: '#EF4444',
}

// ── Helpers ──

function getAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function computeStageStats(events: WorkflowEvent[]): Record<string, StageStats> {
  const stats: Record<string, StageStats> = {}
  for (const stage of PIPELINE_STAGES) {
    const stageEvents = events.filter(e => e.workflow === stage.key)
    const completed = stageEvents.filter(e => e.status === 'completed')
    const completedToday = completed.filter(e => e.completed_at && isToday(e.completed_at))
    const failed = stageEvents.filter(e => e.status === 'failed')
    const pending = stageEvents.filter(e => e.status === 'pending')
    const total = completed.length + failed.length
    stats[stage.key] = {
      pending: pending.length,
      completedToday: completedToday.length,
      total,
      successRate: total > 0 ? Math.round((completed.length / total) * 100) : 100,
    }
  }
  return stats
}

// ── Styles ──

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  color: '#E6EDF3',
  fontSize: 16,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: 0,
}

const mutedText: React.CSSProperties = {
  color: '#64748b',
  fontSize: 11,
}

const secondaryText: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 13,
}

// ── Component ──

export function WorkflowMonitor() {
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/data?table=workflow_events&limit=100&order_by=created_at&order_dir=desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: WorkflowEvent[] }
      setEvents(json.data ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 30_000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const stageStats = computeStageStats(events)

  // ── Loading ──
  if (loading) {
    return (
      <div style={glassCard}>
        <h2 style={sectionTitle}>
          <Activity size={16} style={{ color: '#C0C5CE' }} />
          Monitor de Workflows
        </h2>
        <div style={{ ...mutedText, marginTop: 16 }}>Cargando eventos...</div>
      </div>
    )
  }

  // ── Error without data ──
  if (error && events.length === 0) {
    return (
      <div style={glassCard}>
        <h2 style={sectionTitle}>
          <Activity size={16} style={{ color: '#C0C5CE' }} />
          Monitor de Workflows
        </h2>
        <div style={{ ...secondaryText, marginTop: 16 }}>
          <AlertTriangle size={14} style={{ color: '#EF4444', marginRight: 6 }} />
          Sin datos de workflow disponibles
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pipeline visualization */}
      <div style={glassCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={sectionTitle}>
            <Activity size={16} style={{ color: '#C0C5CE' }} />
            Pipeline de Workflows
          </h2>
          <button
            onClick={fetchEvents}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Actualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Stage chain */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const stats = stageStats[stage.key]
            const hasPending = stats.pending > 0
            return (
              <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90, gap: 6 }}>
                  {/* Node */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: hasPending
                        ? 'rgba(192,197,206,0.15)'
                        : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${hasPending ? '#C0C5CE' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: hasPending ? '0 0 12px rgba(192,197,206,0.3)' : 'none',
                    }}
                  >
                    {hasPending ? (
                      <span style={{ color: '#C0C5CE', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {stats.pending}
                      </span>
                    ) : (
                      <CheckCircle2 size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    )}
                  </div>

                  {/* Label */}
                  <span style={{ color: hasPending ? '#E6EDF3' : '#64748b', fontSize: 11, fontWeight: 500, textAlign: 'center' }}>
                    {stage.label}
                  </span>

                  {/* Stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#22C55E' }}>
                      {stats.completedToday} hoy
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b' }}>
                      {stats.successRate}%
                    </span>
                  </div>
                </div>

                {/* Connector */}
                {i < PIPELINE_STAGES.length - 1 && (
                  <div style={{
                    width: 20,
                    height: 2,
                    background: 'rgba(255,255,255,0.1)',
                    marginTop: 18,
                    flexShrink: 0,
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent events table */}
      <div style={glassCard}>
        <h2 style={{ ...sectionTitle, marginBottom: 12 }}>
          <Clock size={16} style={{ color: '#C0C5CE' }} />
          Eventos Recientes
        </h2>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Activity size={32} style={{ color: '#64748b', marginBottom: 8 }} />
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Sin eventos registrados</div>
            <div style={mutedText}>Los workflows generarán eventos al procesar tráficos</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Workflow', 'Tipo', 'Estado', 'Edad', 'Trigger ID'].map(h => (
                    <th
                      key={h}
                      style={{
                        ...mutedText,
                        textAlign: 'left',
                        fontWeight: 600,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.08em',
                        paddingBottom: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 20).map(ev => (
                  <tr
                    key={ev.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td style={{ ...secondaryText, padding: '8px 8px 8px 0', fontWeight: 500 }}>
                      {ev.workflow}
                    </td>
                    <td style={{ ...secondaryText, padding: '8px 8px 8px 0' }}>
                      {ev.event_type}
                    </td>
                    <td style={{ padding: '8px 8px 8px 0' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          fontWeight: 600,
                          color: STATUS_COLORS[ev.status] ?? '#94a3b8',
                          background: `${STATUS_COLORS[ev.status] ?? '#94a3b8'}18`,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94a3b8', padding: '8px 8px 8px 0' }}>
                      {getAge(ev.created_at)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b', padding: '8px 8px 8px 0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.trigger_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
