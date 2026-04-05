'use client'

import { useEffect, useState, useMemo } from 'react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

type Bridge = {
  id: number; name: string; nameEs: string
  commercial: number | null; passenger: number | null
  status: string; updated: string | null
}

type HistoricalRow = {
  bridge_name: string | null
  crossing_hours: number | null
  day_of_week: number | null
  hour_of_day: number | null
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function waitColor(min: number | null): string {
  if (min == null) return 'var(--text-muted)'
  if (min < 30) return 'var(--success)'
  if (min < 60) return 'var(--warning-500, #D97706)'
  return 'var(--danger-500)'
}

function waitBg(min: number | null): string {
  if (min == null) return '#F5F4F0'
  if (min < 30) return 'rgba(22,163,74,0.08)'
  if (min < 60) return 'rgba(217,119,6,0.08)'
  return 'rgba(220,38,38,0.08)'
}

export default function CrucesPage() {
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [historical, setHistorical] = useState<HistoricalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  // Fetch live + historical
  useEffect(() => {
    async function load() {
      const [liveRes, histRes] = await Promise.all([
        fetch('/api/bridge-times').then(r => r.json()).catch(() => ({ bridges: [] })),
        fetch('/api/data?table=bridge_intelligence&limit=5000').then(r => r.json()).catch(() => ({ data: [] })),
      ])
      setBridges(liveRes.bridges || [])
      setHistorical(histRes.data || [])
      setLastUpdate(new Date().toISOString())
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // Refresh every 5 min
    return () => clearInterval(interval)
  }, [])

  const withData = bridges.filter(b => b.commercial !== null)
  const fastest = withData.length > 0 ? withData.reduce((a, b) => (a.commercial! < b.commercial! ? a : b)) : null

  // Best crossing hour recommendation from historical data
  const bestHour = useMemo(() => {
    if (historical.length === 0) return null
    const today = new Date().getDay()
    const todayData = historical.filter(r => r.day_of_week === today && r.crossing_hours != null)
    if (todayData.length < 3) return null

    // Group by hour
    const byHour: Record<number, number[]> = {}
    for (const r of todayData) {
      if (r.hour_of_day != null && r.crossing_hours != null) {
        if (!byHour[r.hour_of_day]) byHour[r.hour_of_day] = []
        byHour[r.hour_of_day].push(r.crossing_hours)
      }
    }

    let bestH = 7, bestAvg = Infinity
    for (const [h, vals] of Object.entries(byHour)) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length
      if (avg < bestAvg) { bestAvg = avg; bestH = parseInt(h) }
    }
    return { hour: bestH, avgHours: Math.round(bestAvg * 10) / 10 }
  }, [historical])

  // Historical averages by bridge
  const bridgeAverages = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    for (const r of historical) {
      const name = r.bridge_name || 'Desconocido'
      if (!map[name]) map[name] = { total: 0, count: 0 }
      if (r.crossing_hours != null) {
        map[name].total += r.crossing_hours
        map[name].count++
      }
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, avgHours: d.count > 0 ? Math.round((d.total / d.count) * 10) / 10 : 0, records: d.count }))
      .sort((a, b) => a.avgHours - b.avgHours)
  }, [historical])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Inteligencia de Cruces
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Tiempos de puentes en tiempo real · Laredo, TX — Nuevo Laredo
            {lastUpdate && <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 8 }}>Actualizado: {fmtDateTime(lastUpdate)}</span>}
          </p>
        </div>

        {/* Best time recommendation */}
        {bestHour && (
          <div style={{
            marginBottom: 24, padding: '16px 20px', borderRadius: 8,
            background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--success)', marginBottom: 4 }}>
              Mejor hora para cruzar hoy ({DAYS_ES[new Date().getDay()]})
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
              {bestHour.hour}:00 — {bestHour.hour + 1}:00
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Promedio histórico: {bestHour.avgHours}h · Basado en {historical.filter(r => r.day_of_week === new Date().getDay()).length} registros
            </div>
          </div>
        )}

        {/* Live wait times */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 8 }} />)}
          </div>
        ) : withData.length === 0 ? (
          <EmptyState icon="🌉" title="Sin datos de puentes" description="Los tiempos de cruce se actualizan cada 30 minutos" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
            {withData.map(b => {
              const isFastest = fastest && b.id === fastest.id
              return (
                <div key={b.id} style={{
                  padding: '16px 20px', borderRadius: 8,
                  background: waitBg(b.commercial),
                  border: `1px solid ${isFastest ? 'var(--success)' : 'var(--border)'}`,
                  borderLeft: `4px solid ${waitColor(b.commercial)}`,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {b.nameEs}
                    {isFastest && <span style={{ fontSize: 10, color: 'var(--success)', marginLeft: 6 }}>⚡ Más rápido</span>}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: waitColor(b.commercial) }}>
                    {b.commercial ?? '—'} <span style={{ fontSize: 14 }}>min</span>
                  </div>
                  {b.passenger != null && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Peatonal: {b.passenger} min
                    </div>
                  )}
                  {b.updated && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {fmtDateTime(b.updated)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Historical averages */}
        {bridgeAverages.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Promedios Históricos
            </h2>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8E5E0' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Puente</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Promedio</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {bridgeAverages.map((b, i) => (
                    <tr key={b.name} style={{ borderBottom: i < bridgeAverages.length - 1 ? '1px solid #E8E5E0' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: b.avgHours < 2 ? 'var(--success)' : b.avgHours < 4 ? 'var(--warning-500, #D97706)' : 'var(--danger-500)' }}>
                        {b.avgHours}h
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{b.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'var(--text-muted)' }}>
          Datos de CBP (U.S. Customs and Border Protection) · Actualización cada 30 min
          <br />Patente 3596 · Aduana 240 · Nuevo Laredo
        </div>
      </div>
    </div>
  )
}
