'use client'

import { useEffect, useState, useMemo, Fragment, useCallback } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CLIENT_NAME, CLIENT_CLAVE, PATENTE } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtUSDCompact, fmtDate, calcPriority, priorityClass } from '@/lib/format-utils'
import { fmtCarrier } from '@/lib/carrier-names'
import { MobileTraficoCard } from '@/components/mobile-trafico-card'
import { CruzScore } from '@/components/cruz-score'
import { calculateCruzScore, extractScoreInput, statusDays } from '@/lib/cruz-score'
import { useSort } from '@/hooks/use-sort'

interface TraficoRow {
  trafico: string; estatus?: string; fecha_llegada?: string | null
  descripcion_mercancia?: string | null; peso_bruto?: number | null
  importe_total?: number | null; pedimento?: string | null
  semaforo?: number | null; transportista_mexicano?: string | null
  fecha_pago?: string | null; [key: string]: unknown
}

type FilterTab = 'todos' | 'proceso' | 'cruzado'
const PAGE_SIZE = 50

function exportCSV(rows: TraficoRow[], activeFilter: string) {
  const meta = [
    'CRUZ — Renato Zapata & Company',
    `RFC: EPM001109I74 · Clave: ${CLIENT_CLAVE}`,
    `Exportado: ${new Date().toLocaleString('es-MX')}`,
    `Filtro: ${activeFilter}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const h = ['Trafico','Estatus','Fecha','Descripcion','Peso_kg','Importe_USD','Pedimento']
  const c = rows.map(r => [r.trafico, r.estatus??'', r.fecha_llegada?.split('T')[0]??'', (r.descripcion_mercancia??'').replace(/,/g,' '), r.peso_bruto??'', r.importe_total??'', r.pedimento??''].join(','))
  const b = new Blob([[...meta, h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const fname = `EVCO_Traficos_${activeFilter !== 'todos' ? activeFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.csv`
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click()
}

export default function TraficosPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [tab, setTab] = useState<FilterTab>((searchParams.get('filter') as FilterTab) || 'todos')
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)
  const [predictions, setPredictions] = useState<Record<string, { avgDays: number; predictedDate: string; confidence: string }>>({})
  const [riskMap, setRiskMap] = useState<Map<string, any>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { sort, toggleSort } = useSort('traficos', { column: 'fecha_llegada', direction: 'desc' })
  const router = useRouter()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=5000&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json()).then(d => setRows(d.data ?? d ?? []))
      .catch(() => {}).finally(() => setLoading(false))
    fetch('/api/crossing-prediction').then(r => r.json()).then(d => setPredictions(d.predictions ?? {})).catch(() => {})
    fetch('/api/data?table=pedimento_risk_scores&company_id=evco&limit=2000&order_by=calculated_at&order_dir=desc')
      .then(r => r.json()).then(d => {
        const map = new Map<string, any>()
        ;(d.data ?? []).forEach((r: any) => { if (r.trafico_id && !map.has(r.trafico_id)) map.set(r.trafico_id, r) })
        setRiskMap(map)
      }).catch(() => {})
  }, [])

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

  const filtered = useMemo(() => {
    let out = rows
    if (tab === 'proceso') out = out.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz'))
    if (tab === 'cruzado') out = out.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz'))
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => fmtId(r.trafico).toLowerCase().includes(q) || (r.pedimento ?? '').toLowerCase().includes(q) || (r.descripcion_mercancia ?? '').toLowerCase().includes(q))
    }
    // Sort
    return [...out].sort((a, b) => {
      const aVal = a[sort.column as keyof TraficoRow]
      const bVal = b[sort.column as keyof TraficoRow]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, tab, search, sort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const enProceso = rows.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz')).length
  const cruzados = rows.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz')).length
  const totalValor = rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

  const SortArrow = ({ col }: { col: string }) => sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 className="pg-title">Tráficos</h1>
          <p className="pg-meta">{rows.length.toLocaleString('es-MX')} embarques · {CLIENT_NAME} · Patente {PATENTE}</p>
        </div>
      </div>

      <div className="card">
        <div className="tbl-controls">
          <div className="tbl-filters">
            {(['todos', 'proceso', 'cruzado'] as FilterTab[]).map(key => (
              <button key={key} className={`f-btn${tab === key ? ' on' : ''}`}
                onClick={() => handleTabChange(key)}>
                {key === 'todos' ? 'Todos' : key === 'proceso' ? 'En Proceso' : 'Cruzado'}
                <span className="f-count">{key === 'todos' ? rows.length : key === 'proceso' ? enProceso : cruzados}</span>
              </button>
            ))}
          </div>
          <div className="tbl-actions">
            <div className="tbl-search">
              <Search size={11} />
              <input placeholder="Tráfico, pedimento..." value={searchInput}
                onChange={e => setSearchInput(e.target.value)} />
            </div>
            <button className="act-btn" onClick={() => exportCSV(filtered, tab)}>
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="sum-bar">
            <div className="sum-stat"><span className="sum-val">{rows.length.toLocaleString('es-MX')}</span><span className="sum-lbl">total</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: 'var(--status-yellow)' }}>{enProceso.toLocaleString('es-MX')}</span><span className="sum-lbl">En Proceso</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: 'var(--status-green)' }}>{cruzados.toLocaleString('es-MX')}</span><span className="sum-lbl">Cruzado</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val">{fmtUSDCompact(totalValor)}</span><span className="sum-lbl">valor importado</span></div>
          </div>
        )}

        {/* Mobile Cards */}
        <div className="traficos-cards" style={{ display: 'none', padding: '8px 12px' }}>
          <div className="m-card-list">
            {paged.map(r => {
              const cs = calculateCruzScore(extractScoreInput(r))
              return <MobileTraficoCard key={r.trafico} trafico={{ ...r, _cruzScore: cs }} onClick={() => router.push(`/traficos/${encodeURIComponent(r.trafico)}`)} />
            })}
          </div>
        </div>

        {/* Table */}
        <div className="traficos-table-wrap table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                <th scope="col" style={{ width: 50, textAlign: 'center' }}>Score</th>
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
                  <td><div className="skel" style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto' }} /></td>
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
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 20, marginBottom: 8 }}>🚚</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Sin tráficos {tab !== 'todos' ? (tab === 'proceso' ? 'en proceso' : 'cruzados') : 'activos'}</div>
                      <div style={{ fontSize: 12, color: 'var(--n-400)', marginTop: 4 }}>No hay operaciones para el período seleccionado</div>
                    </div>
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
                      onClick={() => setExpandedId(isExpanded ? null : r.trafico)}>
                      <td style={{ width: 28, paddingRight: 0 }}>
                        {isCrossing ? <span className="crossing-pulse" /> : ps > 0 ? <span className={`priority ${priorityClass(ps)}`} title={`Score: ${ps}`} /> : null}
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
                      <td>{r.pedimento ? <span className="ped-pill">{r.pedimento}</span> : null}</td>
                      <td>
                        <span className={`badge ${isCruzado ? 'badge-green' : 'badge-amber'}`}>
                          <span className="badge-dot" />{isCruzado ? 'Cruzado' : 'En Proceso'}
                          {!isCruzado && r.fecha_llegada && (
                            <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--n-400)' }}>· {fmtDate(r.fecha_llegada)}</span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{fmtDate(r.fecha_llegada)}</td>
                      <td className="c-desc" title={fmtDesc(r.descripcion_mercancia)}>{fmtDesc(r.descripcion_mercancia)}</td>
                      <td className="col-num">{fmtKg(r.peso_bruto)}</td>
                      <td className="col-num">{fmtUSD(r.importe_total)}</td>
                      <td style={{ textAlign: 'center' }}><CruzScore score={cruzScore} size="sm" /></td>
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
                                <span className="expansion-value mono">{fmtKg(r.peso_bruto)} kg</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Importe USD</span>
                                <span className="expansion-value mono">{fmtUSD(r.importe_total)}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Fecha Llegada</span>
                                <span className="expansion-value">{fmtDate(r.fecha_llegada)}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Predicción Cruce</span>
                                <span className="expansion-value mono">{predictions[r.trafico] ? `~${predictions[r.trafico].avgDays}d` : ''}</span>
                              </div>
                              <div className="expansion-fact">
                                <span className="expansion-label">Descripción</span>
                                <span className="expansion-value" style={{ fontSize: 12 }}>{fmtDesc(r.descripcion_mercancia)}</span>
                              </div>
                            </div>
                            <div className="expansion-right">
                              <CruzScore score={cruzScore} size="lg" showLabel />
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
        </div>

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
