'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc, fmtDate } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtCarrier } from '@/lib/carrier-names'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'
import { SwipeRow } from '@/components/ui/SwipeRow'

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
  [key: string]: unknown
}

const PAGE_SIZE = 50

const fmtTrafico = (id: string) => {
  const clave = getClientClaveCookie()
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clave}-`) ? clean : `${clave}-${clean}`
}

export default function EntradasPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { sort, toggleSort } = useSort('entradas', { column: 'fecha_llegada_mercancia', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [traficoDescMap, setTraficoDescMap] = useState<Map<string, string>>(new Map())
  const [transportMap, setTransportMap] = useState<Map<string, string>>(new Map())
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

    // Traficos for descriptions + transport data (single fetch)
    const tParams = new URLSearchParams({ table: 'traficos', select: 'trafico,descripcion_mercancia,transportista_mexicano,transportista_americano', limit: '5000' })
    if (!isInternal && companyId) tParams.set('company_id', companyId)
    fetch(`/api/data?${tParams}`)
      .then(r => r.json()).then(d => {
        const descMap = new Map<string, string>()
        const transMap = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((t: { trafico?: string; descripcion_mercancia?: string; transportista_mexicano?: string; transportista_americano?: string }) => {
          if (t.trafico) {
            if (t.descripcion_mercancia && !descMap.has(t.trafico)) descMap.set(t.trafico, t.descripcion_mercancia)
            if (!transMap.has(t.trafico)) transMap.set(t.trafico, t.transportista_mexicano || t.transportista_americano || '')
          }
        })
        setTraficoDescMap(descMap)
        setTransportMap(transMap)
      }).catch(() => {})
  }, [])

  const filtered = (() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) =>
    sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  // Resolve transporte: traficos lookup → entrada's own transport fields
  const getTransporte = (r: EntradaRow): string => {
    // First try the traficos join lookup
    if (r.trafico) {
      const fromTrafico = fmtCarrier(transportMap.get(r.trafico) || '')
      if (fromTrafico) return fromTrafico
    }
    // Fallback to the entrada's own transport fields
    const direct = fmtCarrier(r.transportista_mexicano || r.transportista_americano || '')
    return direct
  }

  const getDesc = (r: EntradaRow) => {
    const entradaDesc = r.descripcion_mercancia || ''
    const traficoDesc = r.trafico ? (traficoDescMap.get(r.trafico) || '') : ''
    // Pick the longer description — more specific
    const best = entradaDesc.length >= traficoDesc.length ? entradaDesc : traficoDesc
    return best ? fmtDesc(best) : null
  }

  const unassignedCount = useMemo(() => rows.filter(r => !r.trafico).length, [rows])

  return (
    <div className="page-shell">

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Entrada, tráfico, descripción..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              aria-label="Buscar entradas"
            />
          </div>
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{ padding: 16 }}>
            <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
          </div>
        )}

        {/* Loading — card-shaped skeletons */}
        {loading && (
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                borderRadius: 10, padding: '16px 18px',
                border: '1px solid var(--border)', borderLeft: '3px solid var(--border)',
                background: 'var(--bg-card)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ width: 90, height: 12, borderRadius: 4 }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: '75%', height: 13, borderRadius: 4, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="skeleton-shimmer" style={{ width: 60, height: 16, borderRadius: 4 }} />
                  <div className="skeleton-shimmer" style={{ width: 50, height: 16, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
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
          <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paged.map(r => {
              const transporte = getTransporte(r)
              const hasTrafico = !!r.trafico
              const cardHref = hasTrafico ? `/traficos/${encodeURIComponent(fmtTrafico(r.trafico!))}` : `/entradas/${r.cve_entrada}`
              return (
                <SwipeRow
                  key={r.cve_entrada}
                  style={{ borderRadius: 10 }}
                  leftAction={{
                    icon: <Eye size={14} />,
                    label: 'Ver detalle',
                    color: 'var(--teal, #0D9488)',
                    bg: 'rgba(13,148,136,0.1)',
                    onAction: () => router.push(cardHref),
                  }}
                >
                  <div
                    onClick={() => router.push(cardHref)}
                    className="entrada-card-mobile"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${hasTrafico ? 'var(--success, #16A34A)' : 'var(--gold, #C9A84C)'}`,
                      borderRadius: 10,
                      padding: '16px 18px',
                      cursor: 'pointer',
                      minHeight: 72,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'transform 100ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.cve_entrada}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {r.fecha_llegada_mercancia ? fmtDate(r.fecha_llegada_mercancia) : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                      {getDesc(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    {/* Metadata pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {hasTrafico && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                          padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(13,148,136,0.08)', color: 'var(--teal, #0D9488)',
                          border: '1px solid rgba(13,148,136,0.15)',
                        }}>
                          {r.trafico}
                        </span>
                      )}
                      {(r.cantidad_bultos ?? 0) > 0 && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {r.cantidad_bultos} bultos
                        </span>
                      )}
                      {(r.peso_bruto ?? 0) > 0 && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {Number(r.peso_bruto).toLocaleString('es-MX')} kg
                        </span>
                      )}
                      {transporte && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                          {transporte}
                        </span>
                      )}
                      {!hasTrafico && (
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(201,168,76,0.08)', color: 'var(--gold, #C9A84C)',
                          border: '1px solid rgba(201,168,76,0.15)',
                          marginLeft: 'auto',
                        }}>
                          Sin asignar
                        </span>
                      )}
                    </div>
                  </div>
                </SwipeRow>
              )
            })}
          </div>
        )}

        {/* Floating unassigned summary bar (mobile only) */}
        {isMobile && !loading && unassignedCount > 0 && (
          <div
            onClick={() => { setSearch(''); setPage(0) }}
            style={{
              position: 'fixed', bottom: 72, left: 16, right: 16,
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--gold, #C9A84C)', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 40, cursor: 'pointer',
              animation: 'fadeInUp 200ms ease',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {unassignedCount} entrada{unassignedCount !== 1 ? 's' : ''} sin asignar
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>
              Ver todas →
            </span>
          </div>
        )}

        {/* Desktop table */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="cruz-table" role="table" aria-label="Lista de entradas" style={{ minWidth: 960 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 120 }} onClick={() => toggleSort('cve_entrada')}>Entrada<SortArrow col="cve_entrada" /></th>
                  <th style={{ width: 140 }}>Tráfico</th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha_llegada_mercancia')}>Fecha<SortArrow col="fecha_llegada_mercancia" /></th>
                  <th style={{ minWidth: 200 }}>Descripción</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 80 }} onClick={() => toggleSort('cantidad_bultos')}>Bultos<SortArrow col="cantidad_bultos" /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 100 }} onClick={() => toggleSort('peso_bruto')}>Peso (kg)<SortArrow col="peso_bruto" /></th>
                  <th style={{ width: 130 }}>Transporte</th>
                  <th style={{ minWidth: 140 }}>Guía</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr
                    key={r.cve_entrada}
                    className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => router.push(r.trafico ? `/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}` : `/entradas/${r.cve_entrada}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.cve_entrada}
                      </span>
                    </td>
                    <td>
                      {r.trafico ? (
                        <Link
                          href={`/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}`}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--gold-dark, #8B6914)', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {fmtTrafico(r.trafico)}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.fecha_llegada_mercancia ? <time dateTime={r.fecha_llegada_mercancia.split('T')[0]}>{fmtDate(r.fecha_llegada_mercancia)}</time> : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>}
                    </td>
                    <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {getDesc(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.cantidad_bultos ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.peso_bruto ? `${Number(r.peso_bruto).toLocaleString('es-MX')}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {getTransporte(r) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.num_talon || r.num_caja_trailer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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
