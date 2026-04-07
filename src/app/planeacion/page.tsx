'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDate } from '@/lib/format-utils'
import { Truck, Package, BarChart3, MessageSquare } from 'lucide-react'
import Link from 'next/link'

interface TraficoRow {
  trafico: string
  fecha_llegada: string | null
  estatus: string | null
  descripcion_mercancia: string | null
  [k: string]: unknown
}

interface PipelineRow {
  trafico_number: string
  pipeline_stage: string | null
  [k: string]: unknown
}

interface BridgeTime {
  id: number; name: string; nameEs: string
  commercial: number | null; status: string
}

const T = {
  bg: 'var(--bg-main)',
  card: 'var(--bg-card)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  gray: 'var(--text-muted)',
  gold: 'var(--gold)',
  green: 'var(--success)',
  amber: 'var(--warning-500, #D97706)',
  red: 'var(--danger-500)',
  r: 8,
} as const

function getWeekRange(): { start: string; end: string; dayLabels: string[] } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const labels: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    labels.push(d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }))
  }
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0], dayLabels: labels }
}

export default function PlaneacionPage() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [pipeline, setPipeline] = useState<PipelineRow[]>([])
  const [bridges, setBridges] = useState<BridgeTime[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    const role = getCookieValue('user_role')
    if (role !== 'broker' && role !== 'admin') return

    Promise.all([
      fetch('/api/data?table=traficos&limit=5000&order_by=fecha_llegada&order_dir=desc').then(r => r.json()),
      fetch('/api/data?table=pipeline_overview&limit=500').then(r => r.json()),
      fetch('/api/bridge-times').then(r => r.json()),
    ]).then(([trafData, pipeData, bridgeData]) => {
      setTraficos((trafData.data ?? []) as TraficoRow[])
      setPipeline((pipeData.data ?? []) as PipelineRow[])
      setBridges((bridgeData.bridges ?? []) as BridgeTime[])
    }).catch((err: unknown) => console.error('[planeacion] fetch failed:', (err as Error).message)).finally(() => setLoading(false))
  }, [])

  const week = useMemo(() => getWeekRange(), [])

  // Section 1: This week's arrivals
  const arrivingThisWeek = useMemo(() =>
    traficos.filter(t => t.fecha_llegada && t.fecha_llegada >= week.start && t.fecha_llegada <= week.end)
  , [traficos, week])

  const readyToFile = useMemo(() =>
    pipeline.filter(r => (r.pipeline_stage || '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_file')
  , [pipeline])

  const readyToCross = useMemo(() =>
    pipeline.filter(r => (r.pipeline_stage || '').toLowerCase().replace(/\s+/g, '_') === 'ready_to_cross')
  , [pipeline])

  const checklist = useMemo(() => {
    const items: { id: string; label: string; detail: string; color: string }[] = []
    readyToCross.forEach(r => items.push({
      id: `cross-${r.trafico_number}`, label: `Cruzar ${fmtId(r.trafico_number)}`,
      detail: 'Listo para cruce', color: T.green,
    }))
    readyToFile.forEach(r => items.push({
      id: `file-${r.trafico_number}`, label: `Despachar ${fmtId(r.trafico_number)}`,
      detail: 'Listo para transmitir', color: T.gold,
    }))
    arrivingThisWeek.forEach(t => items.push({
      id: `arr-${t.trafico}`, label: `Llegada ${fmtId(t.trafico)}`,
      detail: fmtDate(t.fecha_llegada), color: T.amber,
    }))
    return items
  }, [arrivingThisWeek, readyToFile, readyToCross])

  // Section 2: Capacity
  const activeCount = useMemo(() =>
    traficos.filter(t => !(t.estatus || '').toLowerCase().includes('cruz')).length
  , [traficos])

  const historicalAvg = useMemo(() => {
    const months = new Map<string, number>()
    traficos.forEach(t => {
      if (!t.fecha_llegada) return
      const key = t.fecha_llegada.slice(0, 7)
      months.set(key, (months.get(key) || 0) + 1)
    })
    const vals = [...months.values()]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }, [traficos])

  const busiestDay = useMemo(() => {
    const dayCounts = new Map<string, number>()
    arrivingThisWeek.forEach(t => {
      if (!t.fecha_llegada) return
      const d = new Date(t.fecha_llegada).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' })
      dayCounts.set(d, (dayCounts.get(d) || 0) + 1)
    })
    let best = { day: 'Sin llegadas', count: 0 }
    dayCounts.forEach((count, day) => { if (count > best.count) best = { day, count } })
    return best
  }, [arrivingThisWeek])

  const fastestBridge = useMemo(() => {
    const withData = bridges.filter(b => b.commercial !== null && b.commercial !== undefined)
    if (withData.length === 0) return null
    return withData.reduce((a, b) => (a.commercial! < b.commercial! ? a : b))
  }, [bridges])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: T.gold, animation: 'cruzPulse 1.5s infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: 32, color: T.text }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Planeación Semanal</h1>
        <p style={{ fontSize: 13, color: T.textSec, marginBottom: 32 }}>
          Semana del {week.start} al {week.end}
        </p>

        {/* ═══ SECTION 1 — This week's plan ═══ */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.gray, marginBottom: 12 }}>
            Plan de la semana
          </h2>
          {checklist.length === 0 ? (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>Sin actividades esta semana</div>
              <div style={{ fontSize: 13, color: T.textSec }}>Las llegadas y cruces programados aparecerán aquí</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {checklist.map(item => {
                const done = checked.has(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: T.card, border: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${done ? T.gray : item.color}`,
                      borderRadius: T.r, padding: '12px 16px', cursor: 'pointer',
                      opacity: done ? 0.5 : 1, transition: 'opacity 150ms',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: done ? 'none' : `2px solid ${T.gray}`,
                      background: done ? T.green : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: '#FFF', fontWeight: 700,
                    }}>
                      {done ? '\u2713' : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: T.text,
                        textDecoration: done ? 'line-through' : 'none',
                      }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSec, fontFamily: 'var(--font-jetbrains-mono)' }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ SECTION 2 — Capacity indicators ═══ */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.gray, marginBottom: 12 }}>
            Capacidad
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec, marginBottom: 6 }}>
                Activos
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>
                {activeCount}
              </div>
              <div style={{ fontSize: 11, color: T.gray, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                prom. {historicalAvg}/mes
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec, marginBottom: 6 }}>
                Día pico
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
                {busiestDay.day}
              </div>
              {busiestDay.count > 0 && (
                <div style={{ fontSize: 11, color: T.gray, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                  {busiestDay.count} llegada{busiestDay.count !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec, marginBottom: 6 }}>
                Puente
              </div>
              {fastestBridge ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>
                    {fastestBridge.nameEs}
                  </div>
                  <div style={{ fontSize: 11, color: T.gray, fontFamily: 'var(--font-jetbrains-mono)', marginTop: 2 }}>
                    {fastestBridge.commercial} min
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: T.gray }}>Sin datos</div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3 — Quick links ═══ */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.gray, marginBottom: 12 }}>
            Acceso rápido
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { href: '/traficos', label: 'Tráficos', icon: <Truck size={20} />, count: activeCount },
              { href: '/bodega', label: 'Bodega', icon: <Package size={20} />, count: null },
              { href: '/reportes', label: 'Reportes', icon: <BarChart3 size={20} />, count: null },
              { href: '/cruz', label: 'CRUZ AI', icon: <MessageSquare size={20} />, count: null },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: T.card, border: `1px solid ${T.border}`,
                  borderRadius: T.r, padding: '16px 20px',
                  textDecoration: 'none', color: T.text,
                  transition: 'border-color 150ms',
                }}
              >
                <div style={{ color: T.gold }}>{link.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{link.label}</div>
                </div>
                {link.count !== null && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)',
                    color: T.gold,
                  }}>
                    {link.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
