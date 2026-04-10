'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtUSDCompact, fmtDate, fmtDateShort, fmtPedimentoShort } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { ErrorBoundary } from '@/components/error-boundary'
import { useSessionCache } from '@/hooks/use-session-cache'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSupplierNames } from '@/hooks/use-supplier-names'

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  descripcion_mercancia?: string | null
  peso_bruto?: number | null
  importe_total?: number | null
  pedimento?: string | null
  proveedores?: string | null
  facturas?: string | null
  embarque?: number | null
  transportista_mexicano?: string | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

/** Binary status: Cruzado or Pendiente */
function getStatus(estatus: string | undefined): 'Cruzado' | 'Pendiente' {
  if (!estatus) return 'Pendiente'
  return estatus.toLowerCase().includes('cruz') ? 'Cruzado' : 'Pendiente'
}

function exportCSV(rows: TraficoRow[], clientClave: string, companyId: string) {
  const meta = [
    'ADUANA — Renato Zapata & Company',
    `Clave: ${clientClave}`,
    `Exportado: ${fmtDate(new Date())}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const h = ['Clave_Trafico', 'Ref_Cliente', 'Proveedor', 'Invoice', 'Descripcion', 'Valor_USD', 'Pedimento', 'Status']
  const c = rows.map(r => [
    r.trafico,
    r.embarque ?? '',
    (r.proveedores ?? '').replace(/,/g, ';'),
    (r.facturas ?? '').replace(/,/g, ';'),
    (r.descripcion_mercancia ?? '').replace(/,/g, ' '),
    r.importe_total ?? '',
    r.pedimento ?? '',
    getStatus(r.estatus),
  ].join(','))
  const b = new Blob([[...meta, h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const fname = `${(companyId || 'export').toUpperCase()}_Traficos_${new Date().toISOString().split('T')[0]}.csv`
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click()
}

export default function TraficosPage() {
  return (
    <ErrorBoundary fallbackTitle="Error al cargar tráficos">
      <Suspense fallback={<div className="page-container" style={{ padding: '20px 24px' }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
        <TraficosContent />
      </Suspense>
    </ErrorBoundary>
  )
}

function TraficosContent() {
  const { resolveAll: resolveSupplier } = useSupplierNames()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const sortParam = searchParams.get('sort')
  const orderParam = searchParams.get('order')
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)
  const { sort, toggleSort } = useSort('traficos', { column: 'fecha_llegada', direction: 'desc' })
  const router = useRouter()
  const isMobile = useIsMobile()
  const { getCached, setCache } = useSessionCache()

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
    setLoading(true)
    setFetchError(null)

    const cached = getCached<TraficoRow[]>('traficos')
    if (cached) setRows(cached)

    const traficosParams = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_llegada', order_dir: 'desc',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    if (!isInternal) traficosParams.set('company_id', companyId)

    fetch(`/api/data?${traficosParams}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(d => {
        const arr = Array.isArray(d.data ?? d) ? (d.data ?? d) : []
        setRows(arr)
        setCache('traficos', arr)
      })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setFetchError('Error cargando tráficos. Reintentar.')
      })
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        fmtId(r.trafico).toLowerCase().includes(q) ||
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q) ||
        (r.proveedores ?? '').toLowerCase().includes(q) ||
        (r.facturas ?? '').toLowerCase().includes(q)
      )
    }
    const activeSort = sortParam ? { column: sortParam, direction: (orderParam ?? 'desc') as 'asc' | 'desc' } : sort
    return [...out].sort((a, b) => {
      const aVal = a[activeSort.column as keyof TraficoRow]
      const bVal = b[activeSort.column as keyof TraficoRow]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return activeSort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort, sortParam, orderParam])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) =>
    sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span> : null

  const fmtSupplier = (prov: string | null | undefined): string => {
    if (!prov) return ''
    const first = prov.split(',')[0]?.trim() || ''
    return resolveSupplier(first) || first
  }

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 12 }}>
        <h1 className="page-title">Tráficos</h1>
        <p className="page-subtitle">
          {rows.length.toLocaleString('es-MX')} operacion{rows.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
        </div>
      )}

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Tráfico, pedimento, proveedor, factura..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Buscar tráficos"
            />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(filtered, clientClave, companyId)}>
            <Download size={12} /> CSV
          </button>
        </div>

        {/* Mobile Cards */}
        {isMobile && !loading && paged.length > 0 && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paged.map(r => {
              const status = getStatus(r.estatus)
              return (
                <div
                  key={r.trafico}
                  onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{fmtId(r.trafico)}</span>
                    <span className={`badge ${status === 'Cruzado' ? 'badge-cruzado' : 'badge-proceso'}`} style={{ fontSize: 11 }}>
                      {status}
                    </span>
                  </div>
                  {fmtSupplier(r.proveedores) && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtSupplier(r.proveedores)}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                    {fmtDesc(r.descripcion_mercancia) || '—'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {r.importe_total ? <span>{fmtUSDCompact(r.importe_total)}</span> : null}
                    {r.pedimento ? <span>{fmtPedimentoShort(r.pedimento)}</span> : <span>Ped. pendiente</span>}
                    {r.fecha_llegada ? <span>{fmtDateShort(r.fecha_llegada)}</span> : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isMobile && !loading && paged.length === 0 && (
          <div style={{ padding: 16 }}>
            {search.trim() ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar búsqueda</button>
              </div>
            ) : (
              <EmptyState icon="🚛" title="Sin operaciones activas" description="Sus embarques activos aparecerán aquí." />
            )}
          </div>
        )}

        {/* Desktop table */}
        {!isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="aduana-table" aria-label="Lista de tráficos" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 150, cursor: 'pointer' }} onClick={() => toggleSort('trafico')}>Clave de Tráfico<SortArrow col="trafico" /></th>
                  <th scope="col" style={{ width: 100 }}>Ref. Cliente</th>
                  <th scope="col" style={{ width: 160 }}>Proveedor</th>
                  <th scope="col" style={{ width: 120 }}>Invoice #</th>
                  <th scope="col" style={{ minWidth: 160 }}>Descripción</th>
                  <th scope="col" style={{ width: 110, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('importe_total')}>Valor USD<SortArrow col="importe_total" /></th>
                  <th scope="col" style={{ width: 120 }}>Pedimento</th>
                  <th scope="col" style={{ width: 100, cursor: 'pointer' }} onClick={() => toggleSort('estatus')}>Status<SortArrow col="estatus" /></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`s-${i}`}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="skeleton-shimmer" style={{ width: j === 4 ? 140 : 80, height: 13 }} /></td>
                    ))}
                  </tr>
                ))}
                {!loading && paged.length === 0 && (
                  <tr><td colSpan={8}>
                    {search.trim() ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar filtros</button>
                      </div>
                    ) : (
                      <EmptyState icon="🚛" title="No hay tráficos activos" description="Sus embarques activos aparecerán aquí." />
                    )}
                  </td></tr>
                )}
                {paged.map((r, idx) => {
                  const status = getStatus(r.estatus)
                  return (
                    <tr
                      key={r.trafico}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}`}
                      onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="trafico-id">{fmtId(r.trafico)}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {r.embarque ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {fmtSupplier(r.proveedores) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                        {r.facturas || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {fmtDesc(r.descripcion_mercancia) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {r.importe_total ? fmtUSDCompact(r.importe_total) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {r.pedimento ? (
                          <span className="pedimento-num">{fmtPedimentoShort(r.pedimento)}</span>
                        ) : (
                          <span className="pedimento-pending">Pendiente</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${status === 'Cruzado' ? 'badge-cruzado' : 'badge-proceso'}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Página {page + 1} de {totalPages}</span>
            <div className="pagination-btns">
              <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></button>
              <button className="pagination-btn current">{page + 1}</button>
              <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Página siguiente"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
