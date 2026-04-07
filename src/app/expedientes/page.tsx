'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtDateShort, fmtPedimentoShort } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSort } from '@/hooks/use-sort'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import { DocCompleteness } from '@/components/expedientes/DocCompleteness'
import { DocChecklist } from '@/components/expedientes/DocChecklist'
import type { DocFile } from '@/components/expedientes/DocChecklist'

const REQUIRED_DOCS = [
  'factura_comercial', 'packing_list', 'pedimento_detallado',
  'cove', 'acuse_cove', 'doda',
]

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  pedimento: string | null
  importe_total: number | null
  descripcion_mercancia: string | null
  proveedores: string | null
  docs: DocFile[]
  docCount: number
  pct: number
  missing: string[]
  entrada: string | null
}

const PAGE_SIZE = 50

export default function ExpedientesPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statFilter, setStatFilter] = useState<string | null>(null)
  const [viewerDocs, setViewerDocs] = useState<DocFile[]>([])
  const [viewerIndex, setViewerIndex] = useState(-1)
  const { sort, toggleSort } = useSort('expedientes', { column: 'fecha_llegada', direction: 'desc' })

  const [cookiesReady, setCookiesReady] = useState(false)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCookieValue('company_id') ?? ''
    if (!isInternal && !companyId) { setLoading(false); return }
    const cf = !isInternal && companyId ? `&company_id=${companyId}` : ''

    setFetchError(null)
    const safeFetch = (url: string) => fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
      return r.json()
    })

    Promise.all([
      safeFetch(`/api/data?table=traficos&limit=5000&order_by=fecha_llegada&order_dir=desc${cf}`),
      safeFetch(`/api/data?table=expediente_documentos&limit=5000${cf}`),
      safeFetch(`/api/data?table=entradas&limit=5000${cf}`),
      safeFetch('/api/data?table=globalpc_partidas&limit=10000').catch(() => ({ data: [] })),
    ]).then(([traficoData, docData, entradaData, partidaData]) => {
      const traficos = (traficoData.data ?? []) as Array<Record<string, unknown>>
      const allDocs = (docData.data ?? []) as Array<Record<string, unknown>>
      const entradas = (entradaData.data ?? []) as Array<Record<string, unknown>>

      // Build doc map: pedimento_id (= trafico) → docs
      const docMap = new Map<string, DocFile[]>()
      allDocs.forEach(d => {
        const key = String(d.pedimento_id ?? '')
        if (!key) return
        if (!docMap.has(key)) docMap.set(key, [])
        docMap.get(key)!.push({
          id: String(d.id ?? ''),
          doc_type: d.doc_type as string | null,
          file_name: d.file_name as string | null,
          file_url: d.file_url as string | null,
          uploaded_at: d.uploaded_at as string | null,
        })
      })

      // Build partida description map: cve_trafico → descripcion
      const partidaDescMap = new Map<string, string>()
      const allPartidas = (partidaData.data ?? []) as Array<Record<string, unknown>>
      allPartidas.forEach(p => {
        const key = String(p.cve_trafico ?? '')
        if (key && p.descripcion && !partidaDescMap.has(key)) {
          partidaDescMap.set(key, String(p.descripcion))
        }
      })

      // Build entrada map: trafico → cve_entrada
      const entradaMap = new Map<string, string>()
      entradas.forEach(e => {
        const t = String(e.trafico ?? '')
        if (t) entradaMap.set(t, String(e.cve_entrada ?? ''))
      })

      // Build enriched rows
      const enriched: TraficoRow[] = traficos.map(t => {
        const trafico = String(t.trafico ?? '')
        const docs = docMap.get(trafico) ?? []
        const presentTypes = new Set(docs.map(d => d.doc_type).filter(Boolean))
        const docCount = REQUIRED_DOCS.filter(r => presentTypes.has(r)).length
        const missing = REQUIRED_DOCS.filter(r => !presentTypes.has(r))
        const pct = Math.round((docCount / REQUIRED_DOCS.length) * 100)

        return {
          trafico,
          estatus: String(t.estatus ?? 'En Proceso'),
          fecha_llegada: t.fecha_llegada as string | null,
          pedimento: t.pedimento as string | null,
          importe_total: t.importe_total as number | null,
          descripcion_mercancia: (t.descripcion_mercancia as string | null) || partidaDescMap.get(trafico) || null,
          proveedores: t.proveedores as string | null,
          docs,
          docCount,
          pct,
          missing,
          entrada: entradaMap.get(trafico) ?? null,
        }
      })

      setRows(enriched)
    }).catch(err => {
      if (err.message === 'session_expired') { window.location.href = '/login'; return }
      setFetchError('Error cargando expedientes. Reintentar →')
    }).finally(() => setLoading(false))
  }, [cookiesReady, userRole])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Stats
  const kpiTotal = rows.length
  const kpiCompletos = rows.filter(r => r.pct === 100).length
  const kpiIncompletos = rows.filter(r => r.pct < 100 && r.docs.length > 0).length
  const kpiCriticos = rows.filter(r => r.missing.includes('factura_comercial') || r.missing.includes('pedimento_detallado')).length

  const filtered = useMemo(() => {
    let out = rows

    if (statFilter === 'completos') out = out.filter(r => r.pct === 100)
    else if (statFilter === 'incompletos') out = out.filter(r => r.pct < 100 && r.docs.length > 0)
    else if (statFilter === 'criticos') out = out.filter(r => r.missing.includes('factura_comercial') || r.missing.includes('pedimento_detallado'))

    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        fmtId(r.trafico).toLowerCase().includes(q) ||
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q)
      )
    }

    return [...out].sort((a, b) => {
      const col = sort.column as keyof TraficoRow
      const aVal = a[col]
      const bVal = b[col]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort, statFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) => sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  return (
    <div className="page-shell">
      {fetchError && <div style={{ marginBottom: 16 }}><ErrorCard message={fetchError} onRetry={() => window.location.reload()} /></div>}

      {/* Stat Filter Bar */}
      {!loading && !fetchError && rows.length > 0 && (
        <div className="stat-filter-bar">
          {[
            { key: null, label: 'Todos', value: kpiTotal },
            { key: 'completos', label: 'Completos', value: kpiCompletos },
            { key: 'incompletos', label: 'Incompletos', value: kpiIncompletos },
            ...(userRole === 'broker' || userRole === 'admin'
              ? [{ key: 'criticos', label: 'Pendientes de integración', value: kpiCriticos }]
              : []),
          ].map(stat => (
            <button
              key={stat.key ?? 'all'}
              className={`stat-filter-item${statFilter === stat.key ? ' active' : ''}`}
              onClick={() => { setStatFilter(statFilter === stat.key ? null : stat.key); setPage(0) }}
            >
              <span className={`stat-filter-value${stat.value === 0 ? ' zero' : ''}`}>{stat.value}</span>
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
              onChange={e => setSearchInput(e.target.value)} aria-label="Buscar expedientes" />
          </div>
        </div>

        {/* Mobile cards */}
        {isMobile && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={`skel-${i}`} style={{ height: 80, borderRadius: 10, background: 'var(--bg-elevated)', animation: 'cruzShimmer 1.5s linear infinite' }} />
            ))}
            {!loading && paged.length === 0 && (
              <EmptyState icon="📂" title="Sin expedientes" description="Los expedientes digitales de sus tráficos aparecerán aquí" cta={{ label: 'Ver tráficos', href: '/traficos' }} />
            )}
            {paged.map(r => {
              const isCruzado = (r.estatus || '').toLowerCase().includes('cruz')
              const isExpanded = expandedId === r.trafico
              return (
                <div key={r.trafico}>
                  <button className="m-card" onClick={() => setExpandedId(isExpanded ? null : r.trafico)}
                    style={{ width: '100%', textAlign: 'left' }}>
                    <div className="m-card-top">
                      <div className="m-card-id-group">
                        <span className={`m-card-dot ${isCruzado ? 'm-card-dot--success' : 'm-card-dot--warning'}`} />
                        <span className="m-card-id">{fmtId(r.trafico)}</span>
                      </div>
                      <DocCompleteness present={r.docCount} />
                    </div>
                    <div className="m-card-bottom">
                      {r.pedimento && <span className="ped-pill" style={{ fontSize: 11, padding: '2px 7px' }}>{fmtPedimentoShort(r.pedimento)}</span>}
                      <span className="m-card-meta">{r.fecha_llegada ? fmtDateShort(r.fecha_llegada) : '—'}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <DocChecklist
                      trafico={r.trafico} pedimento={r.pedimento} docs={r.docs}
                      entrada={r.entrada} proveedor={r.proveedores?.split(',')[0]?.trim()} valor={r.importe_total}
                      onClose={() => setExpandedId(null)}
                      onViewDoc={(docs, idx) => { setViewerDocs(docs); setViewerIndex(idx) }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Desktop table */}
        {!isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="cruz-table" aria-label="Expedientes digitales" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 28 }}></th>
                  <th scope="col" style={{ width: 160, cursor: 'pointer' }} onClick={() => toggleSort('trafico')}>Tráfico<SortArrow col="trafico" /></th>
                  <th scope="col" style={{ width: 120 }}>Pedimento</th>
                  <th scope="col" style={{ width: 110 }}>Estado</th>
                  <th scope="col" style={{ width: 100, cursor: 'pointer' }} onClick={() => toggleSort('fecha_llegada')}>Fecha<SortArrow col="fecha_llegada" /></th>
                  <th scope="col" style={{ width: 120, cursor: 'pointer' }} onClick={() => toggleSort('pct')}>Documentos<SortArrow col="pct" /></th>
                  <th scope="col">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`s-${i}`}>
                    <td><div className="skeleton-shimmer" style={{ width: 7, height: 7, borderRadius: '50%' }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 96, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 90, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 70, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 60, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 80, height: 13 }} /></td>
                    <td><div className="skeleton-shimmer" style={{ width: 140, height: 13 }} /></td>
                  </tr>
                ))}
                {!loading && paged.length === 0 && (
                  <tr><td colSpan={7}>
                    {search.trim() ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar búsqueda</button>
                      </div>
                    ) : (
                      <EmptyState icon="📂" title="Sin expedientes digitales" description="Los expedientes de cada tráfico aparecerán aquí" cta={{ label: 'Ver tráficos', href: '/traficos' }} />
                    )}
                  </td></tr>
                )}
                {paged.map((r, idx) => {
                  const isCruzado = (r.estatus || '').toLowerCase().includes('cruz')
                  const isDetenido = (r.estatus || '').toLowerCase().includes('deten')
                  const isExpanded = expandedId === r.trafico

                  return (
                    <tr key={r.trafico}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}${isExpanded ? ' row-even' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : r.trafico)}>
                      <td style={{ width: 28, paddingRight: 0 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                          background: isCruzado ? 'var(--success-500)' : isDetenido ? 'var(--danger-500)' : 'var(--amber-500)',
                          opacity: 0.7,
                        }} />
                      </td>
                      <td><span className="trafico-id">{fmtId(r.trafico)}</span></td>
                      <td>{r.pedimento ? <span className="pedimento-num">{fmtPedimentoShort(r.pedimento)}</span> : <span className="pedimento-pending">Pendiente</span>}</td>
                      <td>
                        <span className={`badge ${isDetenido ? 'badge-detenido' : isCruzado ? 'badge-cruzado' : 'badge-proceso'}`}>
                          <span className="badge-dot" aria-hidden="true" />{isDetenido ? 'Detenido' : isCruzado ? 'Cruzado' : 'En Proceso'}
                        </span>
                      </td>
                      <td className="timestamp">{r.fecha_llegada ? fmtDateShort(r.fecha_llegada) : '—'}</td>
                      <td><DocCompleteness present={r.docCount} /></td>
                      <td className="desc-text">{fmtDesc(r.descripcion_mercancia) || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expanded checklist (below table, outside the scroll container) */}
        {expandedId && (() => {
          const r = rows.find(r => r.trafico === expandedId)
          if (!r) return null
          return (
            <DocChecklist
              trafico={r.trafico} pedimento={r.pedimento} docs={r.docs}
              entrada={r.entrada} proveedor={r.proveedores?.split(',')[0]?.trim()} valor={r.importe_total}
              onClose={() => setExpandedId(null)}
              onViewDoc={(docs, idx) => { setViewerDocs(docs); setViewerIndex(idx) }}
            />
          )
        })()}

        {/* Pagination */}
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

      {/* Document viewer modal */}
      {viewerIndex >= 0 && viewerDocs.length > 0 && (
        <DocumentViewer documents={viewerDocs} initialIndex={viewerIndex} onClose={() => setViewerIndex(-1)} traficoId={expandedId || ''} />
      )}
    </div>
  )
}
