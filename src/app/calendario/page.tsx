'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Bell, BellOff, Check, X } from 'lucide-react'
import { getCookieValue, CLIENT_NAME, CLIENT_CLAVE, PATENTE } from '@/lib/client-config'
import { fmtDateShort, fmtDate } from '@/lib/format-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CalEvent = {
  id?: string
  title: string
  description?: string
  due_date: string
  event_type: string
  severity: string
  company_id?: string
  telegram_reminder: boolean
  completed: boolean
  completed_at?: string | null
  source?: 'db' | 'static' | 'immex'
}

const STATIC_EVENTS: CalEvent[] = [
  { title: `MVE Deadline — ${CLIENT_NAME.split(' ')[0]} Plastics`, due_date: '2026-03-31', event_type: 'compliance', severity: 'high', telegram_reminder: true, completed: true, source: 'static' },
  { title: 'Declaracion mensual SAT (marzo)', due_date: '2026-04-17', event_type: 'compliance', severity: 'medium', telegram_reminder: true, completed: false, source: 'static' },
  { title: 'Declaracion mensual SAT (abril)', due_date: '2026-05-17', event_type: 'compliance', severity: 'medium', telegram_reminder: true, completed: false, source: 'static' },
  { title: `Verificar e.Firma SAT — ${CLIENT_NAME.split(' ')[0]}`, due_date: '2026-06-25', event_type: 'compliance', severity: 'high', telegram_reminder: true, completed: false, source: 'static' },
  { title: 'Verificar Autorización IMMEX', due_date: '2026-04-27', event_type: 'compliance', severity: 'high', telegram_reminder: true, completed: false, source: 'static' },
  { title: 'Verificar Padron de Importadores', due_date: '2026-09-27', event_type: 'compliance', severity: 'medium', telegram_reminder: true, completed: false, source: 'static' },
]

function getMondays(count: number): CalEvent[] {
  const dates: CalEvent[] = []
  const d = new Date()
  d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7 || 7)
  for (let i = 0; i < count; i++) {
    const mon = new Date(d); mon.setDate(d.getDate() + i * 7)
    dates.push({ title: `Auditoria Semanal ${CLIENT_NAME.split(' ')[0]}`, due_date: mon.toISOString().split('T')[0], event_type: 'audit', severity: 'low', telegram_reminder: true, completed: false, source: 'static' })
  }
  return dates
}

function getMonthlyReports(): CalEvent[] {
  const reports: CalEvent[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + i + 1)
    reports.push({ title: 'Reporte Mensual Financiero', due_date: d.toISOString().split('T')[0], event_type: 'report', severity: 'medium', telegram_reminder: true, completed: false, source: 'static' })
  }
  return reports
}

const severityConfig: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: 'var(--red-bg, #FEE2E2)', text: 'var(--red-text, #991B1B)', dot: '#EF4444' },
  medium: { bg: 'var(--amber-100, #FEF3C7)', text: 'var(--amber-600, #92400E)', dot: '#F59E0B' },
  low: { bg: 'var(--green-bg, #DCFCE7)', text: 'var(--green-text, #166534)', dot: '#10B981' },
  info: { bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
}

const typeIcons: Record<string, string> = { compliance: '🚨', audit: '📊', immex: '⏱', renewal: '🔄', report: '📈', custom: '📌' }

export default function CalendarioPage() {
  const companyId = getCookieValue('company_id') ?? 'evco'
  const clientClave = getCookieValue('company_clave') ?? CLIENT_CLAVE
  const [events, setEvents] = useState<CalEvent[]>([])
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const [showAdd, setShowAdd] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', description: '', due_date: '', event_type: 'custom', severity: 'medium' })

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    const staticAll = [...STATIC_EVENTS, ...getMondays(12), ...getMonthlyReports()]

    // Load from Supabase compliance_events table
    const { data: dbEvents } = await supabase.from('compliance_events')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true })

    const fromDb: CalEvent[] = (dbEvents || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      due_date: e.due_date,
      event_type: e.event_type || 'custom',
      severity: e.severity || 'medium',
      telegram_reminder: e.telegram_reminder ?? true,
      completed: e.completed ?? false,
      completed_at: e.completed_at,
      source: 'db' as const,
    }))

    // Fetch IMMEX temporal limits
    try {
      const res = await fetch(`/api/data?table=traficos&company_id=${companyId}&trafico_prefix=${clientClave}-&limit=500&order_by=fecha_llegada&order_dir=desc`)
      const data = await res.json()
      const traficos = data.data ?? data ?? []
      const today = new Date().toISOString().split('T')[0]
      traficos.filter((t: any) => t.estatus === 'En Proceso' && t.fecha_llegada).forEach((t: any) => {
        const limit = new Date(t.fecha_llegada); limit.setMonth(limit.getMonth() + 17)
        const limitStr = limit.toISOString().split('T')[0]
        if (limitStr >= today && limitStr <= '2027-12-31') {
          const daysLeft = Math.floor((limit.getTime() - Date.now()) / 86400000)
          staticAll.push({
            title: `IMMEX Limite 18m — ${t.trafico}`,
            due_date: limitStr,
            event_type: 'immex',
            severity: daysLeft < 30 ? 'high' : daysLeft < 90 ? 'medium' : 'low',
            telegram_reminder: true,
            completed: false,
            source: 'immex',
          })
        }
      })
    } catch {}

    // Merge: DB events override static by title+date match
    const dbKeys = new Set(fromDb.map(e => `${e.title}|${e.due_date}`))
    const merged = [...fromDb, ...staticAll.filter(e => !dbKeys.has(`${e.title}|${e.due_date}`))]
    setEvents(merged.sort((a, b) => a.due_date.localeCompare(b.due_date)))
  }

  async function addEvent() {
    if (!newEvent.title || !newEvent.due_date) return
    const { error } = await supabase.from('compliance_events').insert({
      title: newEvent.title,
      description: newEvent.description || null,
      due_date: newEvent.due_date,
      event_type: newEvent.event_type,
      severity: newEvent.severity,
      company_id: companyId,
      telegram_reminder: true,
      completed: false,
    })
    if (!error) {
      setShowAdd(false)
      setNewEvent({ title: '', description: '', due_date: '', event_type: 'custom', severity: 'medium' })
      loadEvents()
    }
  }

  async function toggleComplete(event: CalEvent) {
    if (!event.id) return
    const { error } = await supabase.from('compliance_events')
      .update({ completed: !event.completed, completed_at: !event.completed ? new Date().toISOString() : null })
      .eq('id', event.id)
    if (!error) loadEvents()
  }

  async function toggleReminder(event: CalEvent) {
    if (!event.id) return
    await supabase.from('compliance_events')
      .update({ telegram_reminder: !event.telegram_reminder })
      .eq('id', event.id)
    loadEvents()
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter(e => e.due_date >= today && !e.completed).slice(0, 40)
  const overdue = events.filter(e => e.due_date < today && !e.completed && e.severity === 'high')
  const completedRecent = events.filter(e => e.completed).slice(-5)

  // Grid
  const [gridYear, gridMonth] = month.split('-').map(Number)
  const firstDay = new Date(gridYear, gridMonth - 1, 1).getDay()
  const daysInMonth = new Date(gridYear, gridMonth, 0).getDate()
  const gridDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    if (day < 1 || day > daysInMonth) return null
    const dateStr = `${gridYear}-${String(gridMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { day, date: dateStr, events: events.filter(e => e.due_date === dateStr) }
  })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="pg-title">Calendario de Cumplimiento</h1>
          <p className="pg-meta">{events.length} eventos &middot; {CLIENT_NAME.split(' ')[0]} Plastics &middot; Patente {PATENTE}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-[12px] font-medium"
            style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid var(--border)' }}>
            <Plus size={13} /> Agregar Evento
          </button>
          {(['list', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="tab-btn" style={view === v ? { background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid var(--border-primary)' } : {}}>
              {v === 'list' ? '☰ Lista' : '▦ Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAdd && (
        <div className="card mb-4" style={{ padding: 20, border: '1px solid var(--amber-400)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Evento</span>
            <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="Titulo del evento"
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none col-span-2"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            <input type="date" value={newEvent.due_date} onChange={e => setNewEvent({ ...newEvent, due_date: e.target.value })}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }} />
            <select value={newEvent.severity} onChange={e => setNewEvent({ ...newEvent, severity: e.target.value })}
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}>
              <option value="high">Alta prioridad</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <input value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Descripcion (opcional)"
              className="rounded-[6px] px-3 py-2 text-[13px] outline-none col-span-2"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
          </div>
          <button onClick={addEvent}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold"
            style={{ background: 'var(--amber-600)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Guardar Evento
          </button>
        </div>
      )}

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div style={{ background: 'var(--red-bg, #FEE2E2)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🚨</span>
          <span style={{ color: 'var(--red-text, #991B1B)', fontSize: 13, fontWeight: 600 }}>{overdue.length} evento(s) vencido(s) — requieren atención inmediata</span>
        </div>
      )}

      {view === 'list' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>Sin eventos proximos</div>
          ) : upcoming.map((e, i) => {
            const c = severityConfig[e.severity] || severityConfig.medium
            const isToday = e.due_date === today
            const daysUntil = Math.floor((new Date(e.due_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
            return (
              <div key={`${e.due_date}-${e.title}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                borderBottom: '1px solid var(--border-light, rgba(0,0,0,0.06))',
                background: isToday ? 'rgba(201,168,76,0.06)' : 'transparent',
                opacity: e.completed ? 0.5 : 1,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>
                  {fmtDateShort(new Date(e.due_date + 'T12:00:00'))}
                </span>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{typeIcons[e.event_type] || '📌'}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, flex: 1, textDecoration: e.completed ? 'line-through' : 'none' }}>
                  {e.title}
                </span>
                <span className="mono text-[10px]" style={{ color: daysUntil <= 7 ? c.text : 'var(--text-muted)', flexShrink: 0 }}>
                  {fmtDate(new Date(e.due_date + 'T12:00:00'))}
                </span>
                {e.id && (
                  <button onClick={() => toggleReminder(e)} title={e.telegram_reminder ? 'Reminder ON' : 'Reminder OFF'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: e.telegram_reminder ? 'var(--amber-600)' : 'var(--text-disabled)', padding: 2 }}>
                    {e.telegram_reminder ? <Bell size={13} /> : <BellOff size={13} />}
                  </button>
                )}
                {e.id && (
                  <button onClick={() => toggleComplete(e)} title={e.completed ? 'Marcar pendiente' : 'Marcar completado'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: e.completed ? 'var(--green)' : 'var(--text-disabled)', padding: 2 }}>
                    <Check size={14} />
                  </button>
                )}
                <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                  {e.event_type}
                </span>
              </div>
            )
          })}

          {/* Recently completed */}
          {completedRecent.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>Completados</span>
              </div>
              {completedRecent.map((e, i) => (
                <div key={`done-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px', borderBottom: '1px solid var(--border-light)', opacity: 0.5 }}>
                  <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>
                    {fmtDateShort(new Date(e.due_date + 'T12:00:00'))}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'line-through', flex: 1 }}>{e.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => { const d = new Date(gridYear, gridMonth - 2, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
            <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
              {new Date(gridYear, gridMonth - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' })}
            </span>
            <button onClick={() => { const d = new Date(gridYear, gridMonth, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>→</button>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {gridDays.map((cell, i) => (
                <div key={i} style={{ minHeight: 60, padding: 4, borderRadius: 4, background: cell?.date === today ? 'rgba(201,168,76,0.08)' : cell ? 'var(--bg-elevated)' : 'transparent', border: cell?.date === today ? '1px solid var(--border-primary)' : '1px solid transparent' }}>
                  {cell && (
                    <>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: cell.date === today ? 'var(--amber-600)' : 'var(--text-secondary)', fontWeight: cell.date === today ? 700 : 400, marginBottom: 2 }}>{cell.day}</div>
                      {cell.events.slice(0, 2).map((e, j) => {
                        const sc = severityConfig[e.severity] || severityConfig.medium
                        return (
                          <div key={j} style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, background: sc.bg, color: sc.text, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {typeIcons[e.event_type] || '📌'} {e.title.substring(0, 18)}
                          </div>
                        )
                      })}
                      {cell.events.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{cell.events.length - 2}</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
