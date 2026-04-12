'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc, fmtDate } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtCarrier } from '@/lib/carrier-names'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'

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

export default function EntradasPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { sort, toggleSort } = useSort('entradas', { column: 'fecha_llegada_mercancia', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [transportMap, setTransportMap] = useState<Map<string, string>>(new Map())
  const [supplierMap, setSupplierMap] = useState<Map<string, string>>(new Map())
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())
  const { getCached, setCache } = useSessionCache()

  useEffect(() => {
    const userRole = getCookieValue('user_role') ?? ''
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCompanyIdCookie()
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)
    setFetchError(null)
    const cached = getCached<EntradaRow[]>('entradas')
    if (cached) setRows(cached)
    const params = new URLSearchParams({
      table: 'entradas', limit: '5000',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      gte_field: 'fecha_llegada_mercancia', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(data => { const arr = data.data ?? data ?? []; setRows(arr); setCache('entradas', arr) })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setFetchError('Error cargando entradas. Reintentar.')
      })
      .finally(() => setLoading(false))

    // Traficos for transport data
    const tParams = new URLSearchParams({ table: 'traficos', limit: '5000' })
    if (!isInternal && companyId) tParams.set('company_id', companyId)
    fetch(`/api/data?${tParams}`)
      .then(r => r.json()).then(d => {
        const transMap = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((t: { trafico?: string; transportista_mexicano?: string; transportista_americano?: string }) => {
          if (t.trafico && !transMap.has(t.trafico)) {
            transMap.set(t.trafico, t.transportista_americano || t.transportista_mexicano || '')
          }
        })
        setTransportMap(transMap)
      }).catch(() => {})

    // GlobalPC partida descriptions for enrichment
    fetch('/api/data?table=globalpc_partidas&select=cve_trafico,descripcion&limit=10000')
      .then(r => r.json()).then(d => {
        const map = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((p: { cve_trafico?: string; descripcion?: string }) => {
          if (p.cve_trafico && p.descripcion && !map.has(p.cve_trafico)) map.set(p.cve_trafico, p.descripcion)
        })
        setPartidaDescMap(map)
      }).catch(() => {})

    // Supplier names — NO company_id filter (table may not have this column)
    fetch('/api/data?table=globalpc_proveedores&limit=5000')
      .then(r => r.json()).then(d => {
        const map = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((s: { cve_proveedor?: string; nombre?: string }) => {
          if (s.cve_proveedor && s.nombre) map.set(s.cve_proveedor, s.nombre)
        })
        setSupplierMap(map)
      }).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        getDesc(r).toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q) ||
        (r.cve_proveedor ?? '').toLowerCase().includes(q) ||
        (supplierMap.get(r.cve_proveedor ?? '') ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort, supplierMap, partidaDescMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) =>
    sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span> : null

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
    return supplierMap.get(code) || code
  }

  const getDesc = (r: EntradaRow): string =>
    r.descripcion_mercancia || (r.trafico ? partidaDescMap.get(r.trafico) ?? '' : '')

  const getGuia = (r: EntradaRow): string => r.num_talon || r.num_caja_trailer || ''

  return (
    <div className="page-shell">
      {/* Header — glass theme */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Package size={20} color="#C0C5CE" strokeWidth={1.8} />
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 800, color: '#E6EDF3',
          letterSpacing: '-0.02em', margin: 0,
        }}>
          Entradas
        </h1>
      </div>

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
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
            </div>
          ) : (
            <EmptyState icon="🏭" title="No hay entradas registradas" description="Las entradas aparecerán aquí cuando se registren." />
          )
        )}

        {/* Mobile cards */}
        {!loading && paged.length > 0 && isMobile && (
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paged.map(r => {
              const proveedor = getProveedor(r)
              const transporte = getTransporte(r)
              const guia = getGuia(r)
              return (
                <div
                  key={r.cve_entrada}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.cve_entrada}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {r.fecha_llegada_mercancia ? fmtDate(r.fecha_llegada_mercancia) : '—'}
                    </span>
                  </div>
                  {proveedor && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proveedor}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                    {fmtDesc(getDesc(r)) || '—'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {r.trafico ? (
                      <Link href={`/traficos/${encodeURIComponent(r.trafico)}`} style={{ color: '#C0C5CE', textDecoration: 'none' }}>{r.trafico}</Link>
                    ) : (
                      <span>Pendiente</span>
                    )}
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

        {/* Desktop table */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="aguila-table" role="table" aria-label="Lista de entradas" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha_llegada_mercancia')}>Fecha<SortArrow col="fecha_llegada_mercancia" /></th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('cve_entrada')}>Entrada<SortArrow col="cve_entrada" /></th>
                  <th style={{ width: 160 }}>Proveedor</th>
                  <th style={{ minWidth: 160 }}>Descripción</th>
                  <th style={{ width: 130 }}>Tráfico</th>
                  <th style={{ width: 120 }}>Transporte US</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 70 }} onClick={() => toggleSort('cantidad_bultos')}>Bultos<SortArrow col="cantidad_bultos" /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 90 }} onClick={() => toggleSort('peso_bruto')}>Peso (kg)<SortArrow col="peso_bruto" /></th>
                  <th style={{ width: 120 }}>Guía</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={r.cve_entrada} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.fecha_llegada_mercancia ? <time dateTime={r.fecha_llegada_mercancia.split('T')[0]}>{fmtDate(r.fecha_llegada_mercancia)}</time> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.cve_entrada}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {getProveedor(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {fmtDesc(getDesc(r)) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {r.trafico ? (
                        <Link href={`/traficos/${encodeURIComponent(r.trafico)}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#C0C5CE', textDecoration: 'none' }}>
                          {r.trafico}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {getTransporte(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.cantidad_bultos ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.peso_bruto ? Number(r.peso_bruto).toLocaleString('es-MX') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {getGuia(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
