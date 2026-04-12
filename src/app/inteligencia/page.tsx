'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Users2, Shield, Brain, AlertTriangle } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'

interface Stats {
  totalTraficos: number
  totalCruzados: number
  totalClassified: number
  avgConfidence: number
  topFracciones: { fraccion: string; count: number }[]
  monthlyVolume: { month: string; count: number }[]
  recentAnomalies: number
}

function KpiCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: typeof BarChart3; sub?: string }) {
  return (
    <div className="cc-card" style={{
      padding: 20, borderRadius: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={18} style={{ color: '#00E5FF', opacity: 0.7 }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: '#E6EDF3' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>}
    </div>
  )
}

export default function InteligenciaPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const role = getCookieValue('user_role')
  const isInternal = role === 'admin' || role === 'broker' || role === 'operator'

  useEffect(() => {
    async function load() {
      try {
        const companyId = getCompanyIdCookie()
        const companyFilter = isInternal ? '' : `&company_id=${companyId}`

        const [trafRes, prodRes] = await Promise.all([
          fetch(`/api/data?table=traficos&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01${companyFilter}`).then(r => r.json()),
          fetch(`/api/data?table=globalpc_productos&limit=1000${companyFilter}`).then(r => r.json()),
        ])

        const traficos = trafRes.data || []
        const productos = prodRes.data || []

        const totalTraficos = traficos.length
        const totalCruzados = traficos.filter((t: Record<string, unknown>) => ((t.estatus as string) || '').toLowerCase().includes('cruz')).length

        const classified = productos.filter((p: Record<string, unknown>) => p.fraccion && p.fraccion !== '')
        const totalClassified = classified.length
        const confidences = classified.filter((p: Record<string, unknown>) => typeof p.confidence === 'number').map((p: Record<string, unknown>) => p.confidence as number)
        const avgConfidence = confidences.length > 0 ? Math.round(confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length * 100) : 0

        // Top fracciones
        const fraccionCounts: Record<string, number> = {}
        classified.forEach((p: Record<string, unknown>) => {
          const f = p.fraccion as string
          if (f) fraccionCounts[f] = (fraccionCounts[f] || 0) + 1
        })
        const topFracciones = Object.entries(fraccionCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([fraccion, count]) => ({ fraccion, count }))

        // Monthly volume (last 12 months)
        const monthlyVolume: Record<string, number> = {}
        traficos.forEach((t: Record<string, unknown>) => {
          const date = (t.fecha_llegada as string) || (t.created_at as string) || ''
          const month = date.slice(0, 7)
          if (month) monthlyVolume[month] = (monthlyVolume[month] || 0) + 1
        })
        const sortedMonths = Object.entries(monthlyVolume)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([month, count]) => ({ month, count }))

        setStats({
          totalTraficos, totalCruzados, totalClassified, avgConfidence,
          topFracciones, monthlyVolume: sortedMonths, recentAnomalies: 0,
        })
      } catch {
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isInternal])

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', marginBottom: 24 }}>Inteligencia del Corredor</div>
        <div style={{ color: '#64748b', fontSize: 14 }}>Cargando datos...</div>
      </div>
    )
  }

  const s = stats || { totalTraficos: 0, totalCruzados: 0, totalClassified: 0, avgConfidence: 0, topFracciones: [], monthlyVolume: [], recentAnomalies: 0 }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>Inteligencia del Corredor</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Laredo–Nuevo Laredo · Análisis agregado desde 2024</p>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Operaciones totales" value={s.totalTraficos} icon={BarChart3} sub="desde 2024" />
        <KpiCard label="Cruces completados" value={s.totalCruzados} icon={TrendingUp} sub={`${s.totalTraficos > 0 ? Math.round(s.totalCruzados / s.totalTraficos * 100) : 0}% tasa de cruce`} />
        <KpiCard label="Productos clasificados" value={s.totalClassified} icon={Brain} sub="por Portal AI" />
        <KpiCard label="Confianza promedio" value={`${s.avgConfidence}%`} icon={Shield} sub="clasificación AI" />
      </div>

      {/* Top Fracciones */}
      <div className="cc-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 16 }}>
          Top 10 fracciones por volumen
        </div>
        {s.topFracciones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.topFracciones.map((f, i) => (
              <div key={f.fraccion} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', width: 20 }}>{i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#E6EDF3' }}>
                    {f.fraccion.includes('.') ? f.fraccion : f.fraccion.replace(/^(\d{4})(\d{2})(\d{2})(\d*)$/, '$1.$2.$3')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    height: 4, borderRadius: 2, background: 'rgba(0,229,255,0.15)',
                    width: Math.max(20, (f.count / (s.topFracciones[0]?.count || 1)) * 120),
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: '100%',
                      background: 'linear-gradient(90deg, #00f0ff, #0088ff)',
                      opacity: 0.6,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94a3b8', minWidth: 40, textAlign: 'right' }}>{f.count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>Sin datos de clasificación disponibles.</div>
        )}
      </div>

      {/* Monthly Volume */}
      <div className="cc-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 16 }}>
          Volumen mensual de operaciones
        </div>
        {s.monthlyVolume.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {s.monthlyVolume.map(m => {
              const maxCount = Math.max(...s.monthlyVolume.map(x => x.count))
              const height = maxCount > 0 ? (m.count / maxCount) * 100 : 0
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%', maxWidth: 40, height: `${height}%`, minHeight: 2,
                    borderRadius: '4px 4px 0 0',
                    background: 'linear-gradient(180deg, #00E5FF, #0044cc)',
                    opacity: 0.6,
                  }} />
                  <span style={{ fontSize: 9, color: '#64748b', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>Sin datos históricos disponibles.</div>
        )}
      </div>

      {/* Performance Summary */}
      <div className="cc-card" style={{ padding: 24, borderRadius: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ color: '#00E5FF', opacity: 0.7 }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>Rendimiento Portal AI</span>
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          {s.totalClassified > 0 ? (
            <>
              El Portal ha clasificado <strong style={{ color: '#E6EDF3' }}>{s.totalClassified.toLocaleString()}</strong> productos con una confianza promedio de{' '}
              <strong style={{ color: '#00E5FF' }}>{s.avgConfidence}%</strong>.
              {s.totalClassified > 100 && <> Esto representa un ahorro estimado de <strong style={{ color: '#eab308' }}>{Math.round(s.totalClassified * 3 / 60)} horas</strong> de trabajo manual.</>}
            </>
          ) : (
            'La clasificación automática se activará cuando se procesen productos.'
          )}
        </div>
      </div>

      {/* Supplier Performance */}
      <div className="cc-card" style={{ padding: 24, borderRadius: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 16 }}>
          <Users2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, color: '#00E5FF', opacity: 0.7 }} />
          Rendimiento de proveedores
        </div>
        {s.topFracciones.length > 0 ? (
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            <strong style={{ color: '#E6EDF3' }}>{s.topFracciones.length}</strong> fracciones activas de{' '}
            <strong style={{ color: '#E6EDF3' }}>{s.totalTraficos.toLocaleString()}</strong> operaciones.
            {s.totalCruzados > 0 && (
              <> Tasa de cruce: <strong style={{ color: '#00E5FF' }}>{Math.round(s.totalCruzados / s.totalTraficos * 100)}%</strong>.</>
            )}
            {' '}Los datos de proveedores se enriquecerán automáticamente conforme se procesen más operaciones.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#64748b' }}>Los perfiles de proveedores aparecerán cuando haya suficientes operaciones procesadas.</div>
        )}
      </div>
    </div>
  )
}
