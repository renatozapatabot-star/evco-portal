'use client'

import { useEffect, useState, useMemo, Fragment, useCallback, Suspense } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtUSDCompact, fmtDate, calcPriority, priorityClass } from '@/lib/format-utils'
import { fmtCarrier } from '@/lib/carrier-names'
import { MobileTraficoCard } from '@/components/mobile-trafico-card'
// CruzScore removed from client-facing UI — scores are internal only
import { calculateCruzScore, extractScoreInput, statusDays } from '@/lib/cruz-score'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/error-boundary'
import { EmptyState } from '@/components/ui/EmptyState'

interface TraficoRow {
  trafico: string; estatus?: string; fecha_llegada?: string | null
  descripcion_mercancia?: string | null; peso_bruto?: number | null
  importe_total?: number | null; pedimento?: string | null
  semaforo?: number | null; transportista_mexicano?: string | null
  fecha_pago?: string | null; [key: string]: unknown
}

type FilterTab = 'todos' | 'proceso' | 'atención' | 'cruzado'
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
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const estatusParam = searchParams.get('estatus')
  const sortParam = searchParams.get('sort')
  const orderParam = searchParams.get('order')
  const [tab, setTab] = useState<FilterTab>((searchParams.get('filter') as FilterTab) || 'todos')
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)
  const [predictions, setPredictions] = useState<Record<string, { avgDays: number; predictedDate: string; confidence: string }>>({})
  const [riskMap, setRiskMap] = useState<Map<string, any>>(new Map())
  const [docCountMap, setDocCountMap] = useState<Map<string, number>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { sort, toggleSort } = useSort('traficos', { column: 'fecha_llegada', direction: 'desc' })
  const router = useRouter()
  const isMobile = useIsMobile()

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
    setCompanyName(cn ? decodeURIComponent(cn) : '')
    setCookiesReady(true)
  }, [])

  // Escape key closes quick-view panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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
      if (clientClave) traficosParams.set('trafico_prefix', `${clientClave}-`)
    }
    fetch(`/api/data?${traficosParams}`)
      .then(r => r.json())
      .then(d => { const arr = d.data ?? d; setRows(Array.isArray(arr) ? arr : []) })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
    fetch('/api/crossing-prediction').then(r => r.json()).then(d => setPredictions(d.predictions ?? {})).catch(() => {})

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
      .catch(() => {})

    // Risk scores
    const riskParams = new URLSearchParams({ table: 'pedimento_risk_scores', limit: '2000', order_by: 'calculated_at', order_dir: 'desc' })
    if (!isInternal) riskParams.set('company_id', companyId)
    fetch(`/api/data?${riskParams}`)
      .then(r => r.json()).then(d => {
        const map = new Map<string, Record<string, unknown>>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((r: Record<string, unknown>) => { if (r.trafico_id && !map.has(r.trafico_id as string)) map.set(r.trafico_id as string, r) })
        setRiskMap(map)
      }).catch(() => {})
  }, [cookiesReady, companyId, clientClave, userRole])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // URL state sync
  const updateURL = useCallback((newTab: FilterTab, newSearch: string) => {
    const params = new URLSearchParams()
    if (newTab !== 'todos') params.set('filter', newTab)
    if (newSearch) params.set('q', newSearch)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '/traficos', { scroll: false })
  }, [router])

  const handleTabChange = (newTab: FilterTab) => {
    setTab(newTab); setPage(0)
    updateURL(newTab, search)
  }

  const isAtencion = useCallback((r: TraficoRow): boolean => {
    const score = calculateCruzScore(extractScoreInput(r))
    const docCount = (r as Record<string, unknown>)._docCount as number | undefined
    const docCompletitud = docCount != null ? docCount / 10 : undefined
    const incidencia = !!(r as Record<string, unknown>).incidencia_abierta
    return score < 50 || incidencia || (docCompletitud != null && docCompletitud < 0.3)
  }, [])

  const filtered = useMemo(() => {
    let out = rows
    // URL estatus filter from dashboard clickable stats
    if (estatusParam) {
      const ep = estatusParam.toLowerCase()
      if (ep === 'detenido') out = out.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz') && r.pedimento && calculateCruzScore(extractScoreInput(r)) < 50)
      else if (ep === 'demorado') out = out.filter(r => isAtencion(r))
      else if (ep === 'en proceso') out = out.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz'))
      else out = out.filter(r => (r.estatus ?? '').toLowerCase().includes(ep))
    }
    if (tab === 'proceso') out = out.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz'))
    if (tab === 'cruzado') out = out.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz'))
    if (tab === 'atención') out = out.filter(r => isAtencion(r))
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
  }, [rows, tab, search, sort, isAtencion, estatusParam, sortParam, orderParam])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const enProceso = rows.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz')).length
  const cruzados = rows.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz')).length
  const atenciónCount = rows.filter(r => isAtencion(r)).length
  const totalValor = rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

  const SortArrow = ({ col }: { col: string }) => sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  return (
    <div className="page-container" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 className="pg-title">Tráficos</h1>
          <p className="pg-meta">{rows.length.toLocaleString('es-MX')} embarques{companyName ? ` · ${companyName}` : ''}</p>
        </div>
      </div>

      <div className="card">
        <div className="tbl-controls">
          <div className="tbl-filters">
            {(['todos', 'proceso', 'atención', 'cruzado'] as FilterTab[]).map(key => {
              const label = key === 'todos' ? 'Todos' : key === 'proceso' ? 'En Proceso' : key === 'atención' ? 'Atención' : 'Cruzado'
              const count = key === 'todos' ? rows.length : key === 'proceso' ? enProceso : key === 'atención' ? atenciónCount : cruzados
              return (
                <button key={key} className={`f-btn${tab === key ? ' on' : ''}`}
                  onClick={() => handleTabChange(key)}>
                  {label}
                  <span className="f-count">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="tbl-actions">
            <div className="tbl-search">
              <Search size={11} />
              <input placeholder="Tráfico, pedimento..." value={searchInput}
                onChange={e => setSearchInput(e.target.value)} />
            </div>
            <button className="act-btn" onClick={() => exportCSV(filtered, tab, clientClave, companyId)}>
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="sum-bar">
            <div className="sum-stat"><span className="sum-val">{rows.length.toLocaleString('es-MX')}</span><span className="sum-lbl">total</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: enProceso > 0 ? 'var(--status-yellow)' : 'var(--status-gray, #9C9890)' }}>{enProceso > 0 ? enProceso.toLocaleString('es-MX') : '\u2014'}</span><span className="sum-lbl">En Proceso</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: cruzados > 0 ? 'var(--status-green)' : 'var(--status-gray, #9C9890)' }}>{cruzados > 0 ? cruzados.toLocaleString('es-MX') : '\u2014'}</span><span className="sum-lbl">Cruzado</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: totalValor > 0 ? undefined : 'var(--status-gray, #9C9890)' }}>{totalValor > 0 ? fmtUSDCompact(totalValor) : '\u2014'}</span><span className="sum-lbl">valor importado</span></div>
          </div>
        )}

        {/* Mobile Cards */}
        {isMobile && (
          <div className="traficos-cards" style={{ padding: '8px 12px' }}>
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
        {!isMobile && <div className="traficos-table-wrap table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 28 }}></th>
                <th scope="col" style={{ width: 160, cursor: 'pointer' }} onClick={() => toggleSort('trafico')} className={sort.column === 'trafico' ? 'sorted' : ''} aria-sort={sort.column === 'trafico' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Tráfico<SortArrow col="trafico" /></th>
                <th scope="col" style={{ width: 110 }}>Pedimento</th>
                <th scope="col" style={{ width: 120 }}>Estado</th>
                <th scope="col" style={{ width: 110, cursor: 'pointer' }} onClick={() => toggleSort('fecha_llegada')} className={sort.column === 'fecha_llegada' ? 'sorted' : ''} aria-sort={sort.column === 'fecha_llegada' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Fecha<SortArrow col="fecha_llegada" /></th>
                <th scope="col">Descripción</th>
                <th scope="col" style={{ width: 100, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('peso_bruto')} className={sort.column === 'peso_bruto' ? 'sorted' : ''} aria-sort={sort.column === 'peso_bruto' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Peso<SortArrow col="peso_bruto" /></th>
                <th scope="col" style={{ width: 110, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('importe_total')} className={sort.column === 'importe_total' ? 'sorted' : ''} aria-sort={sort.column === 'importe_total' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>Importe<SortArrow col="importe_total" /></th>
                <th scope="col" style={{ width: 60, textAlign: 'center' }}>DOCS</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`s-${i}`}>
                  <td><div className="skel" style={{ width: 7, height: 7, borderRadius: '50%' }} /></td>
                  <td><div className="skel" style={{ width: 96, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 140, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 50, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ width: 60, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ width: 30, height: 13, margin: '0 auto' }} /></td>
                </tr>
              ))}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={9}>
                  {search.trim() ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 20, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                      <div style={{ fontSize: 12, color: 'var(--n-400)', marginTop: 4 }}>Verifica el número o intenta con el pedimento</div>
                      <button onClick={() => { setSearchInput(''); setSearch('') }} style={{ marginTop: 12, background: 'none', border: '1px solid var(--border-default)', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--gold-600)' }}>Limpiar filtros</button>
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
              {paged.map(r => {
                const ps = calcPriority(r)
                const cruzScore = calculateCruzScore(extractScoreInput(r))
                const isExpanded = expandedId === r.trafico
                const isCruzado = (r.estatus || '').toLowerCase().includes('cruz')
                const isCrossing = (r.estatus || '').toLowerCase().includes('cruc') && !isCruzado
                const days = statusDays(r.fecha_llegada ?? null)
                const rowClass = isCrossing ? 'row-crossing'
                  : isCruzado ? 'row-healthy'
                  : cruzScore < 50 ? 'row-critical'
                  : days > 7 ? 'row-warning'
                  : 'row-warning'

                return (
                  <Fragment key={r.trafico}>
                    <tr className={`${rowClass} ${isExpanded ? 'row-expanded' : ''}`}
                      onClick={() => isMobile ? setExpandedId(isExpanded ? null : r.trafico) : setSelectedId(selectedId === r.trafico ? null : r.trafico)}>
                      <td style={{ width: 28, paddingRight: 0 }}>
                        {isCrossing ? <><span className="crossing-pulse" /><span className="sr-only">En cruce</span></> : ps > 0 ? <><span className={`priority ${priorityClass(ps)}`} /><span className="sr-only">Requiere atención</span></> : null}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="c-id">{fmtId(r.trafico)}</span>
                          {(() => {
                            const risk = riskMap.get(r.trafico)
                            const riskScore = risk?.score || 0
                            if (riskScore <= 0) return null
                            return (
                              <span className="c-sub" style={{
                                color: riskScore >= 60 ? 'var(--danger)' : riskScore >= 30 ? 'var(--warning)' : 'var(--success)',
                                fontWeight: 700, fontSize: 10,
                              }} title={risk?.risk_factors ? (Array.isArray(risk.risk_factors) ? risk.risk_factors.join(', ') : String(risk.risk_factors)) : ''}>
                                {riskScore}
                              </span>
                            )
                          })()}
                        </div>
                      </td>
                      <td>{r.pedimento ? <span className="ped-pill">{r.pedimento}</span> : <span style={{ color: 'var(--n-400)' }}>—</span>}</td>
                      <td>
                        <span className={`badge ${isCruzado ? 'badge-green' : 'badge-amber'}`}>
                          <span className="badge-dot" /><span className="sr-only">Estado: </span>{isCruzado ? 'Cruzado' : 'En Proceso'}
                          {!isCruzado && r.fecha_llegada && (
                            <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--n-400)' }}>· {fmtDate(r.fecha_llegada)}</span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(r.fecha_llegada)}</td>
                      <td className="c-desc" title={fmtDesc(r.descripcion_mercancia)}>{fmtDesc(r.descripcion_mercancia) || <span style={{ color: 'var(--n-400)' }}>—</span>}</td>
                      <td className="col-num">{fmtKg(r.peso_bruto) || <span style={{ color: 'var(--n-400)' }}>—</span>}</td>
                      <td className="col-num">{(r.importe_total != null && Number(r.importe_total) > 0) ? fmtUSD(r.importe_total) : <span style={{ color: 'var(--n-400)' }}>—</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        {(() => {
                          const count = docCountMap.get(r.trafico) ?? 0
                          const color = count >= 6 ? 'var(--status-green, #2D8540)' : count >= 3 ? 'var(--status-amber, #C47F17)' : count > 0 ? 'var(--status-red, #C23B22)' : 'var(--n-400, #9C9890)'
                          return <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 12, color, fontWeight: 600 }}>{count}/6</span>
                        })()}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="expansion-row">
                        <td colSpan={9}>
                          <div className="expansion-content">
                            <div className="expansion-grid">
                              <div className="expansion-fact">
                                <span className="expansion-label">Transportista</span>
                                <span className="expansion-value">{fmtCarrier(r.transportista_mexicano as string)}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Peso Bruto</span>
                                <span className="expansion-value mono">{fmtKg(r.peso_bruto) ? `${fmtKg(r.peso_bruto)} kg` : <span style={{ color: 'var(--n-400)', fontStyle: 'italic', fontFamily: 'inherit', fontWeight: 400, fontSize: 11 }}>Verificar en GlobalPC</span>}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Importe USD</span>
                                <span className="expansion-value mono">{(r.importe_total != null && Number(r.importe_total) > 0) ? fmtUSD(r.importe_total) : <span style={{ color: 'var(--n-400)', fontStyle: 'italic', fontFamily: 'inherit', fontWeight: 400, fontSize: 11 }}>Disponible al transmitir pedimento</span>}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Fecha Llegada</span>
                                <span className="expansion-value">{fmtDate(r.fecha_llegada)}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Predicción Cruce</span>
                                <span className="expansion-value mono">{predictions[r.trafico] ? `~${predictions[r.trafico].avgDays}d` : <span style={{ color: 'var(--n-400)', fontStyle: 'italic', fontFamily: 'inherit', fontWeight: 400, fontSize: 11 }}>Calculando</span>}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Descripción</span>
                                <span className="expansion-value" style={{ fontSize: 12 }}>{fmtDesc(r.descripcion_mercancia)}</span>
                              </div>
                            </div>
                            <div className="expansion-right">
                              <button className="expansion-cta" onClick={e => { e.stopPropagation(); router.push(`/traficos/${encodeURIComponent(r.trafico)}`) }}>
                                Ver completo →
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>}


        {totalPages > 1 && (
          <div className="pag">
            <span className="pag-info">{(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}</span>
            <div className="pag-btns">
              <button className="pag-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>&lt;</button>
              <button className="pag-btn cur">{page + 1}</button>
              <button className="pag-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>&gt;</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Quick-View Side Panel ═══ */}
      {selectedId && (
        <>
          <div
            onClick={() => setSelectedId(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(2px)', zIndex: 998,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 400, maxWidth: '90vw',
            background: '#FFFFFF',
            borderLeft: '1px solid #E8E5E0',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
            zIndex: 999,
            overflowY: 'auto',
            padding: 24,
            animation: 'slideInRight 0.3s ease',
          }}>
            <QuickView traficoId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </>
      )}
    </div>
  )
}

function QuickView({ traficoId, onClose }: { traficoId: string; onClose: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [docs, setDocs] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    setData(null)
    setDocs([])
    setError(false)
    fetch(`/api/trafico/${encodeURIComponent(traficoId)}`)
      .then(r => r.json())
      .then(d => {
        setData(d.trafico ?? null)
        setDocs(d.documents ?? [])
      })
      .catch(() => setError(true))
  }, [traficoId])

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#9C9890' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Error al cargar datos</div>
        <button onClick={onClose} style={{
          marginTop: 12, background: 'none', border: '1px solid #E8E5E0',
          padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
        }}>
          Cerrar
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 24, width: 160, borderRadius: 4 }} />
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9C9890' }}>
            &times;
          </button>
        </div>
        <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
      </div>
    )
  }

  const isCruzado = ((data.estatus as string) || '').toLowerCase().includes('cruz')
  const totalDocs = docs.length
  const importe = Number(data.importe_total) || 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>
            {fmtId(data.trafico as string)}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700,
            padding: '3px 10px', borderRadius: 9999,
            background: isCruzado ? '#f0fdf4' : '#fffbeb',
            color: isCruzado ? '#2D8540' : '#C47F17',
            border: `1px solid ${isCruzado ? '#bbf7d0' : '#fde68a'}`,
          }}>
            {isCruzado ? 'Cruzado' : 'En Proceso'}
          </span>
        </div>
        <button onClick={onClose} aria-label="Cerrar" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, color: '#9C9890', padding: 4, lineHeight: 1,
          minWidth: 32, minHeight: 32,
        }}>
          &times;
        </button>
      </div>

      {/* Facts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B6B', marginBottom: 4 }}>Pedimento</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-jetbrains-mono)', color: '#1A1A1A' }}>
            {(data.pedimento as string) || <span style={{ color: '#9C9890', fontStyle: 'italic', fontSize: 11 }}>Disponible al transmitir pedimento</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B6B', marginBottom: 4 }}>Fecha Llegada</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-jetbrains-mono)', color: '#1A1A1A' }}>
            {fmtDate(data.fecha_llegada as string | null)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B6B', marginBottom: 4 }}>Importe USD</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-jetbrains-mono)', color: '#1A1A1A' }}>
            {importe > 0 ? fmtUSD(importe) : <span style={{ color: '#9C9890', fontStyle: 'italic', fontSize: 11 }}>Disponible al transmitir pedimento</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B6B', marginBottom: 4 }}>Documentos</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-jetbrains-mono)', color: '#1A1A1A' }}>
            {totalDocs > 0 ? `${totalDocs} archivos` : <span style={{ color: '#9C9890', fontStyle: 'italic', fontSize: 11 }}>Pendiente de documentos</span>}
          </div>
        </div>
      </div>

      {/* Description */}
      {typeof data.descripcion_mercancia === 'string' && data.descripcion_mercancia && (
        <div style={{ marginBottom: 20, padding: 12, background: '#FAFAF8', borderRadius: 8, border: '1px solid #E8E5E0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B6B6B', marginBottom: 4 }}>Descripción</div>
          <div style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.4 }}>
            {fmtDesc(data.descripcion_mercancia as string)}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/traficos/${encodeURIComponent(traficoId)}`}
        style={{
          display: 'block', textAlign: 'center',
          padding: '12px 24px', borderRadius: 8,
          background: 'none', border: '1px solid #B8953F',
          color: '#B8953F', fontWeight: 700, fontSize: 14,
          textDecoration: 'none', minHeight: 60,
          lineHeight: '36px',
        }}
      >
        Ver completo &rarr;
      </Link>
    </div>
  )
}
