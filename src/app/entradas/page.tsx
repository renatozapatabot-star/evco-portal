'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc } from '@/lib/format-utils'
import { useSort, type SortState } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import { fmtCarrier } from '@/lib/carrier-names'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'
import { useSupplierNames } from '@/hooks/use-supplier-names'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { MonthSelector } from '@/components/admin/MonthSelector'
import { FreshnessBanner } from '@/components/aguila'
import { useFreshness } from '@/hooks/use-freshness'

interface EntradaRow {
  id: number
  cve_entrada: string
  trafico?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  num_talon?: string | null
  num_caja_trailer?: string | null
  transportista_mexicano?: string | null
  transportista_americano?: string | null
  cve_proveedor?: string | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

/** DD/MM/YYYY \u2014 shipper-friendly, locale-agnostic. */
function fmtDateDMY(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.split('T')[0]
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

function SortArrow({ col, sort }: { col: string; sort: SortState }) {
  if (sort.column !== col) return null
  return <span style={{ marginLeft: 4, fontSize: 'var(--aguila-fs-label)' }}>{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
}

export default function EntradasPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ padding: 20 }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
      <EntradasContent />
    </Suspense>
  )
}

function EntradasContent() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')
  const monthWindow = useMemo(() => parseMonthParam(monthParam), [monthParam])
  const monthOptions = useMemo(() => recentMonths(24), [])
  const [rows, setRows] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { sort, toggleSort } = useSort('entradas', { column: 'fecha_llegada_mercancia', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [transportMap, setTransportMap] = useState<Map<string, string>>(new Map())
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())
  const { getCached, setCache } = useSessionCache()
  const freshness = useFreshness()
  // Proveedor resolution lives in a shared hook so every surface uses the
  // same PRV_#### → human name fallback (no raw codes ever reach the UI).
  const supplierNames = useSupplierNames()

  useEffect(() => {
    const userRole = getCookieValue('user_role') ?? ''
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCompanyIdCookie()
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)
    setFetchError(null)
    const cacheKey = `entradas:${monthWindow.ym}`
    const cached = getCached<EntradaRow[]>(cacheKey)
    if (cached) setRows(cached)
    const params = new URLSearchParams({
      table: 'entradas', limit: '5000',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      gte_field: 'fecha_llegada_mercancia', gte_value: monthWindow.monthStart,
      lte_field: 'fecha_llegada_mercancia', lte_value: monthWindow.monthEnd,
    })
    if (!isInternal && companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(data => { const arr = data.data ?? data ?? []; setRows(arr); setCache(cacheKey, arr) })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setFetchError('Error cargando entradas. Reintentar.')
      })
      .finally(() => setLoading(false))

    // Traficos for transport data — the `transportista_extranjero` column
    // on traficos is the US-side carrier (the americano equivalent on
    // entradas). Grab both so deriveTransporte() can fall back cleanly.
    const tParams = new URLSearchParams({ table: 'traficos', limit: '5000' })
    if (!isInternal && companyId) tParams.set('company_id', companyId)
    fetch(`/api/data?${tParams}`)
      .then(r => r.json()).then(d => {
        const transMap = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((t: { trafico?: string; transportista_mexicano?: string; transportista_extranjero?: string; transportista_americano?: string }) => {
          if (t.trafico && !transMap.has(t.trafico)) {
            // Prefer US carrier (extranjero on traficos is the US leg),
            // fall back to MX. fmtCarrier upstream resolves codes to names.
            transMap.set(t.trafico, t.transportista_extranjero || t.transportista_americano || t.transportista_mexicano || '')
          }
        })
        setTransportMap(transMap)
      }).catch(() => {})

    // Partes-derived descriptions for enrichment — this used to
    // query globalpc_partidas for cve_trafico+descripcion, but
    // neither column exists on that table. Replaced with the
    // canonical 3-hop batch endpoint (facturas → partidas → productos).
    fetch('/api/data?table=traficos&select=trafico&limit=5000')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const ids = arr
          .map((t: { trafico?: string }) => t.trafico)
          .filter((t: string | undefined): t is string => !!t)
          .slice(0, 500)
        if (ids.length === 0) return
        return fetch(`/api/embarques/partes-description?traficos=${encodeURIComponent(ids.join(','))}`)
      })
      .then(r => r && r.ok ? r.json() : null)
      .then(body => {
        if (!body?.data) return
        const next = new Map<string, string>()
        for (const [trafico, payload] of Object.entries(body.data as Record<string, { descriptions: string[]; count: number }>)) {
          if (payload.descriptions.length > 0) {
            next.set(trafico, payload.descriptions.join(' · '))
          }
        }
        setPartidaDescMap(next)
      })
      .catch(() => {})

    // Supplier names are loaded + cached by useSupplierNames (session-wide).
  }, [monthWindow.monthStart, monthWindow.monthEnd])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        getDesc(r).toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q) ||
        supplierNames.resolve(r.cve_proveedor ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sort, supplierNames.resolve, partidaDescMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const getTransporte = (r: EntradaRow): string => {
    if (r.trafico) {
      const fromTrafico = fmtCarrier(transportMap.get(r.trafico) || '')
      if (fromTrafico) return fromTrafico
    }
    return fmtCarrier(r.transportista_americano || r.transportista_mexicano || '')
  }

  const getProveedor = (r: EntradaRow): string => {
    const code = r.cve_proveedor ?? ''
    if (!code) return ''
    const resolved = supplierNames.resolve(code)
    // resolve() returns '—' for empty; treat that as "no proveedor".
    return resolved === '—' ? '' : resolved
  }

  const getDesc = (r: EntradaRow): string =>
    r.descripcion_mercancia || (r.trafico ? partidaDescMap.get(r.trafico) ?? '' : '')

  const getGuia = (r: EntradaRow): string => r.num_talon || r.num_caja_trailer || ''

  return (
    <div className="page-shell">
      {/* Header — calm, single-row, shadcn-like restraint. */}
      <div style={{
        marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: 'var(--portal-fg-1)',
            letterSpacing: '-0.01em', margin: 0,
          }}>
            Entradas
          </h1>
          <span style={{
            fontSize: 12, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
          }}>
            {filtered.length.toLocaleString('es-MX')} registros
          </span>
        </div>
        <MonthSelector
          ym={monthWindow.ym}
          label={monthWindow.label}
          prev={monthWindow.prev}
          next={monthWindow.next}
          options={monthOptions}
        />
      </div>

      {freshness && <div style={{ marginBottom: 12 }}><FreshnessBanner reading={freshness} /></div>}

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Entrada, tráfico, proveedor, descripción..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              aria-label="Buscar entradas"
            />
          </div>
        </div>

        {fetchError && (
          <div style={{ padding: 16 }}>
            <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
          </div>
        )}

        {loading && (
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                borderRadius: 10, padding: '16px 18px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ width: 90, height: 12, borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: '75%', height: 13, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && paged.length === 0 && (
          search.trim() ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
            </div>
          ) : (
            <CalmEmptyState
              icon="package"
              title="Sin entradas en este período"
              message="Las recepciones de almacén aparecerán aquí."
            />
          )
        )}

        {/* Mobile cards — same polish language as the desktop table. */}
        {!loading && paged.length > 0 && isMobile && (
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paged.map(r => {
              const proveedor = getProveedor(r)
              const transporte = getTransporte(r)
              const guia = getGuia(r)
              const desc = fmtDesc(getDesc(r))
              const dateStr = fmtDateDMY(r.fecha_llegada_mercancia)
              return (
                <div
                  key={r.cve_entrada}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.cve_entrada}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{dateStr || '—'}</span>
                  </div>
                  {r.trafico && (
                    <div style={{ marginBottom: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <Link href={`/embarques/${encodeURIComponent(r.trafico)}`} style={{ color: 'var(--portal-fg-3)', textDecoration: 'none' }}>{r.trafico}</Link>
                    </div>
                  )}
                  {proveedor && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proveedor}
                    </div>
                  )}
                  {desc && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                      {desc}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {transporte && <span>{transporte}</span>}
                    {(r.cantidad_bultos ?? 0) > 0 && <span>{r.cantidad_bultos} bto{r.cantidad_bultos !== 1 ? 's' : ''}</span>}
                    {(r.peso_bruto ?? 0) > 0 && <span>{Number(r.peso_bruto).toLocaleString('es-MX')} kg</span>}
                    {guia && <span>{guia}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Desktop table — shadcn-style: thin dividers, dense rows, tabular nums. */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table
              className="aguila-table entradas-table"
              role="table"
              aria-label="Lista de entradas"
              style={{ minWidth: 1100, fontVariantNumeric: 'tabular-nums' }}
            >
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha_llegada_mercancia')}>Fecha<SortArrow col="fecha_llegada_mercancia" sort={sort} /></th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('cve_entrada')}>Entrada<SortArrow col="cve_entrada" sort={sort} /></th>
                  <th style={{ width: 160 }}>Proveedor</th>
                  <th style={{ minWidth: 200 }}>Mercancía</th>
                  <th style={{ width: 120 }}>Tráfico</th>
                  <th style={{ width: 120 }}>Transporte</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 70 }} onClick={() => toggleSort('cantidad_bultos')}>Bultos<SortArrow col="cantidad_bultos" sort={sort} /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 90 }} onClick={() => toggleSort('peso_bruto')}>Peso (kg)<SortArrow col="peso_bruto" sort={sort} /></th>
                  <th style={{ width: 110 }}>Guía</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => {
                  const dateStr = fmtDateDMY(r.fecha_llegada_mercancia)
                  const proveedor = getProveedor(r)
                  const desc = fmtDesc(getDesc(r))
                  const transporte = getTransporte(r)
                  const guia = getGuia(r)
                  return (
                    <tr key={r.cve_entrada} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {dateStr ? <time dateTime={r.fecha_llegada_mercancia?.split('T')[0]}>{dateStr}</time> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.cve_entrada}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={proveedor || undefined}>
                        {proveedor || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }} title={desc || undefined}>
                        {desc || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {r.trafico ? (
                          <Link href={`/embarques/${encodeURIComponent(r.trafico)}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--portal-fg-3)', textDecoration: 'none' }}>
                            {r.trafico}
                          </Link>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }} title={transporte || undefined}>
                        {transporte || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.cantidad_bultos ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.peso_bruto ? Number(r.peso_bruto).toLocaleString('es-MX') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {guia || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Page-scoped polish — tighter rows, calm header, hover lift. */}
            <style>{`
              .entradas-table th {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: var(--text-muted);
                padding: 10px 12px;
                background: transparent;
                border-bottom: 1px solid var(--border);
                position: sticky; top: 0;
                backdrop-filter: blur(8px);
                z-index: 1;
              }
              .entradas-table td {
                padding: 10px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.04);
              }
              .entradas-table tr.row-even { background: transparent; }
              .entradas-table tr.row-odd  { background: rgba(255,255,255,0.015); }
              .entradas-table tbody tr { transition: background 120ms ease; }
              .entradas-table tbody tr:hover { background: rgba(192,197,206,0.06); }
              .entradas-table tbody tr:last-child td { border-bottom: 0; }
            `}</style>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">Página {page + 1} de {totalPages}</span>
          <div className="pagination-btns">
            <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></button>
            <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Página siguiente"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
