'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue, getCompanyIdCookie, getClientClaveCookie } from '@/lib/client-config'
import { fmtDate, fmtDateShort, fmtDateTime } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { Plus, X, FileText, AlertTriangle, Calendar } from 'lucide-react'

const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

/* ── Types ── */

interface TraficoRow {
  trafico: string
  estatus: string | null
  fecha_llegada: string | null
  fecha_cruce: string | null
  descripcion_mercancia: string | null
  company_id: string | null
  [k: string]: unknown
}

interface DocDeadline {
  id: string
  trafico_id: string
  doc_type: string
  escalate_after: string
  status: string
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  event_type: 'inspection' | 'meeting' | 'deadline' | 'note'
  company_id: string | null
  created_at: string
}

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */

const T = {
  card: 'var(--bg-card)',
  border: 'var(--border)',
  gold: 'var(--gold)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  blue: 'var(--info)',
  blueBg: 'var(--bg-primary)',
  green: 'var(--success)',
  greenDot: 'var(--success)',
  amber: 'var(--warning)',
  radius: 8,
} as const

/* ── Helpers ── */

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const weekday = d.toLocaleDateString('es-MX', { weekday: 'long', timeZone: 'America/Chicago' })
  const rest = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Chicago' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${rest}`
}

function groupByDate(items: { date: string; trafico: TraficoRow }[]): Map<string, TraficoRow[]> {
  const map = new Map<string, TraficoRow[]>()
  for (const { date, trafico } of items) {
    const arr = map.get(date)
    if (arr) arr.push(trafico)
    else map.set(date, [trafico])
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

/* ── Component ── */

export default function CalendarioPage() {
  const isMobile = useIsMobile()
  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'

  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [deadlines, setDeadlines] = useState<DocDeadline[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventType, setNewEventType] = useState<CalendarEvent['event_type']>('note')

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const url = isBroker
      ? `/api/data?table=traficos&company_id=${companyId}&limit=2000&order_by=fecha_llegada&order_dir=desc`
      : `/api/data?table=traficos&company_id=${companyId}&limit=1000&order_by=fecha_llegada&order_dir=desc`

    // Load traficos + doc deadlines in parallel
    Promise.all([
      fetch(url).then(r => r.json()),
      companyId ? sbClient
        .from('documento_solicitudes')
        .select('id, trafico_id, doc_type, escalate_after, status')
        .eq('company_id', companyId)
        .eq('status', 'solicitado')
        .order('escalate_after', { ascending: true })
        .limit(200) : Promise.resolve({ data: [] }),
      companyId ? sbClient
        .from('calendar_events')
        .select('id, title, date, event_type, company_id, created_at')
        .eq('company_id', companyId)
        .order('date', { ascending: true })
        .limit(200) : Promise.resolve({ data: [] }),
    ])
      .then(([trafData, deadlineData, eventData]) => {
        setTraficos(trafData.data ?? [])
        setDeadlines((deadlineData.data ?? []) as DocDeadline[])
        setEvents((eventData.data ?? []) as CalendarEvent[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isBroker])

  /* ── Derived data ── */

  const todayStr = toDateStr(new Date())
  const weekEnd = toDateStr(addDays(new Date(), 7))
  const twoWeeksEnd = toDateStr(addDays(new Date(), 14))

  // Section 1: This week's crossings
  const weekCrossings = useMemo(() => {
    const items = traficos
      .filter(t => t.fecha_cruce && t.fecha_cruce >= todayStr && t.fecha_cruce <= weekEnd)
      .map(t => ({ date: t.fecha_cruce!.split('T')[0], trafico: t }))
    return groupByDate(items)
  }, [traficos, todayStr, weekEnd])

  // Section 2: Upcoming arrivals (14 days)
  const upcomingArrivals = useMemo(() => {
    const items = traficos
      .filter(t => t.fecha_llegada && t.fecha_llegada >= todayStr && t.fecha_llegada <= twoWeeksEnd)
      .map(t => ({ date: t.fecha_llegada!.split('T')[0], trafico: t }))
    return groupByDate(items)
  }, [traficos, todayStr, twoWeeksEnd])

  // Section 3: Month grid data
  const now = new Date()
  const [gridYear, gridMonth] = [now.getFullYear(), now.getMonth()]
  const firstDayOfWeek = new Date(gridYear, gridMonth, 1).getDay()
  const daysInMonth = new Date(gridYear, gridMonth + 1, 0).getDate()

  const monthData = useMemo(() => {
    const monthPrefix = `${gridYear}-${String(gridMonth + 1).padStart(2, '0')}`
    const arrivalsByDate = new Map<string, TraficoRow[]>()
    const crossingsByDate = new Map<string, TraficoRow[]>()

    for (const t of traficos) {
      if (t.fecha_llegada?.startsWith(monthPrefix)) {
        const d = t.fecha_llegada.split('T')[0]
        const arr = arrivalsByDate.get(d)
        if (arr) arr.push(t); else arrivalsByDate.set(d, [t])
      }
      if (t.fecha_cruce?.startsWith(monthPrefix)) {
        const d = t.fecha_cruce.split('T')[0]
        const arr = crossingsByDate.get(d)
        if (arr) arr.push(t); else crossingsByDate.set(d, [t])
      }
    }
    return { arrivalsByDate, crossingsByDate }
  }, [traficos, gridYear, gridMonth])

  // Deadlines by date
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, DocDeadline[]>()
    for (const d of deadlines) {
      if (!d.escalate_after) continue
      const dateStr = d.escalate_after.split('T')[0]
      const arr = map.get(dateStr)
      if (arr) arr.push(d); else map.set(dateStr, [d])
    }
    return map
  }, [deadlines])

  // Events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (!e.date) continue
      const dateStr = e.date.split('T')[0]
      const arr = map.get(dateStr)
      if (arr) arr.push(e); else map.set(dateStr, [e])
    }
    return map
  }, [events])

  // Create event handler
  async function handleCreateEvent() {
    if (!newEventTitle.trim() || !newEventDate) return
    const companyId = getCompanyIdCookie()
    const { data, error } = await sbClient.from('calendar_events').insert({
      title: newEventTitle.trim(),
      date: newEventDate,
      event_type: newEventType,
      company_id: companyId,
    }).select().single()

    if (!error && data) {
      setEvents(prev => [...prev, data as CalendarEvent])
      setNewEventTitle('')
      setNewEventDate('')
      setShowEventForm(false)
    }
  }

  // Selected date's traficos
  const selectedTraficos = useMemo(() => {
    if (!selectedDate) return []
    const arrivals = monthData.arrivalsByDate.get(selectedDate) ?? []
    const crossings = monthData.crossingsByDate.get(selectedDate) ?? []
    const seen = new Set<string>()
    const result: { trafico: TraficoRow; type: 'arrival' | 'crossing' }[] = []
    for (const t of crossings) { seen.add(t.trafico); result.push({ trafico: t, type: 'crossing' }) }
    for (const t of arrivals) { if (!seen.has(t.trafico)) result.push({ trafico: t, type: 'arrival' }) }
    return result
  }, [selectedDate, monthData])

  /* ── Render helpers ── */

  function renderGroupedList(groups: Map<string, TraficoRow[]>, emptyMsg: string) {
    if (groups.size === 0) {
      return (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
          <EmptyState icon="📅" title={emptyMsg} description="Los eventos programados aparecerán aquí" />
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...groups.entries()].map(([date, items]) => (
          <div key={date} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, overflow: 'hidden',
          }}>
            {/* Day header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
                {dayLabel(date)}
              </span>
              <span style={{
                padding: '2px 8px', fontSize: 11, fontWeight: 700,
                borderRadius: 9999, background: 'rgba(184,149,63,0.15)', color: T.gold,
              }}>
                {items.length} tráfico{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Tráfico list */}
            {items.map(t => (
              <Link
                key={t.trafico}
                href={`/traficos/${encodeURIComponent(t.trafico)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px', textDecoration: 'none',
                  borderBottom: `1px solid rgba(48,44,35,0.4)`,
                  minHeight: 60,
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 700, color: T.gold,
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {t.trafico}
                </span>
                <span style={{
                  fontSize: 12, color: T.textSecondary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {t.descripcion_mercancia || '—'}
                </span>
                {isBroker && t.company_id && (
                  <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
                    {t.company_id}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>
    )
  }

  /* ── Loading ── */

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100, margin: '0 auto' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: T.radius, height: 140, marginBottom: 16, opacity: 0.5,
          }} />
        ))}
      </div>
    )
  }

  /* ── Grid cells ── */

  const gridCells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfWeek + 1
    if (day < 1 || day > daysInMonth) return null
    const dateStr = `${gridYear}-${String(gridMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const arrivals = monthData.arrivalsByDate.get(dateStr)?.length ?? 0
    const crossings = monthData.crossingsByDate.get(dateStr)?.length ?? 0
    const deadlineCount = deadlinesByDate.get(dateStr)?.length ?? 0
    const eventCount = eventsByDate.get(dateStr)?.length ?? 0
    return { day, dateStr, arrivals, crossings, deadlineCount, eventCount }
  })

  const monthLabel = new Date(gridYear, gridMonth).toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
            Calendario Operativo
          </h1>
          <p style={{ fontSize: 14, color: T.textSecondary, margin: 0 }}>
            Cruces, llegadas, vencimientos y eventos
          </p>
        </div>
        {isBroker && (
          <button
            onClick={() => { setShowEventForm(v => !v); setNewEventDate(selectedDate || toDateStr(new Date())) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--gold)', border: 'none', color: 'var(--bg-card)',
              cursor: 'pointer', minHeight: 40,
            }}
          >
            <Plus size={14} /> Crear evento
          </button>
        )}
      </div>

      {/* Event creation form */}
      {showEventForm && (
        <div style={{
          background: T.card, border: `1px solid ${T.gold}`,
          borderRadius: T.radius, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Nuevo evento</span>
            <button onClick={() => setShowEventForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} style={{ color: T.textMuted }} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={newEventTitle}
              onChange={e => setNewEventTitle(e.target.value)}
              placeholder="Título del evento"
              style={{
                border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '10px 12px', fontSize: 13, color: T.textPrimary,
                background: 'var(--bg-main)', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
                style={{
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '10px 12px', fontSize: 13, color: T.textPrimary,
                  background: 'var(--bg-main)', outline: 'none', fontFamily: 'var(--font-mono)',
                  flex: 1, minWidth: 160,
                }}
              />
              <select
                value={newEventType}
                onChange={e => setNewEventType(e.target.value as CalendarEvent['event_type'])}
                style={{
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '10px 12px', fontSize: 13, color: T.textPrimary,
                  background: 'var(--bg-main)', outline: 'none', fontFamily: 'inherit',
                  flex: 1, minWidth: 140,
                }}
              >
                <option value="note">Nota</option>
                <option value="meeting">Reunión</option>
                <option value="inspection">Inspección</option>
                <option value="deadline">Fecha límite</option>
              </select>
            </div>
            <button
              onClick={handleCreateEvent}
              disabled={!newEventTitle.trim() || !newEventDate}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: newEventTitle.trim() && newEventDate ? 'var(--gold)' : 'var(--border)',
                border: 'none', color: newEventTitle.trim() && newEventDate ? 'var(--bg-card)' : T.textMuted,
                cursor: newEventTitle.trim() && newEventDate ? 'pointer' : 'default',
                alignSelf: 'flex-end', minHeight: 40, minWidth: 120,
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* ═══ SECTION 1 — This week's crossings ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.greenDot }} />
          Cruces esta semana
        </div>
        {renderGroupedList(weekCrossings, 'Sin cruces programados esta semana.')}
      </div>

      {/* ═══ SECTION 2 — Upcoming arrivals ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: T.blue }} />
          Llegadas próximas (14 días)
        </div>
        {renderGroupedList(upcomingArrivals, 'Sin llegadas programadas en los próximos 14 días.')}
      </div>

      {/* ═══ SECTION 3 — Month grid ═══ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 16,
        }}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.blue }} />
            Llegada
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.greenDot }} />
            Cruce
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.amber }} />
            Vencimiento
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7E22CE' }} />
            Evento
          </div>
        </div>

        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: 12,
        }}>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 700,
                color: T.textMuted, padding: 4,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {gridCells.map((cell, i) => {
              const isToday = cell?.dateStr === todayStr
              const isSelected = cell?.dateStr === selectedDate
              const hasEvents = cell && (cell.arrivals > 0 || cell.crossings > 0 || cell.deadlineCount > 0 || cell.eventCount > 0)
              return (
                <button
                  key={i}
                  onClick={() => cell && hasEvents && setSelectedDate(isSelected ? null : cell.dateStr)}
                  disabled={!cell || !hasEvents}
                  aria-label={cell ? `${cell.day} — ${cell.arrivals} llegada${cell.arrivals !== 1 ? 's' : ''}, ${cell.crossings} cruce${cell.crossings !== 1 ? 's' : ''}` : undefined}
                  style={{
                    minHeight: 60,
                    padding: 4,
                    borderRadius: 4,
                    border: isSelected
                      ? `2px solid ${T.gold}`
                      : isToday
                      ? `1px solid ${T.gold}`
                      : '1px solid transparent',
                    background: isSelected
                      ? 'rgba(184,149,63,0.12)'
                      : cell
                      ? 'rgba(255,255,255,0.02)'
                      : 'transparent',
                    cursor: cell && hasEvents ? 'pointer' : 'default',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  {cell && (
                    <>
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: isToday ? T.gold : T.textSecondary,
                        fontWeight: isToday ? 700 : 400,
                      }}>
                        {cell.day}
                      </div>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {cell.arrivals > 0 && (
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: T.blue,
                          }} title={`${cell.arrivals} llegada${cell.arrivals !== 1 ? 's' : ''}`} />
                        )}
                        {cell.crossings > 0 && (
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: T.greenDot,
                          }} title={`${cell.crossings} cruce${cell.crossings !== 1 ? 's' : ''}`} />
                        )}
                        {cell.deadlineCount > 0 && (
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: T.amber,
                          }} title={`${cell.deadlineCount} vencimiento${cell.deadlineCount !== 1 ? 's' : ''}`} />
                        )}
                        {cell.eventCount > 0 && (
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: '#7E22CE',
                          }} title={`${cell.eventCount} evento${cell.eventCount !== 1 ? 's' : ''}`} />
                        )}
                      </div>
                      {(cell.arrivals + cell.crossings + cell.deadlineCount + cell.eventCount) > 1 && (
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: 'var(--font-mono)' }}>
                          {cell.arrivals + cell.crossings + cell.deadlineCount + cell.eventCount}
                        </div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected date: deadlines */}
        {selectedDate && (deadlinesByDate.get(selectedDate)?.length ?? 0) > 0 && (
          <div style={{
            background: T.card, border: `1px solid ${T.amber}`,
            borderRadius: T.radius, marginTop: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
              fontSize: 14, fontWeight: 700, color: T.textPrimary,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={16} style={{ color: T.amber }} />
              {deadlinesByDate.get(selectedDate)!.length} vencimiento{deadlinesByDate.get(selectedDate)!.length !== 1 ? 's' : ''}
            </div>
            {deadlinesByDate.get(selectedDate)!.map(d => (
              <Link
                key={d.id}
                href={`/traficos/${encodeURIComponent(d.trafico_id)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px', textDecoration: 'none',
                  borderBottom: `1px solid var(--border)`,
                  minHeight: 48,
                }}
              >
                <FileText size={14} style={{ color: T.amber, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.gold, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {d.trafico_id}
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, flex: 1 }}>
                  {d.doc_type.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Selected date: events */}
        {selectedDate && (eventsByDate.get(selectedDate)?.length ?? 0) > 0 && (
          <div style={{
            background: T.card, border: '1px solid #7E22CE',
            borderRadius: T.radius, marginTop: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
              fontSize: 14, fontWeight: 700, color: T.textPrimary,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Calendar size={16} style={{ color: '#7E22CE' }} />
              Eventos
            </div>
            {eventsByDate.get(selectedDate)!.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px',
                borderBottom: `1px solid var(--border)`,
                minHeight: 48,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: '#7E22CE',
                }} />
                <span style={{ fontSize: 13, color: T.textPrimary, flex: 1 }}>{e.title}</span>
                <span style={{ fontSize: 10, color: T.textMuted, textTransform: 'capitalize' }}>
                  {e.event_type === 'inspection' ? 'Inspección' : e.event_type === 'meeting' ? 'Reunión' : e.event_type === 'deadline' ? 'Fecha límite' : 'Nota'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Selected date detail */}
        {selectedDate && selectedTraficos.length > 0 && (
          <div style={{
            background: T.card, border: `1px solid ${T.gold}`,
            borderRadius: T.radius, marginTop: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: `1px solid ${T.border}`,
              fontSize: 14, fontWeight: 700, color: T.textPrimary,
            }}>
              {dayLabel(selectedDate)} — {selectedTraficos.length} tráfico{selectedTraficos.length !== 1 ? 's' : ''}
            </div>
            {selectedTraficos.map(({ trafico: t, type }) => (
              <Link
                key={`${t.trafico}-${type}`}
                href={`/traficos/${encodeURIComponent(t.trafico)}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px', textDecoration: 'none',
                  borderBottom: `1px solid rgba(48,44,35,0.4)`,
                  minHeight: 60,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: type === 'crossing' ? T.greenDot : T.blue,
                }} />
                <span style={{
                  fontSize: 13, fontWeight: 700, color: T.gold,
                  fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                  {t.trafico}
                </span>
                <span style={{ fontSize: 12, color: T.textSecondary, flex: 1 }}>
                  {type === 'crossing' ? 'Cruce' : 'Llegada'}
                </span>
                <span style={{
                  fontSize: 11, color: T.textMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 200,
                }}>
                  {t.descripcion_mercancia || '—'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
