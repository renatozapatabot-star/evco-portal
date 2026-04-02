'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtUSDCompact, fmtDate, fmtDateShort, fmtPedimentoShort, calcPriority, priorityClass } from '@/lib/format-utils'
import { MobileTraficoCard } from '@/components/mobile-trafico-card'
// CruzScore removed from client-facing UI — scores are internal only
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { ErrorBoundary } from '@/components/error-boundary'
import { useSessionCache } from '@/hooks/use-session-cache'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'

interface TraficoRow {
  trafico: string; estatus?: string; fecha_llegada?: string | null
  descripcion_mercancia?: string | null; peso_bruto?: number | null
  importe_total?: number | null; pedimento?: string | null
  semaforo?: number | null; transportista_mexicano?: string | null
  fecha_pago?: string | null; [key: string]: unknown
}

const PAGE_SIZE = 50

function exportCSV(rows: TraficoRow[], activeFilter: string, clientClave: string, companyId: string) {
  const meta = [
    'CRUZ — Renato Zapata & Company',
    `Clave: ${clientClave}`,
    `Exportado: ${fmtDate(new Date())}`,
    `Filtro: ${activeFilter}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const h = ['Trafico','Estatus','Fecha','Descripcion','Peso_kg','Importe_USD','Pedimento']
  const c = rows.map(r => [r.trafico, r.estatus??'', r.fecha_llegada?.split('T')[0]??'', (r.descripcion_mercancia??'').replace(/,/g,' '), r.peso_bruto??'', r.importe_total??'', r.pedimento??''].join(','))
  const b = new Blob([[...meta, h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const fname = `${(companyId || 'export').toUpperCase()}_Traficos_${activeFilter !== 'todos' ? activeFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.csv`
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
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const sortParam = searchParams.get('sort')
  const orderParam = searchParams.get('order')
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)
  const [riskMap, setRiskMap] = useState<Map<string, any>>(new Map())
  const [docCountMap, setDocCountMap] = useState<Map<string, number>>(new Map())
  const { sort, toggleSort } = useSort('traficos', { column: 'fecha_llegada', direction: 'desc' })
  const router = useRouter()
  const isMobile = useIsMobile()
  const { getCached, setCache } = useSessionCache()

  // Cookie values in state to avoid SSR/client hydration mismatch.
  // getCookieValue returns undefined during SSR (no document), so we
  // initialize to '' and populate on mount.
  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
    setUserRole(getCookieValue('user_role') ?? '')
    const cn = getCookieValue('company_name')
    setCompanyName(cn ?? '')
    setCookiesReady(true)
  }, [])


  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    // Client role needs companyId to fetch; broker/admin fetch all
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)

    // Broker/admin: no company_id or trafico_prefix filters → see all tráficos
    const traficosParams = new URLSearchParams({ table: 'traficos', limit: '5000', order_by: 'fecha_llegada', order_dir: 'desc' })
    if (!isInternal) {
      traficosParams.set('company_id', companyId)

    }
    setFetchError(null)
    const cached = getCached<TraficoRow[]>('traficos')
    if (cached) setRows(cached)
    fetch(`/api/data?${traficosParams}`)
      .then(r => r.json())
      .then(d => { const arr = d.data ?? d; const rows = Array.isArray(arr) ? arr : []; setRows(rows); setCache('traficos', rows) })
      .catch(() => setFetchError('Error cargando tráficos. Reintentar →'))
      .finally(() => setLoading(false))

    // Document counts
    const docParams = new URLSearchParams({ table: 'documents', select: 'trafico_id,document_type', limit: '10000' })
    if (!isInternal) docParams.set('company_id', companyId)
    fetch(`/api/data?${docParams}`)
      .then(r => r.json())
      .then(d => {
        const docs = Array.isArray(d.data) ? d.data : []
        const map = new Map<string, number>()
        docs.forEach((doc: { trafico_id?: string }) => {
          if (doc.trafico_id) map.set(doc.trafico_id, (map.get(doc.trafico_id) || 0) + 1)
        })
        setDocCountMap(map)
      })
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })

    // Risk scores
    const riskParams = new URLSearchParams({ table: 'pedimento_risk_scores', limit: '2000', order_by: 'calculated_at', order_dir: 'desc' })
    if (!isInternal) riskParams.set('company_id', companyId)
    fetch(`/api/data?${riskParams}`)
      .then(r => r.json()).then(d => {
        const map = new Map<string, Record<string, unknown>>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((r: Record<string, unknown>) => { if (r.trafico_id && !map.has(r.trafico_id as string)) map.set(r.trafico_id as string, r) })
        setRiskMap(map)
      }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
  }, [cookiesReady, companyId, clientClave, userRole])

  // Stat bar filter state (must be before filtered useMemo)
  const [statFilter, setStatFilter] = useState<string | null>(null)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])


  const filtered = useMemo(() => {
    let out = rows

    // Stat bar filter
    if (statFilter === 'activos') {
      out = out.filter(r => !(r.estatus || '').toLowerCase().includes('cruz'))
    } else if (statFilter === 'proceso') {
      out = out.filter(r => (r.estatus || '').toLowerCase().includes('proceso'))
    } else if (statFilter === 'docs') {
      out = out.filter(r => (docCountMap.get(r.trafico) ?? 0) < 6 && !(r.estatus || '').toLowerCase().includes('cruz'))
    } else if (statFilter === 'cruzado') {
      const today = new Date().toISOString().split('T')[0]
      out = out.filter(r => {
        if (!(r.estatus || '').toLowerCase().includes('cruz')) return false
        return r.fecha_pago?.startsWith(today) || r.fecha_llegada?.startsWith(today)
      })
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => fmtId(r.trafico).toLowerCase().includes(q) || (r.pedimento ?? '').toLowerCase().includes(q) || (r.descripcion_mercancia ?? '').toLowerCase().includes(q))
    }
    // Sort — URL params override interactive sort
    const activeSort = sortParam ? { column: sortParam, direction: (orderParam ?? 'desc') as 'asc' | 'desc' } : sort
    return [...out].sort((a, b) => {
      const aVal = a[activeSort.column as keyof TraficoRow]
      const bVal = b[activeSort.column as keyof TraficoRow]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return activeSort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort, sortParam, orderParam, statFilter, docCountMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalValor = rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

  // Stat bar calculations
  const kpiActivos = rows.filter(r => !(r.estatus || '').toLowerCase().includes('cruz')).length
  const kpiEnProceso = rows.filter(r => (r.estatus || '').toLowerCase().includes('proceso')).length
  const kpiDocsFaltantes = rows.filter(r => (docCountMap.get(r.trafico) ?? 0) < 6 && !(r.estatus || '').toLowerCase().includes('cruz')).length
  const kpiCruzadoHoy = rows.filter(r => {
    if (!(r.estatus || '').toLowerCase().includes('cruz')) return false
    const today = new Date().toISOString().split('T')[0]
    return r.fecha_pago?.startsWith(today) || r.fecha_llegada?.startsWith(today)
  }).length

  const SortArrow = ({ col }: { col: string }) => sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  return (
    <div className="page-shell">
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="page-title">Tráficos</h1>
          <p className="page-subtitle">{rows.length.toLocaleString('es-MX')} embarques{companyName ? ` · ${companyName}` : ''}</p>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => { setFetchError(null); setLoading(true); window.location.reload() }} />
        </div>
      )}

      {/* Stat Filter Bar */}
      {!loading && !fetchError && rows.length > 0 && (
        <div className="stat-filter-bar">
          {[
            { key: 'activos', label: 'Activos', value: kpiActivos, danger: false },
            { key: 'proceso', label: 'En Proceso', value: kpiEnProceso, danger: false },
            { key: 'docs', label: 'Docs Faltantes', value: kpiDocsFaltantes, danger: kpiDocsFaltantes > 0 },
            { key: 'cruzado', label: 'Cruzado Hoy', value: kpiCruzadoHoy, danger: false },
          ].map(stat => (
            <button
              key={stat.key}
              className={`stat-filter-item${statFilter === stat.key ? ' active' : ''}`}
              onClick={() => { setStatFilter(statFilter === stat.key ? null : stat.key); setPage(0) }}
            >
              <span className={`stat-filter-value${stat.value === 0 ? ' zero' : ''}${stat.danger ? ' danger' : ''}`}>{stat.value}</span>
              <span className="stat-filter-label">{stat.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="table-shell" style={!loading && !fetchError && rows.length > 0 ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search">
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input placeholder="Tráfico, pedimento..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(filtered, 'todos', clientClave, companyId)}>
            <Download size={12} /> CSV
          </button>
        </div>

        {!loading && rows.length > 0 && (
          <div className="summary-bar">
            <div className="summary-stat"><span className="summary-value">{rows.length.toLocaleString('es-MX')}</span><span className="summary-label"> total</span></div>
            <div className="summary-sep" />
            <div className="summary-stat"><span className="summary-value" style={{ color: totalValor > 0 ? undefined : 'var(--slate-300)' }}>{totalValor > 0 ? fmtUSDCompact(totalValor) : '—'}</span><span className="summary-label"> valor importado</span></div>
          </div>
        )}

        {/* Mobile Cards */}
        {isMobile && (
          <div style={{ padding: '8px 12px' }}>
            <div className="m-card-list">
              {paged.map(r => (
                <MobileTraficoCard key={r.trafico} trafico={r} onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)} />
              ))}
              {!loading && paged.length === 0 && (
                <EmptyState
                  icon="🚛"
                  title="No hay tráficos activos"
                  description="Sus embarques activos aparecerán aquí"
                  cta={{ label: "Contactar a su agente", href: "/comunicaciones" }}
                />
              )}
            </div>
          </div>
        )}

        {/* Table — desktop only */}
        {!isMobile && <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="cruz-table" aria-label="Lista de tráficos" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 28 }}></th>
                <th scope="col" style={{ width: 160, cursor: 'pointer' }} onClick={() => toggleSort('trafico')} aria-sort={sort.column === 'trafico' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Tráfico<SortArrow col="trafico" /></th>
                <th scope="col" style={{ width: 110 }}>Pedimento</th>
                <th scope="col" style={{ width: 120 }}>Estado</th>
                <th scope="col" style={{ width: 110, cursor: 'pointer' }} onClick={() => toggleSort('fecha_llegada')} aria-sort={sort.column === 'fecha_llegada' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Fecha<SortArrow col="fecha_llegada" /></th>
                <th scope="col">Descripción</th>
                <th scope="col" style={{ width: 100, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('peso_bruto')} aria-sort={sort.column === 'peso_bruto' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Peso<SortArrow col="peso_bruto" /></th>
                <th scope="col" style={{ width: 110, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('importe_total')} aria-sort={sort.column === 'importe_total' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Importe<SortArrow col="importe_total" /></th>
                <th scope="col" style={{ width: 60, textAlign: 'center' }}>DOCS</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`s-${i}`}>
                  <td><div className="skeleton-shimmer" style={{ width: 7, height: 7, borderRadius: '50%' }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 96, height: 13 }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 140, height: 13 }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 50, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 60, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skeleton-shimmer" style={{ width: 30, height: 13, margin: '0 auto' }} /></td>
                </tr>
              ))}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={9}>
                  {search.trim() ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                      <div className="empty-state-hint">Verifica el número o intenta con el pedimento</div>
                      <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar filtros</button>
                    </div>
                  ) : (
                    <EmptyState
                      icon="🚛"
                      title="No hay tráficos activos"
                      description="Sus embarques activos aparecerán aquí"
                      cta={{ label: "Contactar a su agente", href: "/comunicaciones" }}
                    />
                  )}
                </td></tr>
              )}
              {paged.map((r, idx) => {
                const ps = calcPriority(r)
                const isCruzado = (r.estatus || '').toLowerCase().includes('cruz')
                const isCrossing = (r.estatus || '').toLowerCase().includes('cruc') && !isCruzado
                const isDetenido = (r.estatus || '').toLowerCase().includes('deten')
                const isHighValue = (Number(r.importe_total) || 0) > 100000 && !isCruzado

                return (
                    <tr key={r.trafico}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}${isCrossing ? ' row-crossing' : ''}`}
                      style={isHighValue && !isDetenido ? { borderLeft: '3px solid var(--gold)' } : undefined}
                      onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)}>
                      <td style={{ width: 28, paddingRight: 0 }}>
                        {isCrossing ? <><span className="crossing-pulse" /><span className="sr-only">En cruce</span></> : ps > 0 ? <><span className={`priority-dot ${priorityClass(ps)}`} /><span className="sr-only">Requiere atención</span></> : null}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="trafico-id">{fmtId(r.trafico)}</span>
                          {(() => {
                            const risk = riskMap.get(r.trafico)
                            const riskScore = risk?.score || 0
                            if (riskScore <= 0) return null
                            return (
                              <span className="font-mono" style={{
                                color: riskScore >= 60 ? 'var(--danger)' : riskScore >= 30 ? 'var(--warning)' : 'var(--success)',
                                fontWeight: 700, fontSize: 10,
                              }} title={risk?.risk_factors ? (Array.isArray(risk.risk_factors) ? risk.risk_factors.join(', ') : String(risk.risk_factors)) : ''}>
                                {riskScore}
                              </span>
                            )
                          })()}
                        </div>
                      </td>
                      <td>{r.pedimento ? <span className="pedimento-num" onClick={e => { e.stopPropagation(); router.push(`/traficos/${encodeURIComponent(r.trafico)}?tab=financiero`) }} style={{ cursor: 'pointer' }}>{fmtPedimentoShort(r.pedimento)}</span> : <span className="pedimento-pending">Pendiente</span>}</td>
                      <td>
                        <span className={`badge ${isDetenido ? 'badge-detenido' : isCruzado ? 'badge-cruzado' : 'badge-proceso'}`}>
                          <span className="badge-dot" />{isDetenido ? 'Detenido' : isCruzado ? 'Cruzado' : 'En Proceso'}
                        </span>
                      </td>
                      <td className="timestamp">{fmtDateShort(r.fecha_llegada)}</td>
                      <td className="desc-text" title={fmtDesc(r.descripcion_mercancia)}>{fmtDesc(r.descripcion_mercancia) || '—'}</td>
                      <td className="currency text-right">{r.peso_bruto ? `${fmtKg(r.peso_bruto)} kg` : '—'}</td>
                      <td className="currency text-right" title={!(r.importe_total != null && Number(r.importe_total) > 0) ? 'Valor aún no disponible para esta operación' : undefined}>{(r.importe_total != null && Number(r.importe_total) > 0) ? `${fmtUSD(r.importe_total)} USD` : '—'}</td>
                      <td>
                        {(() => {
                          const count = docCountMap.get(r.trafico) ?? 0
                          const colorClass = count >= 5 ? 'success' : count >= 3 ? 'warning' : 'danger'
                          return (
                            <div className="doc-segments" title={`${count}/6 documentos`}>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className={`doc-seg${i < count ? ` filled ${colorClass}` : ''}`} />
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                )
              })}
            </tbody>
          </table>
        </div>}


        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">{(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}</span>
            <div className="pagination-btns">
              <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <button className="pagination-btn current">{page + 1}</button>
              <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Sync timestamp */}
      {!loading && rows.length > 0 && (
        <div className="timestamp" style={{ textAlign: 'right', padding: '8px 0', fontSize: 10, color: 'var(--slate-400)' }} suppressHydrationWarning>
          Sincronizado: {fmtDate(new Date())}
        </div>
      )}
    </div>
  )
}

