'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  ShieldCheck, TrendingUp, AlertCircle,
  Search, ChevronLeft, ChevronRight, ArrowUpDown,
  RefreshCw, FileText,
} from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtUSD, fmtUSDCompact, fmtDate } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  cardBorder: '#E8E5E0',
  gold: '#C4963C',
  goldSubtle: 'rgba(196,150,60,0.08)',
  goldBorder: 'rgba(196,150,60,0.35)',
  text: '#1A1A1A',
  textSec: '#6B6B6B',
  textMuted: '#9B9B9B',
  green: '#16A34A',
  greenSubtle: 'rgba(22,163,74,0.08)',
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
  fecha_llegada?: string | null
  proveedores?: string | null
  pedimento?: string | null
  descripcion_mercancia?: string | null
  company_id?: string | null
  clave_cliente?: string | null
  [k: string]: unknown
}

type SortCol = 'trafico' | 'proveedores' | 'importe_total' | 'fecha_llegada' | 'savings'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

/* ═══════════════════════════════════════════════════════════
   USMCA / T-MEC INTELLIGENCE PAGE
   ═══════════════════════════════════════════════════════════ */
export default function USMCAPage() {
  const [role, setRole] = useState('')
  const [companyClave, setCompanyClave] = useState('')
  const [companyId, setCompanyId] = useState('')

  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)

  // Table state
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'importe_total', dir: 'desc' })
  const [page, setPage] = useState(0)

  // Company filter for broker
  const [companyFilter, setCompanyFilter] = useState('')

  useEffect(() => {
    const r = getCookieValue('user_role') || 'client'
    const clave = getCookieValue('company_clave') || ''
    const cid = getCookieValue('company_id') || ''
    setRole(r)
    setCompanyClave(clave)
    setCompanyId(cid)
  }, [])

  useEffect(() => {
    if (!role) return
    const isInternal = role === 'broker' || role === 'admin'
    const companyParam = isInternal ? '' : `&company_id=${companyId}`

    fetch(`/api/data?table=traficos${companyParam}&limit=5000&order_by=importe_total&order_dir=desc`)
      .then(r => r.json())
      .then(d => { setTraficos(d.data ?? []); setLoading(false) })
      .catch(() => { setTraficos([]); setLoading(false) })
  }, [role, companyId])

  const isInternal = role === 'broker' || role === 'admin'

  // ── All IMD traficos (T-MEC applied) ──
  const imdTraficos = useMemo(() => {
    let rows = traficos.filter(t => (t.regimen || '').toUpperCase().includes('IMD'))
    if (companyFilter) {
      rows = rows.filter(t =>
        (t.clave_cliente || '').includes(companyFilter)
      )
    }
    return rows
  }, [traficos, companyFilter])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const imdThisMonth = imdTraficos.filter(t => {
      const d = t.fecha_cruce || t.fecha_llegada
      if (!d) return false
      return new Date(d) >= monthStart
    })
    const savingsMonth = imdThisMonth.reduce((s, r) => s + (Number(r.importe_total) || 0) * 0.08, 0)
    const countApplied = imdTraficos.length

    return { savingsMonth, countApplied }
  }, [imdTraficos])

  // ── Filtered + sorted table ──
  const filteredRows = useMemo(() => {
    let rows = imdTraficos
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        (r.trafico || '').toLowerCase().includes(q) ||
        (r.proveedores || '').toLowerCase().includes(q) ||
        (r.pedimento || '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia || '').toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      let av: number | string | null = null
      let bv: number | string | null = null
      if (sort.col === 'savings') {
        av = (Number(a.importe_total) || 0) * 0.08
        bv = (Number(b.importe_total) || 0) * 0.08
      } else {
        av = a[sort.col] as string | number | null
        bv = b[sort.col] as string | number | null
      }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [imdTraficos, search, sort])

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE)
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSort = (col: SortCol) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'desc' }
    )
    setPage(0)
  }

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
              T-MEC / USMCA Intelligence
            </h1>
            <p style={{ color: D.textSec, fontSize: 14, margin: '4px 0 0' }}>
              Ahorros y trazabilidad de tratado · Patente 3596
            </p>
          </div>

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
              {companies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* ═══ SECTION 1 — Savings Summary (3 cards) ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
          <KPICard
            icon={<TrendingUp size={20} />}
            label="Ahorro T-MEC este mes"
            value={loading ? '...' : fmtUSDCompact(kpis.savingsMonth)}
            sub="Estimado 8% sobre valor IMD"
            accent="green"
          />
          <KPICard
            icon={<ShieldCheck size={20} />}
            label="Tráficos con T-MEC aplicado"
            value={loading ? '...' : String(kpis.countApplied)}
            sub="Régimen IMD activo"
            accent="gold"
          />
          <KPICard
            icon={<AlertCircle size={20} />}
            label="Elegibles sin T-MEC"
            value="—"
            sub="Análisis de elegibilidad próximamente"
            accent="muted"
          />
        </div>

        {/* ═══ SECTION 2 — T-MEC Tráficos Table ═══ */}
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
              Tráficos T-MEC
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.textMuted }} />
              <input
                type="text"
                placeholder="Buscar tráfico, proveedor..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                style={{
                  background: D.bg,
                  border: `1px solid ${D.cardBorder}`,
                  borderRadius: D.r,
                  color: D.text,
                  padding: '8px 12px 8px 34px',
                  fontSize: 14,
                  width: '100%', maxWidth: 280,
                  fontFamily: D.sans,
                  minHeight: 60,
                }}
              />
            </div>
          </div>

          {/* Table body */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: D.textSec }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p>Cargando tráficos T-MEC...</p>
            </div>
          ) : filteredRows.length === 0 && imdTraficos.length === 0 ? (
            <EmptyState icon="🛡️" title="Sin tráficos T-MEC registrados" description="Los tráficos con régimen IMD aparecerán aquí automáticamente" cta={{ label: 'Ver tráficos', href: '/traficos' }} />
          ) : filteredRows.length === 0 ? (
            <EmptyState icon="🔍" title={`Sin resultados para "${search}"`} description="Intenta con otro término de búsqueda" />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                      <SortTh col="trafico" label="Tráfico" sort={sort} onSort={toggleSort} />
                      <SortTh col="proveedores" label="Proveedor" sort={sort} onSort={toggleSort} />
                      <SortTh col="importe_total" label="Valor USD" sort={sort} onSort={toggleSort} align="right" />
                      <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: D.textSec }}>
                        Fracción
                      </th>
                      <SortTh col="fecha_llegada" label="Fecha" sort={sort} onSort={toggleSort} />
                      <SortTh col="savings" label="Ahorro Est." sort={sort} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((t, i) => {
                      const savings = (Number(t.importe_total) || 0) * 0.08
                      return (
                        <tr
                          key={t.trafico + i}
                          style={{ borderBottom: `1px solid ${D.cardBorder}`, transition: 'background 150ms' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 20px', fontFamily: D.mono, fontSize: 13, color: D.gold }}>
                            {t.trafico}
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.proveedores || '—'}
                          </td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 13 }}>
                            {t.importe_total != null ? fmtUSD(Number(t.importe_total)) : '—'}
                          </td>
                          <td style={{ padding: '10px 20px', fontFamily: D.mono, fontSize: 13, color: D.textSec }}>
                            {t.descripcion_mercancia ? '—' : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 13, color: D.textSec }}>
                            {fmtDate(t.fecha_llegada || t.fecha_cruce)}
                          </td>
                          <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 13, color: D.green }}>
                            {savings > 0 ? fmtUSD(savings) : '—'}
                          </td>
                        </tr>
                      )
                    })}
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
                    {filteredRows.length} tráficos T-MEC · Página {page + 1} de {totalPages}
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

        {/* ═══ SECTION 3 — Certificate Status (placeholder) ═══ */}
        <div style={{
          background: D.card,
          border: `1px solid ${D.goldBorder}`,
          borderRadius: D.r,
          padding: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{
            background: D.goldSubtle,
            borderRadius: D.r,
            padding: 16,
            color: D.gold,
            display: 'flex',
            flexShrink: 0,
          }}>
            <FileText size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>
              Gestión de certificados USMCA próximamente
            </h3>
            <p style={{ color: D.textSec, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              Generación, seguimiento y validación de certificados de origen T-MEC.
              Criterios A, B, C, D con análisis automático por fracción arancelaria.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ── KPI Card ── */
function KPICard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent: 'green' | 'gold' | 'muted'
}) {
  const accentColor = accent === 'green' ? D.green : accent === 'gold' ? D.gold : D.textMuted
  const accentBg = accent === 'green' ? D.greenSubtle : accent === 'gold' ? D.goldSubtle : 'rgba(107,107,107,0.1)'

  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.cardBorder}`,
      borderRadius: D.r,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          background: accentBg,
          borderRadius: D.r,
          padding: 8,
          color: accentColor,
          display: 'flex',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, color: D.textSec }}>{label}</span>
      </div>
      <p style={{
        fontSize: 28,
        fontWeight: 700,
        fontFamily: D.mono,
        margin: '0 0 4px',
        letterSpacing: '-0.02em',
        color: accent === 'muted' ? D.textMuted : D.text,
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
