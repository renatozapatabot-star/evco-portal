'use client'

import { useMemo, useState } from 'react'
import {
  Search, ChevronLeft, ChevronRight, ArrowUpDown,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtUSD, fmtDate } from '@/lib/format-utils'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ── */
const D = {
  bg: 'var(--bg-main)',
  card: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  gold: 'var(--gold)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--success)',
  mono: 'var(--font-mono)',
  sans: 'var(--font-sans)',
  r: 8,
} as const

export interface TraficoRow {
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

interface USMCATableProps {
  imdTraficos: TraficoRow[]
  loading: boolean
}

export function USMCATable({ imdTraficos, loading }: USMCATableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: 'importe_total', dir: 'desc' })
  const [page, setPage] = useState(0)

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
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Embarques T-MEC
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.textMuted }} />
            <input
              type="text"
              placeholder="Buscar embarque, proveedor..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              aria-label="Buscar embarques T-MEC"
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
      </div>

      {/* Table body */}
      {loading ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 48, borderRadius: 4 }} />
          ))}
        </div>
      ) : filteredRows.length === 0 && imdTraficos.length === 0 ? (
        <EmptyState icon="🛡️" title="Sin embarques T-MEC registrados" description="Los embarques con régimen IMD aparecerán aquí automáticamente" cta={{ label: 'Ver embarques', href: '/embarques' }} />
      ) : filteredRows.length === 0 ? (
        <EmptyState icon="🔍" title={`Sin resultados para "${search}"`} description="Intenta con otro término de búsqueda" />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }} aria-label="Embarques con tratado T-MEC">
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.cardBorder}` }}>
                  <SortTh col="trafico" label="Embarque" sort={sort} onSort={toggleSort} />
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
                        {t.proveedores || '\u2014'}
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 13 }}>
                        {t.importe_total != null ? fmtUSD(Number(t.importe_total)) : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 20px', fontFamily: D.mono, fontSize: 13, color: D.textSec }}>
                        {t.descripcion_mercancia ? '\u2014' : '\u2014'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: D.mono, fontSize: 13, color: D.textSec }}>
                        {fmtDate(t.fecha_llegada || t.fecha_cruce)}
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontFamily: D.mono, fontSize: 13, color: D.green }}>
                        {savings > 0 ? fmtUSD(savings) : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Págination */}
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
                {filteredRows.length} embarques T-MEC · Página {page + 1} de {totalPages}
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
