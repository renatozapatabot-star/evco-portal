'use client'

import { useEffect, useState, useMemo } from 'react'
import { fmtId, fmtDate } from '@/lib/format-utils'
import { COMPANY_ID } from '@/lib/client-config'
import { Calendar, Package, AlertTriangle, CheckCircle } from 'lucide-react'

interface Prediction { description: string; due_date?: string; severity: string; prediction_type: string }
interface Trafico { trafico: string; descripcion_mercancia?: string; fecha_llegada?: string; estatus?: string }

export default function PlaneacionPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [traficos, setTraficos] = useState<Trafico[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyPrep, setWeeklyPrep] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=compliance_predictions&company_id=${COMPANY_ID}&limit=50`).then(r => r.json()),
      fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&limit=200&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
    ]).then(([pRes, tRes]) => {
      setPredictions((pRes.data || []).filter((p: any) => p.prediction_type === 'import_forecast'))
      setTraficos(tRes.data || [])
    }).catch(() => {}).finally(() => setLoading(false))

    // Load weekly prep data
    fetch(`/api/data?table=compliance_predictions&company_id=${COMPANY_ID}&limit=50&order_by=created_at&order_dir=desc`)
      .then(r => r.json())
      .then(res => {
        const prep = (res.data || []).find((p: any) => p.prediction_type === 'weekly_prep')
        if (prep) try { setWeeklyPrep(JSON.parse(prep.description)) } catch {}
      }).catch(() => {})
  }, [])

  // Derive product patterns from traficos
  const patterns = useMemo(() => {
    const grouped: Record<string, { dates: string[]; desc: string }> = {}
    traficos.forEach(t => {
      if (!t.descripcion_mercancia || !t.fecha_llegada) return
      const key = (t.descripcion_mercancia || '').split(' ').slice(0, 2).join(' ').toUpperCase()
      if (!grouped[key]) grouped[key] = { dates: [], desc: t.descripcion_mercancia }
      grouped[key].dates.push(t.fecha_llegada)
    })
    return Object.entries(grouped)
      .filter(([, v]) => v.dates.length >= 3)
      .map(([key, v]) => {
        const sorted = v.dates.sort()
        const intervals: number[] = []
        for (let i = 1; i < sorted.length; i++) {
          const d = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
          if (d > 0 && d < 365) intervals.push(d)
        }
        const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0
        const lastDate = sorted[sorted.length - 1]
        const daysSinceLast = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        const daysUntilNext = Math.max(0, Math.round(avgInterval - daysSinceLast))
        return { product: key, description: v.desc, count: v.dates.length, avgInterval: Math.round(avgInterval), daysSinceLast, daysUntilNext, lastDate }
      })
      .filter(p => p.avgInterval > 0 && p.avgInterval < 90)
      .sort((a, b) => a.daysUntilNext - b.daysUntilNext)
      .slice(0, 15)
  }, [traficos])

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Planeación de Importaciones</h1>
        <p className="pg-meta">Predicciones basadas en {traficos.length} tráficos históricos</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>Analizando patrones...</div>
      ) : (
        <>
          {/* Weekly Kanban */}
          {weeklyPrep && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { title: 'Urgente', items: weeklyPrep.items?.overdue || [], color: 'var(--status-red)', count: weeklyPrep.overdue },
                { title: 'Esta Semana', items: weeklyPrep.items?.thisWeek || [], color: 'var(--status-yellow, #eab308)', count: weeklyPrep.thisWeek },
                { title: 'Listo para Transmitir', items: weeklyPrep.items?.readyToTransmit || [], color: 'var(--status-green)', count: weeklyPrep.readyToTransmit },
                { title: 'Esperando Docs', items: weeklyPrep.items?.waitingDocs || [], color: 'var(--text-muted)', count: weeklyPrep.waitingDocs },
              ].map(col => (
                <div key={col.title} className="card" style={{ borderTop: `3px solid ${col.color}` }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{col.title}</span>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: col.color }}>{col.count || 0}</span>
                  </div>
                  <div style={{ padding: '8px 12px', maxHeight: 200, overflowY: 'auto' }}>
                    {col.items.slice(0, 5).map((item: any, i: number) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                        onClick={() => window.location.href = `/traficos/${item.id}`}>
                        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.id ? fmtId(item.id) : '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{(item.supplier || '').substring(0, 25)}</div>
                      </div>
                    ))}
                    {col.items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>—</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming predictions */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-head">
              <span className="card-title">Próximas Importaciones Predichas</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{patterns.length} patrones detectados</span>
            </div>
            {patterns.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Insuficientes datos para predecir</div>
            ) : (
              <div>
                {patterns.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    borderBottom: '1px solid var(--border-light)',
                    background: p.daysUntilNext <= 3 ? 'rgba(220,38,38,0.03)' : p.daysUntilNext <= 7 ? 'rgba(217,119,6,0.03)' : 'transparent',
                  }}>
                    <div style={{ width: 40, textAlign: 'center' }}>
                      {p.daysUntilNext <= 3 ? <AlertTriangle size={18} style={{ color: 'var(--status-red)' }} /> :
                       p.daysUntilNext <= 7 ? <Package size={18} style={{ color: 'var(--status-yellow)' }} /> :
                       <Calendar size={18} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.product}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Cada ~{p.avgInterval} días · {p.count} importaciones · Último: {p.lastDate || fmtDate(new Date(Date.now() - p.daysSinceLast * 86400000))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: p.daysUntilNext <= 3 ? 'var(--status-red)' : p.daysUntilNext <= 7 ? 'var(--status-yellow)' : 'var(--text-primary)' }}>
                        {fmtDate(new Date(Date.now() + p.daysUntilNext * 86400000))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>estimado</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI predictions from compliance table */}
          {predictions.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Predicciones AI</span>
              </div>
              {predictions.map((p, i) => (
                <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 12 }}>
                  <CheckCircle size={14} style={{ color: 'var(--status-green)', flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.description}</div>
                    {p.due_date && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Est: {fmtDate(p.due_date)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
