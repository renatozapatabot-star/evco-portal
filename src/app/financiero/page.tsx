'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  DollarSign, TrendingUp, ShieldCheck, BarChart3,
  Search, ChevronLeft, ChevronRight, ArrowUpDown,
  RefreshCw, FileText,
} from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtUSD, fmtUSDCompact, fmtDate, fmtPedimento } from '@/lib/format-utils'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  cardBorder: '#E8E5E0',
  gold: '#C4963C',
  goldSubtle: 'rgba(196,150,60,0.08)',
  text: '#1A1A1A',
  textSec: '#6B6B6B',
  textMuted: '#9B9B9B',
  green: '#16A34A',
  amber: '#D97706',
  mono: 'var(--font-mono)',
  sans: 'var(--font-sans)',
  r: 8,
} as const

/* ── Types ── */
interface TraficoRow {
  trafico: string
  estatus?: string
  importe_total?: number | null
  regimen?: string | null
  fecha_cruce?: string | null
  company_id?: string | null
  clave_cliente?: string | null
  [k: string]: unknown
}

interface FacturaRow {
  id?: number
  factura?: string | null
  proveedor?: string | null
  valor_usd?: number | null
  fecha_pago?: string | null
  referencia?: string | null
  pedimento?: string | null
  clave_cliente?: string | null
  [k: string]: unknown
}

interface TipoCambio {
  tc: number
  fecha: string
  source: string
}

type SortCol = 'factura' | 'proveedor' | 'valor_usd' | 'fecha_pago' | 'referencia'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

/* ═══════════════════════════════════════════════════════════
   FINANCIERO PAGE
   ═══════════════════════════════════════════════════════════ */
export default function FinancieroPage() {
  const [role, setRole] = useState<string>('')
  const [companyClave, setCompanyClave] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')

  // Data
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [tc, setTc] = useState<TipoCambio | null>(null)
  const [loading, setLoading] = useState(true)
  const [facturasLoading, setFacturasLoading] = useState(true)

  // Table state
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'fecha_pago', dir: 'desc' })
  const [page, setPage] = useState(0)

  // Company filter for broker
  const [companyFilter, setCompanyFilter] = useState<string>('')

  useEffect(() => {
    const r = getCookieValue('user_role') || 'client'
    const clave = getCookieValue('company_clave') || ''
    const cid = getCookieValue('company_id') || ''
    setRole(r)
    setCompanyClave(clave)
    setCompanyId(cid)
  }, [])

  // Fetch all data
  useEffect(() => {
    if (!role) return

    const isInternal = role === 'broker' || role === 'admin'
    const claveParam = isInternal ? '' : `&clave_cliente=${companyClave}`
    const companyParam = isInternal ? '' : `&company_id=${companyId}`

    // Fetch traficos, facturas, tipo de cambio in parallel
    Promise.all([
      fetch(`/api/data?table=traficos${companyParam}&limit=5000&order_by=importe_total&order_dir=desc`)
        .then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/data?table=aduanet_facturas${claveParam}&limit=5000&order_by=fecha_pago&order_dir=desc`)
        .then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/tipo-cambio')
        .then(r => r.json()).catch(() => ({ tc: 17.50, fecha: '', source: 'fallback' })),
    ]).then(([trafData, factData, tcData]) => {
      setTraficos(trafData.data ?? [])
      setFacturas(factData.data ?? [])
      setTc(tcData)
      setLoading(false)
      setFacturasLoading(false)
    })
  }, [role, companyClave, companyId])

  // ── KPI calculations ──
  const kpis = useMemo(() => {
    let filtered = traficos
    if (companyFilter) {
      filtered = traficos.filter(t =>
        (t.company_id || '').toLowerCase().includes(companyFilter.toLowerCase()) ||
        (t.clave_cliente || '').includes(companyFilter)
      )
    }

    const active = filtered.filter(t => !(t.estatus || '').toLowerCase().includes('cruz'))
    const valorTotal = active.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const cruzadoMes = filtered.filter(t => {
      if (!(t.estatus || '').toLowerCase().includes('cruz')) return false
      if (!t.fecha_cruce) return false
      return new Date(t.fecha_cruce) >= monthStart
    })
    const valorCruzado = cruzadoMes.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

    // T-MEC savings: regimen IMD → estimated 8% savings on value
    const imdTraficos = active.filter(t => (t.regimen || '').toUpperCase().includes('IMD'))
    const ahorrosTmec = imdTraficos.reduce((s, r) => s + (Number(r.importe_total) || 0) * 0.08, 0)

    const promedio = active.length > 0 ? valorTotal / active.length : 0

    return { valorTotal, valorCruzado, ahorrosTmec, promedio, activeCount: active.length }
  }, [traficos, companyFilter])

  // ── Facturas table ──
  const filteredFacturas = useMemo(() => {
    let f = facturas
    if (companyFilter) {
      f = f.filter(r =>
        (r.clave_cliente || '').includes(companyFilter)
      )
    }
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(r =>
        (r.factura || '').toLowerCase().includes(q) ||
        (r.proveedor || '').toLowerCase().includes(q) ||
        (r.referencia || '').toLowerCase().includes(q) ||
        (r.pedimento || '').toLowerCase().includes(q)
      )
    }
    // Sort
    f = [...f].sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return f
  }, [facturas, search, sort, companyFilter])

  const totalPages = Math.ceil(filteredFacturas.length / PAGE_SIZE)
  const pagedFacturas = filteredFacturas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSort = (col: SortCol) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' }
    )
    setPage(0)
  }

  const isInternal = role === 'broker' || role === 'admin'

  // ── Unique companies for filter ──
  const companies = useMemo(() => {
    if (!isInternal) return []
    const set = new Set<string>()
    traficos.forEach(t => { if (t.clave_cliente) set.add(t.clave_cliente) })
    return Array.from(set).sort()
  }, [traficos, isInternal])

  return (
    <div style={{ background: D.bg, minHeight: '100vh', color: D.text, fontFamily: D.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
              Resumen Financiero
            </h1>
            <p style={{ color: D.textSec, fontSize: 14, margin: '4px 0 0' }}>
              Operaciones aduanales · Patente 3596
            </p>
          </div>

          {/* Company filter for broker/admin */}
          {isInternal && companies.length > 0 && (
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value); setPage(0) }}
              style={{
                background: D.card,
                border: `1px solid ${D.cardBorder}`,
                borderRadius: D.r,
                color: D.text,
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: D.sans,
                minHeight: 60,
              }}
            >
              <option value="">Todos los clientes</option>
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* ═══ SECTION 1 — KPI Cards ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
          <KPICard
            icon={<DollarSign size={20} />}
            label="Valor total en operación"
            value={loading ? '...' : fmtUSDCompact(kpis.valorTotal)}
            sub={`${kpis.activeCount} tráficos activos · ene 2024–presente`}
          />
          <KPICard
            icon={<TrendingUp size={20} />}
            label="Valor cruzado este mes"
            value={loading ? '...' : fmtUSDCompact(kpis.valorCruzado)}
            sub={fmtDate(new Date()) + ' — mes actual'}
          />
          <KPICard
            icon={<ShieldCheck size={20} />}
            label="Ahorros T-MEC estimados"
            value={loading ? '...' : fmtUSDCompact(kpis.ahorrosTmec)}
            sub="Régimen IMD · 8% estimado"
          />
          <KPICard
            icon={<BarChart3 size={20} />}
            label="Promedio por tráfico"
            value={loading ? '...' : `${fmtUSD(kpis.promedio)} USD`}
            sub="Valor promedio activos"
          />
        </div>

        {/* ═══ SECTION 2 — Tabla de Facturas ═══ */}
        <div style={{
          background: D.card,
          border: `1px solid ${D.cardBorder}`,
          borderRadius: D.r,
          marginBottom: 32,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${D.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Facturas Aduanales
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.textMuted }} />
              <input
                type="text"
                placeholder="Buscar factura, proveedor, pedimento..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                style={{
                  background: D.bg,
                  border: `1px solid ${D.cardBorder}`,
                  borderRadius: D.r,
                  color: D.text,
                  padding: '8px 12px 8px 34px',
                  fontSize: 14,
                  width: '100%', maxWidth: 300,
                  fontFamily: D.sans,
                  minHeight: 60,
                }}
              />
            </div>
          </div>

          {/* Table */}
          {facturasLoading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 4 }} />
              ))}
            </div>
          ) : filteredFacturas.length === 0 && facturas.length === 0 ? (
            <EmptyState icon="📄" title="Sin facturas pendientes" description="Todo al día. Las próximas facturas aparecerán aquí automáticamente." />
          ) : filteredFacturas.length === 0 ? (
            <EmptyState icon="🔍" title={`Sin resultados para "${search}"`} description="Intenta con otro término de búsqueda" />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                      <SortTh col="factura" label="Factura" sort={sort} onSort={toggleSort} />
                      <SortTh col="proveedor" label="Proveedor" sort={sort} onSort={toggleSort} />
                      <SortTh col="valor_usd" label="Valor USD" sort={sort} onSort={toggleSort} align="right" />
                      <SortTh col="fecha_pago" label="Fecha" sort={sort} onSort={toggleSort} />
                      <SortTh col="referencia" label="Tráfico" sort={sort} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedFacturas.map((f, i) => (
                      <tr
                        key={f.id ?? i}
                        style={{
                          borderBottom: `1px solid ${D.cardBorder}`,
                          transition: 'background 150ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 20px', fontFamily: D.mono, fontSize: 13 }}>
                          {f.factura || fmtPedimento(f.pedimento) || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.proveedor || '—'}
                        </td>
                        <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 13 }}>
                          {f.valor_usd != null ? `${fmtUSD(Number(f.valor_usd))} USD` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 13, color: D.textSec }}>
                          {f.fecha_pago ? fmtDate(f.fecha_pago) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 13, color: D.gold }}>
                          {f.referencia || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  padding: '12px 20px',
                  borderTop: `1px solid ${D.cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: D.textSec,
                }}>
                  <span>
                    {filteredFacturas.length} facturas · Página {page + 1} de {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      style={{
                        background: D.bg,
                        border: `1px solid ${D.cardBorder}`,
                        borderRadius: D.r,
                        color: page === 0 ? D.textMuted : D.text,
                        padding: '6px 12px',
                        cursor: page === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        minHeight: 60, minWidth: 60,
                      }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      style={{
                        background: D.bg,
                        border: `1px solid ${D.cardBorder}`,
                        borderRadius: D.r,
                        color: page >= totalPages - 1 ? D.textMuted : D.text,
                        padding: '6px 12px',
                        cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        minHeight: 60, minWidth: 60,
                      }}
                    >
                      Siguiente <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ SECTION 3 — Tipo de Cambio ═══ */}
        <div style={{
          background: D.card,
          border: `1px solid ${D.cardBorder}`,
          borderRadius: D.r,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <p style={{ color: D.textSec, fontSize: 13, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tipo de Cambio USD/MXN
            </p>
            <p style={{ fontSize: 32, fontWeight: 700, fontFamily: D.mono, margin: 0, color: D.gold }}>
              {tc ? `$${tc.tc.toFixed(4)}` : '...'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: D.textSec, fontSize: 13, margin: '0 0 4px' }}>
              Última actualización
            </p>
            <p style={{ fontFamily: D.mono, fontSize: 14, margin: '0 0 4px' }}>
              {tc?.fecha ? fmtDate(tc.fecha) : '—'}
            </p>
            <p style={{ color: D.textMuted, fontSize: 12, margin: 0 }}>
              Fuente: {tc?.source || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ── KPI Card Component ── */
function KPICard({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.cardBorder}`,
      borderRadius: D.r,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          background: D.goldSubtle,
          borderRadius: D.r,
          padding: 8,
          color: D.gold,
          display: 'flex',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, color: D.textSec }}>{label}</span>
      </div>
      <p className="kpi-card-value" style={{
        fontFamily: D.mono,
        margin: '0 0 4px',
        letterSpacing: '-0.02em',
      }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: D.textMuted, margin: 0 }}>{sub}</p>
    </div>
  )
}

/* ── Sortable Table Header ── */
function SortTh({ col, label, sort, onSort, align }: {
  col: SortCol
  label: string
  sort: { col: SortCol; dir: SortDir }
  onSort: (c: SortCol) => void
  align?: 'right'
}) {
  const isActive = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '10px 20px',
        textAlign: align || 'left',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: isActive ? D.gold : D.textSec,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3, verticalAlign: 'middle' }} />
    </th>
  )
}
