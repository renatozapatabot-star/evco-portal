'use client'

import { useMemo, useState } from 'react'
import {
  Search, ChevronLeft, ChevronRight, ArrowUpDown,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtUSD, fmtDate, fmtPedimento } from '@/lib/format-utils'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  bg: 'var(--bg-main)',
  card: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  gold: 'var(--gold)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  mono: 'var(--font-mono)',
  sans: 'var(--font-sans)',
  r: 8,
} as const

export interface FacturaRow {
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

type SortCol = 'factura' | 'proveedor' | 'valor_usd' | 'fecha_pago' | 'referencia'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 50

interface FinTableProps {
  facturas: FacturaRow[]
  facturasLoading: boolean
  isMobile: boolean
  companyFilter: string
}

export function FinTable({ facturas, facturasLoading, isMobile, companyFilter }: FinTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'fecha_pago', dir: 'desc' })
  const [page, setPage] = useState(0)

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

  return (
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
        <h2 style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 600, margin: 0 }}>
          Facturas Aduanales
        </h2>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.textMuted }} />
          <input
            type="text"
            placeholder="Buscar factura, proveedor, pedimento..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            aria-label="Buscar facturas"
            style={{
              background: D.bg,
              border: `1px solid ${D.cardBorder}`,
              borderRadius: D.r,
              color: D.text,
              padding: '8px 12px 8px 34px',
              fontSize: 'var(--aguila-fs-section)',
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
          {isMobile ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pagedFacturas.map((f, i) => (
                <div key={f.id ?? i} style={{
                  background: D.bg, border: `1px solid ${D.cardBorder}`, borderRadius: D.r,
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>
                      {f.factura || fmtPedimento(f.pedimento) || '\u2014'}
                    </span>
                    <span style={{ fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: D.gold }}>
                      {f.valor_usd != null ? `${fmtUSD(Number(f.valor_usd))} USD` : '\u2014'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', color: D.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.proveedor || '\u2014'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--aguila-fs-compact)', color: D.textSec }}>
                    <span style={{ fontFamily: D.mono }}>{f.fecha_pago ? fmtDate(f.fecha_pago) : '\u2014'}</span>
                    <span style={{ fontFamily: D.mono, color: D.gold }}>{f.referencia || '\u2014'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-section)' }} aria-label="Lista de facturas aduanales">
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <SortTh col="factura" label="Factura" sort={sort} onSort={toggleSort} />
                  <SortTh col="proveedor" label="Proveedor" sort={sort} onSort={toggleSort} />
                  <SortTh col="valor_usd" label="Valor USD" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh col="fecha_pago" label="Fecha" sort={sort} onSort={toggleSort} />
                  <SortTh col="referencia" label="Embarque" sort={sort} onSort={toggleSort} />
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
                    <td style={{ padding: '10px 20px', fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)' }}>
                      {f.factura || fmtPedimento(f.pedimento) || '\u2014'}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.proveedor || '\u2014'}
                    </td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)' }}>
                      {f.valor_usd != null ? `${fmtUSD(Number(f.valor_usd))} USD` : '\u2014'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)', color: D.textSec }}>
                      {f.fecha_pago ? fmtDate(f.fecha_pago) : '\u2014'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 'var(--aguila-fs-body)', color: D.gold }}>
                      {f.referencia || '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Págination */}
          {totalPages > 1 && (
            <div style={{
              padding: '12px 20px',
              borderTop: `1px solid ${D.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 'var(--aguila-fs-body)',
              color: D.textSec,
            }}>
              <span>
                {filteredFacturas.length} facturas · Página {page + 1} de {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  aria-label="Página anterior"
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
                  aria-label="Página siguiente"
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
      role="columnheader"
      aria-sort={isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(col)}
      style={{
        padding: '10px 20px',
        textAlign: align || 'left',
        fontSize: 'var(--aguila-fs-meta)',
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
      <ArrowUpDown size={12} style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3, verticalAlign: 'middle', transform: isActive && sort.dir === 'asc' ? 'scaleY(-1)' : undefined, transition: 'transform 150ms' }} />
    </th>
  )
}
