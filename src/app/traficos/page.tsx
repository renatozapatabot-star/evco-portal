'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtUSDCompact, fmtDate, fmtDateShort, calcPriority, priorityClass } from '@/lib/format-utils'
import { MobileTraficoCard } from '@/components/mobile-trafico-card'
// CruzScore removed from client-facing UI — scores are internal only
import { calculateCruzScore, extractScoreInput, statusDays } from '@/lib/cruz-score'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { ErrorBoundary } from '@/components/error-boundary'
import { EmptyState } from '@/components/ui/EmptyState'

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


  const filtered = useMemo(() => {
    let out = rows
    // Text search only — no status/estatus filtering
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
  }, [rows, search, sort, sortParam, orderParam])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalValor = rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

  // KPI calculations
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
    <div className="page-container" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 className="pg-title">Tráficos</h1>
          <p className="pg-meta">{rows.length.toLocaleString('es-MX')} embarques{companyName ? ` · ${companyName}` : ''}</p>
        </div>
      </div>

      {/* KPI Strip */}
      {!loading && rows.length > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Activos', value: kpiActivos },
            { label: 'En Proceso', value: kpiEnProceso },
            { label: 'Docs Faltantes', value: kpiDocsFaltantes },
            { label: 'Cruzado Hoy', value: kpiCruzadoHoy },
          ].map((kpi, i) => (
            <div key={kpi.label} className="kpi-card" style={{
              background: 'var(--cruz-surface)',
              border: '1px solid var(--cruz-border)',
              borderRadius: 12,
              padding: '20px 24px',
            }}>
              <div className="hero-number" style={{ color: 'var(--n-900)', marginBottom: 4 }}>
                {kpi.value}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--cruz-text-muted)',
              }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="tbl-controls">
          <div className="tbl-actions" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <div className="tbl-search">
              <Search size={11} />
              <input placeholder="Tráfico, pedimento..." value={searchInput}
                onChange={e => setSearchInput(e.target.value)} />
            </div>
            <button className="act-btn" onClick={() => exportCSV(filtered, 'todos', clientClave, companyId)}>
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="sum-bar">
            <div className="sum-stat"><span className="sum-val">{rows.length.toLocaleString('es-MX')}</span><span className="sum-lbl">total</span></div>
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
                const isCruzado = (r.estatus || '').toLowerCase().includes('cruz')
                const isCrossing = (r.estatus || '').toLowerCase().includes('cruc') && !isCruzado
                const days = statusDays(r.fecha_llegada ?? null)
                const rowClass = isCrossing ? 'row-crossing'
                  : isCruzado ? 'row-healthy'
                  : cruzScore < 50 ? 'row-critical'
                  : days > 7 ? 'row-warning'
                  : 'row-warning'

                const blockingCount = !isCruzado ? (6 - (docCountMap.get(r.trafico) ?? 0)) : 0
                const isHighValue = (Number(r.importe_total) || 0) > 100000
                const hasMissingDocs = blockingCount > 0 && !isCruzado

                const rowBorderStyle = hasMissingDocs
                  ? { borderLeft: '2px solid var(--cruz-red)' }
                  : isHighValue
                  ? { borderLeft: '2px solid var(--cruz-gold)' }
                  : {}

                return (
                    <tr key={r.trafico} className={rowClass} style={rowBorderStyle}
                      onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)}>
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
                      <td>{r.pedimento ? <span className="ped-pill">{r.pedimento}</span> : <span style={{ color: '#4A4640', fontStyle: 'italic', fontSize: 12 }}>Pendiente</span>}</td>
                      <td>
                        <span className={`badge ${isCruzado ? 'badge-green' : 'badge-amber'}`}>
                          <span className="badge-dot" /><span className="sr-only">Estado: </span>{isCruzado ? 'Cruzado' : 'En Proceso'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDateShort(r.fecha_llegada)}</td>
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

    </div>
  )
}

