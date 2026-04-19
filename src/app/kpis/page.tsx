'use client'

import { useEffect, useState, useMemo } from 'react'
import { getCookieValue } from '@/lib/client-config'
import { EmptyState } from '@/components/ui/EmptyState'
import type { LucideIcon } from 'lucide-react'
import {
  Package, TrendingUp, Zap, Shield,
  DollarSign, FileText,
} from 'lucide-react'

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  fecha_pago?: string | null
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
  fecha_pago?: string | null
  [key: string]: unknown
}

// ── Premium KPI Card ───────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div className="kpi-premium-card" style={{
      position: 'relative',
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow: 'hidden',
    }}>
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
      }} />

      {/* Radial glow behind value */}
      <div style={{
        position: 'absolute', bottom: -20, left: '30%',
        width: 120, height: 60,
        background: `radial-gradient(ellipse, ${accent}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: `${accent}18`,
          border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={accent} strokeWidth={1.8} />
        </div>
        <span style={{
          fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, color: 'var(--portal-fg-4)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </span>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 800,
        color: 'var(--portal-fg-1)', lineHeight: 1.1, position: 'relative',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>

      {sub && (
        <div style={{
          fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', marginTop: 8, lineHeight: 1.4,
          position: 'relative',
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--portal-fg-4)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      marginBottom: 12, marginTop: 32,
    }}>
      {children}
    </h2>
  )
}

function GlassPanel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '24px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────

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

    // Speed score: % cleared within 48h of pedimento payment
    let fastClearCount = 0
    let clearWithDates = 0
    for (const t of cruzados) {
      const pago = t.fecha_pago as string | null
      const cruce = t.fecha_cruce as string | null
      if (pago && cruce) {
        clearWithDates++
        const hours = (new Date(cruce).getTime() - new Date(pago).getTime()) / 3600000
        if (hours >= 0 && hours <= 48) fastClearCount++
      }
    }
    const speedScore = clearWithDates > 0 ? Math.round(fastClearCount / clearWithDates * 100) : null

    // T-MEC
    const tmecOps = traficos.filter(t => {
      const reg = (t.regimen || '').toUpperCase()
      return reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
    })
    const tmecPct = total > 0 ? Math.round(tmecOps.length / total * 100) : 0

    // Success rate
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
      if (frac && frac !== '—') fracMap.set(frac, (fracMap.get(frac) || 0) + 1)
    }
    const topFracciones = Array.from(fracMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)

    // Regimen breakdown
    const regimenMap = new Map<string, number>()
    for (const t of traficos) {
      const reg = (t.regimen || 'A1').toUpperCase()
      regimenMap.set(reg, (regimenMap.get(reg) || 0) + 1)
    }
    const regimenBreakdown = Array.from(regimenMap.entries()).sort((a, b) => b[1] - a[1])

    return {
      total, cruzados: cruzados.length, enProceso: enProceso.length,
      withPedimento: withPedimento.length,
      totalValueUSD, totalDTA, totalIGI, totalIVA,
      speedScore, fastClearCount, clearWithDates,
      tmecPct, tmecOps: tmecOps.length, successRate,
      monthlyVolumes, topFracciones, regimenBreakdown,
    }
  }, [traficos, facturas])

  if (loading) {
    return (
      <div className="page-shell">
        <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 16 }} />
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
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Indicadores de Rendimiento</h1>
        <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Análisis completo de operaciones aduanales
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)',
            background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6,
          }}>
            Datos desde ene 2024
          </span>
        </p>
      </div>

      {/* ── KPI Grid ─────────────────────────────────── */}
      <div className="kpi-page-grid" style={{ display: 'grid', gap: 14, marginBottom: 8 }}>
        <KPICard icon={Package} accent="var(--portal-fg-3)"
          label="Operaciones Totales" value={String(kpis.total)}
          sub={`${kpis.cruzados} cruzados · ${kpis.enProceso} en proceso`} />

        <KPICard icon={DollarSign} accent="var(--portal-fg-1)"
          label="Valor Importado USD" value={fmtUSD(kpis.totalValueUSD)}
          sub={`DTA ${fmtUSD(kpis.totalDTA)} · IGI ${fmtUSD(kpis.totalIGI)} · IVA ${fmtUSD(kpis.totalIVA)}`} />

        <KPICard icon={Zap} accent="var(--portal-status-green-fg)"
          label="Despacho Rápido"
          value={kpis.speedScore !== null ? `${kpis.speedScore}%` : 'N/D'}
          sub={kpis.speedScore !== null
            ? `${kpis.fastClearCount} de ${kpis.clearWithDates} cruzados en menos de 48h`
            : 'Sin datos de pago/cruce disponibles'} />

        <KPICard icon={Shield} accent="#10B981"
          label="Tasa de Éxito" value={`${kpis.successRate}%`}
          sub={`${kpis.cruzados} de ${kpis.total} operaciones completadas`} />

        <KPICard icon={TrendingUp} accent="var(--portal-ice-3)"
          label="Cumplimiento T-MEC" value={`${kpis.tmecPct}%`}
          sub={`${kpis.tmecOps} operaciones con régimen T-MEC`} />

        <KPICard icon={FileText} accent="#3B82F6"
          label="Pedimentos Asignados" value={`${Math.round(kpis.withPedimento / kpis.total * 100)}%`}
          sub={`${kpis.withPedimento} de ${kpis.total} embarques con pedimento`} />
      </div>

      {/* ── Volumen Mensual ──────────────────────────── */}
      <SectionTitle>Volumen Mensual de Operaciones</SectionTitle>
      <GlassPanel>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
          {kpis.monthlyVolumes.map(([month, count]) => {
            const pct = (count / maxMonthly) * 100
            const [y, m] = month.split('-')
            const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('es-MX', { month: 'short' })
            return (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-1)', fontWeight: 700 }}>
                  {count}
                </span>
                <div style={{
                  width: '100%', maxWidth: 36,
                  height: `${Math.max(pct, 6)}%`,
                  background: 'linear-gradient(180deg, #C0C5CE 0%, #C0C5CE44 60%, #C0C5CE11 100%)',
                  borderRadius: '6px 6px 2px 2px',
                  minHeight: 6,
                  boxShadow: count > 0 ? '0 0 8px #C0C5CE22' : 'none',
                }} />
                <span style={{ fontSize: 9, color: 'var(--portal-fg-5)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </GlassPanel>

      {/* ── Distribución por Régimen ──────────────────── */}
      <SectionTitle>Distribución por Régimen</SectionTitle>
      <GlassPanel style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {kpis.regimenBreakdown.map(([reg, count]) => {
          const pct = Math.round(count / kpis.total * 100)
          const isTmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
          const barColor = isTmec ? 'var(--portal-status-green-fg)' : 'var(--portal-fg-3)'
          return (
            <div key={reg} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                color: isTmec ? 'var(--portal-status-green-fg)' : 'var(--portal-fg-1)', minWidth: 44,
              }}>
                {reg}
              </span>
              <div style={{
                flex: 1, height: 10, background: 'rgba(255,255,255,0.06)',
                borderRadius: 5, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                  borderRadius: 5,
                  boxShadow: `0 0 6px ${barColor}33`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)',
                minWidth: 70, textAlign: 'right',
              }}>
                {count} ({pct}%)
              </span>
            </div>
          )
        })}
      </GlassPanel>

      {/* ── Top Fracciones ───────────────────────────── */}
      {kpis.topFracciones.length > 0 && (
        <>
          <SectionTitle>Fracciones Arancelarias Más Frecuentes</SectionTitle>
          <GlassPanel style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {kpis.topFracciones.map(([frac, count], i) => (
              <div key={frac} className="fraccion-row" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 4px',
                borderBottom: i < kpis.topFracciones.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                borderRadius: 4,
                transition: 'background 150ms ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)',
                    minWidth: 20, textAlign: 'right',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>
                    {frac}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)' }}>
                  {count} operaciones
                </span>
              </div>
            ))}
          </GlassPanel>
        </>
      )}

      {/* ── Responsive + hover styles ────────────────── */}
      <style>{`
        .kpi-page-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        .kpi-premium-card {
          transition: transform 150ms ease, box-shadow 150ms ease;
        }
        .kpi-premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08) !important;
        }
        .fraccion-row:hover {
          background: rgba(255,255,255,0.03);
        }
        @media (max-width: 1024px) {
          .kpi-page-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .kpi-page-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .kpi-premium-card {
            padding: 18px !important;
          }
        }
      `}</style>
    </div>
  )
}
