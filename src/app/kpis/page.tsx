'use client'

import { useEffect, useState, useMemo } from 'react'
import { getCookieValue } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Package, TrendingUp, Clock, Shield,
  DollarSign, FileText, Truck, BarChart3,
} from 'lucide-react'

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  importe_total?: number | null
  pedimento?: string | null
  regimen?: string | null
  descripcion_mercancia?: string | null
  [key: string]: unknown
}

interface FacturaRow {
  referencia?: string
  pedimento?: string
  valor_usd?: number
  dta?: number
  igi?: number
  iva?: number
  fraccion?: string
  [key: string]: unknown
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Package; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color || 'rgba(0,229,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color === 'rgba(34,197,94,0.12)' ? '#22C55E' : color === 'rgba(234,179,8,0.12)' ? '#eab308' : '#00E5FF'} strokeWidth={1.8} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8b9ab5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800,
        color: '#E6EDF3', lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 14, fontWeight: 700, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12, marginTop: 28,
    }}>
      {children}
    </h2>
  )
}

export default function KPIsPage() {
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }

    const tParams = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_llegada', order_dir: 'desc',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) tParams.set('company_id', companyId)

    const fParams = new URLSearchParams({ table: 'aduanet_facturas', limit: '5000' })
    if (!isInternal && clientClave) fParams.set('clave_cliente', clientClave)

    Promise.all([
      fetch(`/api/data?${tParams}`).then(r => r.json()),
      fetch(`/api/data?${fParams}`).then(r => r.json()),
    ])
      .then(([tData, fData]) => {
        setTraficos(Array.isArray(tData.data) ? tData.data : [])
        setFacturas(Array.isArray(fData.data) ? fData.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, clientClave, userRole])

  const kpis = useMemo(() => {
    if (traficos.length === 0) return null

    const total = traficos.length
    const cruzados = traficos.filter(t => t.estatus?.toLowerCase().includes('cruz'))
    const enProceso = traficos.filter(t => !t.estatus?.toLowerCase().includes('cruz'))
    const withPedimento = traficos.filter(t => t.pedimento)

    // Value
    const totalValueUSD = facturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
    const totalDTA = facturas.reduce((s, f) => s + (Number(f.dta) || 0), 0)
    const totalIGI = facturas.reduce((s, f) => s + (Number(f.igi) || 0), 0)
    const totalIVA = facturas.reduce((s, f) => s + (Number(f.iva) || 0), 0)

    // Clearance time
    const clearanceTimes: number[] = []
    for (const t of cruzados) {
      if (t.fecha_llegada && t.fecha_cruce) {
        const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
        if (days > 0 && days < 365) clearanceTimes.push(days)
      }
    }
    const avgClearance = clearanceTimes.length > 0
      ? Math.round(clearanceTimes.reduce((s, d) => s + d, 0) / clearanceTimes.length * 10) / 10
      : null

    // T-MEC
    const tmecOps = traficos.filter(t => {
      const reg = (t.regimen || '').toUpperCase()
      return reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
    })
    const tmecPct = total > 0 ? Math.round(tmecOps.length / total * 100) : 0

    // Success rate (cruzados / total)
    const successRate = total > 0 ? Math.round(cruzados.length / total * 100) : 0

    // Monthly volumes
    const monthlyMap = new Map<string, number>()
    for (const t of traficos) {
      if (t.fecha_llegada) {
        const d = new Date(t.fecha_llegada)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1)
      }
    }
    const monthlyVolumes = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)

    // Top fracciones
    const fracMap = new Map<string, number>()
    for (const f of facturas) {
      const frac = (f as Record<string, unknown>).fraccion as string || ''
      if (frac && frac !== '—') {
        fracMap.set(frac, (fracMap.get(frac) || 0) + 1)
      }
    }
    const topFracciones = Array.from(fracMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    // Regimen breakdown
    const regimenMap = new Map<string, number>()
    for (const t of traficos) {
      const reg = (t.regimen || 'A1').toUpperCase()
      regimenMap.set(reg, (regimenMap.get(reg) || 0) + 1)
    }
    const regimenBreakdown = Array.from(regimenMap.entries())
      .sort((a, b) => b[1] - a[1])

    return {
      total, cruzados: cruzados.length, enProceso: enProceso.length,
      withPedimento: withPedimento.length,
      totalValueUSD, totalDTA, totalIGI, totalIVA,
      avgClearance, tmecPct, tmecOps: tmecOps.length, successRate,
      monthlyVolumes, topFracciones, regimenBreakdown,
    }
  }, [traficos, facturas])

  if (loading) {
    return (
      <div className="page-shell">
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!kpis || traficos.length === 0) {
    return (
      <div className="page-shell">
        <div className="table-shell" style={{ padding: 40 }}>
          <EmptyState icon="📊" title="Sin datos disponibles" description="Los indicadores de rendimiento se calcularán cuando haya operaciones registradas." />
        </div>
      </div>
    )
  }

  const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  const maxMonthly = Math.max(...kpis.monthlyVolumes.map(([, v]) => v), 1)

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 12 }}>
        <h1 className="page-title">Indicadores de Rendimiento</h1>
        <p className="page-subtitle">Análisis completo de operaciones aduanales</p>
      </div>

      {/* ── KPI Grid ─────────────────────────────────── */}
      <div className="kpi-page-grid" style={{ display: 'grid', gap: 12, marginBottom: 8 }}>
        <KPICard icon={Package} label="Operaciones Totales" value={String(kpis.total)}
          sub={`${kpis.cruzados} cruzados · ${kpis.enProceso} en proceso`} />
        <KPICard icon={DollarSign} label="Valor Importado USD" value={fmtUSD(kpis.totalValueUSD)}
          sub={`DTA ${fmtUSD(kpis.totalDTA)} · IGI ${fmtUSD(kpis.totalIGI)} · IVA ${fmtUSD(kpis.totalIVA)}`}
          color="rgba(234,179,8,0.12)" />
        <KPICard icon={Clock} label="Tiempo Promedio Despacho" value={kpis.avgClearance ? `${kpis.avgClearance} días` : 'N/D'}
          sub={kpis.avgClearance ? `De ${kpis.cruzados} operaciones cruzadas` : 'Sin datos de cruce disponibles'} />
        <KPICard icon={Shield} label="Tasa de Éxito" value={`${kpis.successRate}%`}
          sub={`${kpis.cruzados} de ${kpis.total} operaciones completadas`}
          color="rgba(34,197,94,0.12)" />
        <KPICard icon={TrendingUp} label="Cumplimiento T-MEC" value={`${kpis.tmecPct}%`}
          sub={`${kpis.tmecOps} operaciones con régimen T-MEC`} />
        <KPICard icon={FileText} label="Pedimentos Asignados" value={`${Math.round(kpis.withPedimento / kpis.total * 100)}%`}
          sub={`${kpis.withPedimento} de ${kpis.total} tráficos con pedimento`} />
      </div>

      {/* ── Volumen Mensual ──────────────────────────── */}
      <SectionTitle>Volumen Mensual de Operaciones</SectionTitle>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {kpis.monthlyVolumes.map(([month, count]) => {
            const pct = (count / maxMonthly) * 100
            const [y, m] = month.split('-')
            const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('es-MX', { month: 'short' })
            return (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#E6EDF3', fontWeight: 600 }}>
                  {count}
                </span>
                <div style={{
                  width: '100%', maxWidth: 32, height: `${Math.max(pct, 4)}%`,
                  background: 'linear-gradient(180deg, #00E5FF 0%, rgba(0,229,255,0.3) 100%)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: 4,
                }} />
                <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Distribución por Régimen ──────────────────── */}
      <SectionTitle>Distribución por Régimen</SectionTitle>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {kpis.regimenBreakdown.map(([reg, count]) => {
          const pct = Math.round(count / kpis.total * 100)
          const isTmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
          return (
            <div key={reg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                color: isTmec ? '#22C55E' : '#E6EDF3', minWidth: 40,
              }}>
                {reg}
              </span>
              <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: isTmec ? '#22C55E' : '#00E5FF',
                  borderRadius: 4, transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8b9ab5', minWidth: 60, textAlign: 'right' }}>
                {count} ({pct}%)
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Top Fracciones ───────────────────────────── */}
      {kpis.topFracciones.length > 0 && (
        <>
          <SectionTitle>Fracciones Arancelarias Más Frecuentes</SectionTitle>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {kpis.topFracciones.map(([frac, count]) => (
              <div key={frac} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: '#eab308' }}>
                  {frac}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#8b9ab5' }}>
                  {count} operaciones
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Responsive ───────────────────────────────── */}
      <style>{`
        .kpi-page-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 1024px) {
          .kpi-page-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .kpi-page-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
