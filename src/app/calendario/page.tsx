'use client'

import { useEffect, useState, useMemo } from 'react'
import { getCookieValue, getCompanyIdCookie, getClientClaveCookie } from '@/lib/client-config'
import { fmtDate, fmtDateShort } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'

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

/* ── Dark tokens ── */

const T = {
  card: '#1A1814',
  border: '#302C23',
  gold: '#B8953F',
  textPrimary: '#F5F0E8',
  textSecondary: '#A09882',
  textMuted: '#6B6355',
  blue: 'var(--info-500)',
  blueBg: '#1A2030',
  green: '#2D8F4E',
  greenDot: '#34D399',
  amber: '#D4A017',
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
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clientClave = getClientClaveCookie()
    const url = isBroker
      ? `/api/data?table=traficos&company_id=${companyId}&limit=2000&order_by=fecha_llegada&order_dir=desc`
      : `/api/data?table=traficos&company_id=${companyId}&limit=1000&order_by=fecha_llegada&order_dir=desc`
    fetch(url)
      .then(r => r.json())
      .then(d => setTraficos(d.data ?? []))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
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
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: T.radius, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: T.textSecondary }}>{emptyMsg}</div>
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
                  minHeight: 48,
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
    return { day, dateStr, arrivals, crossings }
  })

  const monthLabel = new Date(gridYear, gridMonth).toLocaleDateString('es-MX', {
    month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
          Calendario Operativo
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Cruces, llegadas y actividad del mes
        </p>
      </div>

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
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.blue }} />
            Llegada
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.greenDot }} />
            Cruce
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
              const hasEvents = cell && (cell.arrivals > 0 || cell.crossings > 0)
              return (
                <button
                  key={i}
                  onClick={() => cell && hasEvents && setSelectedDate(isSelected ? null : cell.dateStr)}
                  disabled={!cell || !hasEvents}
                  style={{
                    minHeight: isMobile ? 48 : 60,
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
                      </div>
                      {(cell.arrivals + cell.crossings) > 1 && (
                        <div style={{ fontSize: 9, color: T.textMuted, fontFamily: 'var(--font-mono)' }}>
                          {cell.arrivals + cell.crossings}
                        </div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

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
                  minHeight: 48,
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
