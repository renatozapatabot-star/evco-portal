'use client'

import { useEffect, useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Search, BarChart3, AlertTriangle } from 'lucide-react'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { fmtMXN, fmtDate } from '@/lib/format-utils'
import { GOLD } from '@/lib/design-system'
import { EmptyState } from '@/components/ui/EmptyState'

interface CarteraRow { consecutivo: number; cve_cliente: string; tipo: string; referencia: string; fecha: string; importe: number; saldo: number; moneda: string; observaciones: string }
interface IngresoRow { consecutivo: number; cve_cliente: string; forma_ingreso: string; referencia: string; fecha: string; importe: number; moneda: string; concepto: string }
interface EgresoRow { consecutivo: number; cve_cliente: string; forma_egreso: string; tipo_egreso: string; beneficiario: string; referencia: string; fecha: string; importe: number; moneda: string; concepto: string }
interface FacturaRow { consecutivo: number; cve_cliente: string; serie: string; folio: number; fecha: string; subtotal: number; iva: number; total: number; moneda: string; observaciones: string }

interface FinancialIntel { period: string; total_revenue: number; outstanding_receivables: number; avg_days_to_payment: number; operation_count: number; revenue_trend: string; projected_next_month: number }

type Tab = 'resumen' | 'cartera' | 'ingresos' | 'egresos' | 'facturas'

export function CuentasView() {
  const isMobile = useIsMobile()
  const [cartera, setCartera] = useState<CarteraRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [search, setSearch] = useState('')
  const [finIntel, setFinIntel] = useState<FinancialIntel[]>([])

  useEffect(() => {
    const clientClave = getClientClaveCookie()
    const companyId = getCompanyIdCookie()
    Promise.all([
      fetch(`/api/data?table=econta_cartera&cve_cliente=${clientClave}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_ingresos&cve_cliente=${clientClave}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_egresos&cve_cliente=${clientClave}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=econta_facturas&cve_cliente=${clientClave}&limit=5000&order_by=fecha&order_dir=desc`).then(r => r.json()),
    ]).then(([c, i, e, f]) => {
      setCartera(c.data ?? [])
      setIngresos(i.data ?? [])
      setEgresos(e.data ?? [])
      setFacturas(f.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))

    // Load financial intelligence (non-blocking)
    fetch(`/api/data?table=financial_intelligence&company_id=${companyId}&limit=24&order_by=period&order_dir=desc`)
      .then(r => r.json())
      .then(d => setFinIntel((d.data ?? []).reverse()))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [])

  const kpis = useMemo(() => {
    const totalCargos = cartera.filter(r => r.tipo === 'C').reduce((s, r) => s + (r.importe || 0), 0)
    const totalAbonos = cartera.filter(r => r.tipo === 'A').reduce((s, r) => s + (r.importe || 0), 0)
    const totalIngresos = ingresos.reduce((s, r) => s + (r.importe || 0), 0)
    const totalEgresos = egresos.reduce((s, r) => s + (r.importe || 0), 0)
    const totalFacturado = facturas.reduce((s, r) => s + (r.total || 0), 0)
    return { totalCargos, totalAbonos, saldo: totalCargos - totalAbonos, totalIngresos, totalEgresos, totalFacturado }
  }, [cartera, ingresos, egresos, facturas])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'cartera', label: `Cartera (${cartera.length})` },
    { key: 'ingresos', label: `Ingresos (${ingresos.length})` },
    { key: 'egresos', label: `Egresos (${egresos.length})` },
    { key: 'facturas', label: `Facturas (${facturas.length})` },
  ]

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--r-lg)' }} />)}
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-lg)' }} />
    </div>
  )

  if (!loading && cartera.length === 0 && ingresos.length === 0 && egresos.length === 0 && facturas.length === 0) return (
    <div className="p-6">
      <h1 className="page-title">Cuentas & Finanzas</h1>
      <EmptyState icon="💰" title="No hay datos financieros disponibles" description="Los datos de cartera, ingresos y egresos aparecerán después de la sincronización" />
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="page-title">Cuentas & Finanzas</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            eConta · {cartera.length.toLocaleString()} movimientos cartera · Clave {getClientClaveCookie()}
          </p>
        </div>
      </div>

      {/* KPI Cards — only show non-zero */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Saldo Cartera', value: fmtMXN(kpis.saldo), color: kpis.saldo > 0 ? 'var(--danger-t)' : 'var(--success-t)', show: kpis.saldo !== 0 },
          { label: 'Total Ingresos', value: fmtMXN(kpis.totalIngresos), color: 'var(--success-t)', show: kpis.totalIngresos > 0 },
          { label: 'Total Egresos', value: fmtMXN(kpis.totalEgresos), color: 'var(--danger-t)', show: kpis.totalEgresos > 0 },
          { label: 'Total Facturado', value: fmtMXN(kpis.totalFacturado), color: 'var(--n-900)', show: kpis.totalFacturado > 0 },
        ].filter(k => k.show).map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 36, color: k.color, fontFamily: 'var(--font-jetbrains-mono)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Financial Intelligence Panel */}
      {finIntel.length > 0 && (() => {
            const latest = finIntel[finIntel.length - 1]
            const prev = finIntel.length > 1 ? finIntel[finIntel.length - 2] : null
            const changePercent = prev && prev.total_revenue > 0 ? ((latest.total_revenue - prev.total_revenue) / prev.total_revenue * 100).toFixed(1) : null
            return (
              <div className="kpi-grid" style={{ marginBottom: 20 }}>
                {[
                  { label: 'Cuentas por Cobrar', value: fmtMXN(latest.outstanding_receivables), color: latest.outstanding_receivables > 100000 ? 'var(--danger-text)' : 'var(--n-900)', show: latest.outstanding_receivables > 0 },
                  { label: 'Promedio Dias Pago', value: `${Math.round(latest.avg_days_to_payment)} dias`, color: latest.avg_days_to_payment > 30 ? 'var(--danger-text)' : 'var(--success)', show: latest.avg_days_to_payment > 0 },
                  { label: 'Proyeccion Prox. Mes', value: fmtMXN(latest.projected_next_month), color: 'var(--n-900)', show: latest.projected_next_month > 0 },
                  { label: 'Tendencia', value: `${latest.revenue_trend === 'up' ? '↑' : latest.revenue_trend === 'down' ? '↓' : '→'} ${changePercent ? `${changePercent}%` : ''}`, color: latest.revenue_trend === 'up' ? 'var(--success)' : latest.revenue_trend === 'down' ? 'var(--danger-text)' : 'var(--text-secondary)', show: true },
                ].filter(k => k.show).map(k => (
                  <div key={k.label} className="kpi-card">
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value" style={{ fontSize: 36, color: k.color, fontFamily: 'var(--font-jetbrains-mono)' }}>{k.value}</div>
                  </div>
                ))}
              </div>
            )
          })()}

      {/* Monthly Revenue Chart (simple bar) */}
      {finIntel.length > 1 && (
            <div className="rounded-[10px] p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Ingreso Mensual — Últimos 12 Meses</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                {finIntel.slice(-12).map((m, i) => {
                  const maxRev = Math.max(...finIntel.slice(-12).map(f => f.total_revenue || 1))
                  const pct = (m.total_revenue / maxRev) * 100
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }}>
                        {m.total_revenue > 1000 ? `${(m.total_revenue / 1000).toFixed(0)}K` : ''}
                      </div>
                      <div style={{
                        width: '100%', minHeight: 4, height: `${Math.max(pct, 4)}%`,
                        background: i === finIntel.slice(-12).length - 1 ? GOLD : 'rgba(201,168,76,0.3)',
                        borderRadius: '3px 3px 0 0', transition: 'height 0.3s',
                      }} />
                      <div style={{ fontSize: 8.5, color: '#9ca3af', fontFamily: 'var(--font-data)' }}>
                        {m.period ? new Date(m.period).toLocaleDateString('es-MX', { month: 'short' }).slice(0, 3) : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

      {/* Aging Analysis */}
      {cartera.length > 0 && (() => {
        const now = Date.now()
        const aging = { current: 0, d30: 0, d60: 0, d90plus: 0 }
        cartera.forEach(r => {
          if (r.tipo !== 'CARGO') return
          const days = Math.floor((now - new Date(r.fecha).getTime()) / 86400000)
          const amt = Math.abs(r.importe || 0)
          if (days <= 30) aging.current += amt
          else if (days <= 60) aging.d30 += amt
          else if (days <= 90) aging.d60 += amt
          else aging.d90plus += amt
        })
        const total = aging.current + aging.d30 + aging.d60 + aging.d90plus
        if (total === 0) return null
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Antigüedad de Cartera</span></div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                {aging.current > 0 && <div style={{ flex: aging.current, background: 'var(--success)' }} />}
                {aging.d30 > 0 && <div style={{ flex: aging.d30, background: 'var(--warning)' }} />}
                {aging.d60 > 0 && <div style={{ flex: aging.d60, background: 'var(--warning)' }} />}
                {aging.d90plus > 0 && <div style={{ flex: aging.d90plus, background: 'var(--danger-500)' }} />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: '0-30 días', value: aging.current, color: 'var(--success)' },
                  { label: '30-60 días', value: aging.d30, color: 'var(--warning)' },
                  { label: '60-90 días', value: aging.d60, color: 'var(--warning)' },
                  { label: '90+ días', value: aging.d90plus, color: 'var(--danger-500)' },
                ].map(b => (
                  <div key={b.label}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: b.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--n-900)', marginTop: 4, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(b.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Recent movements */}
      <div className={`grid gap-4 ${egresos.length > 0 ? (isMobile ? 'grid-cols-1' : 'grid-cols-2') : 'grid-cols-1'}`}>
            <div className="rounded-[10px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Últimos Ingresos</div>
              </div>
              <table className="data-table">
                <thead><tr><th scope="col">Fecha</th><th scope="col">Referencia</th><th scope="col" style={{ textAlign: 'right' }}>Importe</th></tr></thead>
                <tbody>
                  {ingresos.slice(0, 8).map(r => (
                    <tr key={r.consecutivo}>
                      <td className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{fmtDate(r.fecha)}</td>
                      <td className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{r.referencia || r.concepto?.slice(0, 30) || ''}</td>
                      <td className="text-right mono text-[12px] font-medium" style={{ color: 'var(--success)' }}>{fmtMXN(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {egresos.length > 0 && (
              <div className="rounded-[10px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Últimos Egresos</div>
                </div>
                <table className="data-table">
                  <thead><tr><th scope="col">Fecha</th><th scope="col">Beneficiario</th><th scope="col" style={{ textAlign: 'right' }}>Importe</th></tr></thead>
                  <tbody>
                    {egresos.slice(0, 8).map(r => (
                      <tr key={r.consecutivo}>
                        <td>{fmtDate(r.fecha)}</td>
                        <td className="max-w-[180px] truncate">{r.beneficiario || r.concepto?.slice(0, 30) || ''}</td>
                        <td className="c-num" style={{ color: 'var(--danger-text)' }}>{fmtMXN(r.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

      {facturas.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">Ultimas Facturas ({facturas.length})</span>
          </div>
          <table className="data-table">
            <thead><tr><th scope="col">Serie-Folio</th><th scope="col">Fecha</th><th scope="col" style={{ textAlign: 'right' }}>Total</th><th scope="col">Moneda</th></tr></thead>
            <tbody>
              {facturas.slice(0, 8).map(r => (
                <tr key={r.consecutivo}>
                  <td className="c-id">{r.serie || ''}{r.folio || ''}</td>
                  <td>{fmtDate(r.fecha)}</td>
                  <td className="c-num">{fmtMXN(r.total)}</td>
                  <td style={{ color: 'var(--n-400)' }}>{r.moneda || 'MXN'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
