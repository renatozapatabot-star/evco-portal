'use client'

import { useEffect, useState } from 'react'

type CalEvent = { date: string; title: string; type: 'deadline' | 'audit' | 'immex' | 'renewal'; priority: 'red' | 'amber' | 'green' }

const STATIC_EVENTS: CalEvent[] = [
  { date: '2026-03-31', title: 'MVE Deadline — EVCO Plastics', type: 'deadline', priority: 'red' },
  { date: '2026-04-17', title: 'Declaración mensual SAT (marzo)', type: 'deadline', priority: 'amber' },
  { date: '2026-05-17', title: 'Declaración mensual SAT (abril)', type: 'deadline', priority: 'green' },
  { date: '2026-06-25', title: 'Verificar e.Firma SAT — EVCO', type: 'renewal', priority: 'amber' },
  { date: '2026-04-27', title: 'Verificar Autorización IMMEX', type: 'renewal', priority: 'amber' },
  { date: '2026-09-27', title: 'Verificar Padrón de Importadores', type: 'renewal', priority: 'green' },
  { date: '2028-01-01', title: 'e.Firma Expiración (4 años)', type: 'renewal', priority: 'green' },
]

function getMondays(count: number) {
  const dates: CalEvent[] = []
  const d = new Date()
  d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7 || 7)
  for (let i = 0; i < count; i++) {
    const mon = new Date(d); mon.setDate(d.getDate() + i * 7)
    dates.push({ date: mon.toISOString().split('T')[0], title: 'Auditoría Semanal EVCO', type: 'audit', priority: 'green' })
  }
  return dates
}

export default function CalendarioPage() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  useEffect(() => {
    // Combine static + audit + IMMEX temporal from traficos
    const all = [...STATIC_EVENTS, ...getMondays(12)]
    // Fetch IMMEX temporal limits
    fetch('/api/data?table=traficos&trafico_prefix=9254-&limit=500&order_by=fecha_llegada&order_dir=desc')
      .then(r => r.json()).then(data => {
        const traficos = data.data ?? data ?? []
        traficos.filter((t: any) => t.estatus === 'En Proceso' && t.fecha_llegada).forEach((t: any) => {
          const limit = new Date(t.fecha_llegada); limit.setMonth(limit.getMonth() + 17)
          const limitStr = limit.toISOString().split('T')[0]
          const today = new Date().toISOString().split('T')[0]
          if (limitStr >= today && limitStr <= '2027-12-31') {
            const daysLeft = Math.floor((limit.getTime() - Date.now()) / 86400000)
            all.push({ date: limitStr, title: `IMMEX Límite 18m — ${t.trafico}`, type: 'immex', priority: daysLeft < 30 ? 'red' : daysLeft < 90 ? 'amber' : 'green' })
          }
        })
        setEvents(all.sort((a, b) => a.date.localeCompare(b.date)))
      }).catch(() => setEvents(all.sort((a, b) => a.date.localeCompare(b.date))))
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const colors = { red: { bg: 'var(--red-bg)', text: 'var(--red-text)', dot: '#EF4444' }, amber: { bg: 'var(--amber-bg)', text: 'var(--amber-text)', dot: '#F59E0B' }, green: { bg: 'var(--green-bg)', text: 'var(--green-text)', dot: '#10B981' } }
  const typeIcons: Record<string, string> = { deadline: '🚨', audit: '📊', immex: '⏱️', renewal: '🔄' }

  // Grid: generate days for selected month
  const [gridYear, gridMonth] = month.split('-').map(Number)
  const firstDay = new Date(gridYear, gridMonth - 1, 1).getDay()
  const daysInMonth = new Date(gridYear, gridMonth, 0).getDate()
  const gridDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    if (day < 1 || day > daysInMonth) return null
    const dateStr = `${gridYear}-${String(gridMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { day, date: dateStr, events: events.filter(e => e.date === dateStr) }
  })

  const upcoming = events.filter(e => e.date >= today).slice(0, 30)
  const overdue = events.filter(e => e.date < today && e.priority === 'red')

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="pg-title">Calendario de Cumplimiento</h1>
          <p className="pg-meta">{events.length} eventos · EVCO Plastics · Patente 3596</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['list', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="tab-btn" style={view === v ? { background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid var(--border-primary)' } : {}}>
              {v === 'list' ? '☰ Lista' : '▦ Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-b)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🚨</span>
          <span style={{ color: 'var(--red-text)', fontSize: 13, fontWeight: 600 }}>{overdue.length} evento(s) vencido(s) — requieren atención inmediata</span>
        </div>
      )}

      {view === 'list' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          {upcoming.map((e, i) => {
            const c = colors[e.priority]
            const isToday = e.date === today
            return (
              <div key={`${e.date}-${e.title}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                borderBottom: '1px solid var(--border-light)',
                background: isToday ? 'rgba(201,168,76,0.06)' : 'transparent',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>
                  {new Date(e.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                </span>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{typeIcons[e.type]}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, flex: 1 }}>{e.title}</span>
                <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                  {e.type}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => { const d = new Date(gridYear, gridMonth - 2, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
            <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
              {new Date(gridYear, gridMonth - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(gridYear, gridMonth, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>→</button>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {gridDays.map((cell, i) => (
                <div key={i} style={{ minHeight: 60, padding: 4, borderRadius: 4, background: cell?.date === today ? 'rgba(201,168,76,0.08)' : cell ? 'var(--bg-elevated)' : 'transparent', border: cell?.date === today ? '1px solid var(--border-primary)' : '1px solid transparent' }}>
                  {cell && (
                    <>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: cell.date === today ? 'var(--amber-600)' : 'var(--text-secondary)', fontWeight: cell.date === today ? 700 : 400, marginBottom: 2 }}>{cell.day}</div>
                      {cell.events.slice(0, 2).map((e, j) => (
                        <div key={j} style={{ fontSize: 9, padding: '1px 3px', borderRadius: 2, background: colors[e.priority].bg, color: colors[e.priority].text, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {typeIcons[e.type]} {e.title.substring(0, 18)}
                        </div>
                      ))}
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
