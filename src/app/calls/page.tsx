'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Phone, Clock, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { GOLD } from '@/lib/design-system'
import { getCookieValue } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtDateShort } from '@/lib/format-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface CallTranscript {
  id: string
  filename: string
  transcribed_at: string
  duration_seconds: number
  language: string
  summary: string | null
  full_transcript: string | null
  action_items: Array<{ tarea: string; responsable: string; urgente?: boolean; completed?: boolean }>
  traficos_mentioned: string[]
  follow_up_email: string | null
  company_id: string
}

function fmtDuration(s: number) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function CallsPage() {
  const isMobile = useIsMobile()
  const companyId = getCookieValue('company_id') ?? ''
  const [calls, setCalls] = useState<CallTranscript[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!companyId) {
      setCalls([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase.from('call_transcripts')
      .select('*')
      .eq('company_id', companyId)
      .order('transcribed_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return
        setCalls(data || [])
        setLoading(false)
      })
      .then(undefined, () => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [companyId])

  const toggleAction = async (callId: string, idx: number) => {
    const key = `${callId}-${idx}`
    const next = new Set(completedActions)
    if (next.has(key)) next.delete(key); else next.add(key)
    setCompletedActions(next)

    // Update in Supabase
    const call = calls.find(c => c.id === callId)
    if (call?.action_items) {
      const updated = [...call.action_items]
      updated[idx] = { ...updated[idx], completed: !updated[idx].completed }
      await supabase.from('call_transcripts').update({ action_items: updated }).eq('id', callId)
      setCalls(prev => prev.map(c => c.id === callId ? { ...c, action_items: updated } : c))
    }
  }

  const totalCalls = calls.length
  const totalDuration = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0)
  const totalActions = calls.reduce((s, c) => s + (c.action_items?.length || 0), 0)

  return (
    <div className={isMobile ? 'p-4' : 'p-6'}>
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Llamadas</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Transcripciones procesadas por Whisper + CRUZ
        </p>
      </div>

      {/* KPI Cards */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-4`}>
        {[
          { label: 'Total Llamadas', value: totalCalls, icon: Phone },
          { label: 'Duración Total', value: fmtDuration(totalDuration), icon: Clock },
          { label: 'Acciones Pendientes', value: totalActions, icon: CheckCircle },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <kpi.icon size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>{kpi.label}</span>
            </div>
            <div className="mono text-[20px] font-semibold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Calls Table */}
      <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>Cargando llamadas...</div>
        ) : calls.length === 0 ? (
          <EmptyState icon="📞" title="Sin llamadas procesadas" description="Las transcripciones de llamadas aparecerán aquí automáticamente" />
        ) : (
          calls.map(call => {
            const isExpanded = expanded === call.id
            return (
              <div key={call.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div
                  onClick={() => setExpanded(isExpanded ? null : call.id)}
                  className={`flex ${isMobile ? 'flex-wrap gap-2 px-3 py-3' : 'items-center gap-4 px-4 py-3'}`}
                  style={{ cursor: 'pointer', background: isExpanded ? 'rgba(192,197,206,0.04)' : 'transparent' }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-primary)' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  {isExpanded ? <ChevronDown size={14} style={{ color: GOLD }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  <span className="mono text-[11.5px]" style={{ color: 'var(--text-muted)', width: 90, flexShrink: 0 }}>
                    {fmtDateShort(call.transcribed_at)}
                  </span>
                  <span className="mono text-[11.5px]" style={{ color: 'var(--text-secondary)', width: 50, flexShrink: 0 }}>
                    {fmtDuration(call.duration_seconds)}
                  </span>
                  <span className="text-[12.5px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                    {call.summary?.substring(0, 80) || call.filename}
                    {call.summary && call.summary.length > 80 ? '...' : ''}
                  </span>
                  {(call.action_items?.length || 0) > 0 && (
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
                      style={{ background: 'var(--amber-100)', color: 'var(--amber-600)' }}>
                      {call.action_items.length} acciones
                    </span>
                  )}
                  {call.traficos_mentioned?.length > 0 && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-[4px]"
                      style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}>
                      {call.traficos_mentioned.length} embarques
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-4`}>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Archivo</div>
                        <div className="mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{call.filename}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Idioma</div>
                        <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{call.language === 'es' ? 'Espanol' : call.language}</div>
                      </div>
                    </div>

                    {call.summary && (
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Resumen</div>
                        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{call.summary}</div>
                      </div>
                    )}

                    {call.action_items?.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>Acciones</div>
                        {call.action_items.map((action, i) => {
                          const key = `${call.id}-${i}`
                          const done = action.completed || completedActions.has(key)
                          return (
                            <label key={i} className="flex items-start gap-2.5 py-1.5 cursor-pointer" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                              <input type="checkbox" checked={done} onChange={() => toggleAction(call.id, i)}
                                style={{ marginTop: 2, width: 14, height: 14 }} />
                              <div>
                                <span className="text-[12.5px]" style={{ color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
                                  {action.tarea}
                                </span>
                                <span className="text-[11px] ml-2" style={{ color: 'var(--text-muted)' }}>
                                  {action.responsable}
                                </span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {call.traficos_mentioned?.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Embarques Mencionados</div>
                        <div className="flex flex-wrap gap-1.5">
                          {call.traficos_mentioned.map(t => (
                            <span key={t} className="ped-pill text-[11px]">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {call.full_transcript && (
                      <details className="mt-3">
                        <summary className="text-[11px] font-semibold cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                          Ver transcripcion completa
                        </summary>
                        <pre className="mt-2 p-3 rounded-[6px] text-[11.5px] leading-relaxed overflow-auto max-h-[300px]"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                          {call.full_transcript}
                        </pre>
                      </details>
                    )}

                    {call.follow_up_email && (
                      <details className="mt-3">
                        <summary className="text-[11px] font-semibold cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                          Email de seguimiento
                        </summary>
                        <pre className="mt-2 p-3 rounded-[6px] text-[12px] leading-relaxed overflow-auto max-h-[200px]"
                          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                          {call.follow_up_email}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
