'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { CLIENT_NAME, CLIENT_CLAVE, PATENTE } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtKg, fmtUSD, fmtDate, fmtCompact, calcPriority, priorityClass } from '@/lib/format-utils'
import { TraficoDetail } from '@/components/trafico-detail'

interface TraficoRow {
  trafico: string; estatus?: string; fecha_llegada?: string | null
  descripcion_mercancia?: string | null; peso_bruto?: number | null
  importe_total?: number | null; pedimento?: string | null
  semaforo?: number | null; [key: string]: unknown
}

type FilterTab = 'todos' | 'proceso' | 'cruzado'
const PAGE_SIZE = 50

function StatusDot({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase()
  if (s.includes('cruz')) return <span className="status s-cruzado"><span className="s-dot" />Cruzado</span>
  if (s.includes('hold') || s.includes('deten')) return <span className="status s-hold"><span className="s-dot" />Detenido</span>
  return <span className="status s-proceso"><span className="s-dot" />En Proceso</span>
}

function exportCSV(rows: TraficoRow[]) {
  const h = ['Trafico','Estatus','Fecha','Descripcion','Peso_kg','Importe_USD','Pedimento']
  const c = rows.map(r => [r.trafico, r.estatus??'', r.fecha_llegada?.split('T')[0]??'', (r.descripcion_mercancia??'').replace(/,/g,' '), r.peso_bruto??'', r.importe_total??'', r.pedimento??''].join(','))
  const b = new Blob([[h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `traficos-${CLIENT_CLAVE}-${new Date().toISOString().split('T')[0]}.csv`; a.click()
}

export default function TraficosPage() {
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('todos')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [riskScores, setRiskScores] = useState<Record<string, { score: number; factors: string[] }>>({})
  const [crossPred, setCrossPred] = useState<Record<string, { avgDays: number; predictedDate: string; confidence: string }>>({})

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=5000&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json()).then(d => setRows(d.data ?? d ?? []))
      .catch(() => {}).finally(() => setLoading(false))
    // Load risk scores
    fetch('/api/risk-scores').then(r => r.json()).then(d => setRiskScores(d.scores || {})).catch(() => {})
    fetch('/api/crossing-prediction').then(r => r.json()).then(d => setCrossPred(d.predictions || {})).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let out = rows
    if (tab === 'proceso') out = out.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz'))
    if (tab === 'cruzado') out = out.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz'))
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r => fmtId(r.trafico).toLowerCase().includes(q) || (r.pedimento ?? '').toLowerCase().includes(q) || (r.descripcion_mercancia ?? '').toLowerCase().includes(q))
    }
    return out
  }, [rows, tab, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const enProceso = rows.filter(r => !(r.estatus ?? '').toLowerCase().includes('cruz')).length
  const cruzados = rows.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz')).length
  const totalValor = rows.reduce((s, r) => s + (Number(r.importe_total) || 0), 0)

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 className="pg-title">Traficos</h1>
          <p className="pg-meta">{rows.length.toLocaleString('es-MX')} embarques &middot; {CLIENT_NAME} &middot; Patente {PATENTE}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        {/* Controls */}
        <div className="tbl-controls">
          <div className="tbl-filters">
            {(['todos', 'proceso', 'cruzado'] as FilterTab[]).map(key => (
              <button key={key} className={`f-btn${tab === key ? ' on' : ''}`}
                onClick={() => { setTab(key); setPage(0) }}>
                {key === 'todos' ? 'Todos' : key === 'proceso' ? 'En Proceso' : 'Cruzado'}
                <span className="f-count">{key === 'todos' ? rows.length : key === 'proceso' ? enProceso : cruzados}</span>
              </button>
            ))}
          </div>
          <div className="tbl-actions">
            <div className="tbl-search">
              <Search size={11} />
              <input placeholder="Trafico, pedimento..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }} />
            </div>
            <button className="act-btn" onClick={() => exportCSV(filtered)}>
              <Download size={11} /> CSV
            </button>
          </div>
        </div>

        {/* Summary */}
        {!loading && rows.length > 0 && (
          <div className="sum-bar">
            <div className="sum-stat"><span className="sum-val">{rows.length.toLocaleString('es-MX')}</span><span className="sum-lbl">total</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: 'var(--status-yellow)' }}>{enProceso.toLocaleString('es-MX')}</span><span className="sum-lbl">En Proceso</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val" style={{ color: 'var(--status-green)' }}>{cruzados.toLocaleString('es-MX')}</span><span className="sum-lbl">Cruzado</span></div>
            <div className="sum-sep" />
            <div className="sum-stat"><span className="sum-val">{fmtCompact(totalValor)}</span><span className="sum-lbl">valor importado</span></div>
          </div>
        )}

        {/* Table */}
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th style={{ width: 180 }}>Trafico</th>
                <th style={{ width: 110 }}>Estado</th>
                <th style={{ width: 110 }}>Fecha</th>
                <th>Descripcion</th>
                <th style={{ width: 100, textAlign: 'right' }}>Peso</th>
                <th style={{ width: 100, textAlign: 'right' }}>Importe</th>
                <th style={{ width: 100 }}>Pedimento</th>
                <th style={{ width: 55, textAlign: 'center' }}>Pred.</th>
                <th style={{ width: 50, textAlign: 'center' }}>Risk</th>
                <th style={{ width: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`s-${i}`}>
                  <td><div className="skel" style={{ width: 7, height: 7, borderRadius: '50%' }} /></td>
                  <td><div className="skel" style={{ width: 96, height: 13 }} /><div className="skel" style={{ width: 60, height: 10, marginTop: 4 }} /></td>
                  <td><div className="skel" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 70, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 140, height: 13 }} /></td>
                  <td><div className="skel" style={{ width: 50, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ width: 50, height: 13, marginLeft: 'auto' }} /></td>
                  <td><div className="skel" style={{ width: 60, height: 13 }} /></td>
                  <td></td>
                </tr>
              ))}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--t2)' }}>No se encontraron resultados</td></tr>
              )}
              {paged.map(r => {
                const ps = calcPriority(r)
                return (
                  <tr key={r.trafico} onClick={() => setDetailId(r.trafico)}>
                    <td style={{ width: 24, paddingRight: 4 }}>
                      {ps > 0 && <span className={`priority ${priorityClass(ps)}`} />}
                    </td>
                    <td>
                      <div className="c-id">{fmtId(r.trafico)}</div>
                      {r.pedimento && <div className="c-sub">PED {r.pedimento}</div>}
                    </td>
                    <td><StatusDot status={r.estatus} /></td>
                    <td className="c-mono">{fmtDate(r.fecha_llegada)}</td>
                    <td className="c-desc" title={fmtDesc(r.descripcion_mercancia)}>{fmtDesc(r.descripcion_mercancia)}</td>
                    <td className="c-num">{fmtKg(r.peso_bruto)}</td>
                    <td className="c-num">{fmtUSD(r.importe_total)}</td>
                    <td>{r.pedimento ? <span className="ped">{r.pedimento}</span> : <span className="c-dim">-</span>}</td>
                    <td style={{ textAlign: 'center' }}>{(() => {
                      const pred = crossPred[r.trafico]
                      if (!pred) return <span className="c-dim">—</span>
                      const d = pred.avgDays
                      const color = d > 5 ? 'var(--red-text)' : d > 3 ? 'var(--amber-text)' : 'var(--green-text)'
                      return <span title={`Est. ${pred.predictedDate} · ${pred.confidence}`} className="mono" style={{ color, fontSize: 11, fontWeight: 600, cursor: 'help' }}>~{d}d</span>
                    })()}</td>
                    <td style={{ textAlign: 'center' }}>{(() => {
                      const risk = riskScores[r.trafico]
                      if (!risk) return <span className="c-dim">—</span>
                      const s = risk.score
                      const bg = s >= 50 ? 'var(--red-bg)' : s >= 20 ? 'var(--amber-bg)' : 'var(--green-bg)'
                      const color = s >= 50 ? 'var(--red-text)' : s >= 20 ? 'var(--amber-text)' : 'var(--green-text)'
                      return <span title={risk.factors.join('\n')} style={{ background: bg, color, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: 'help' }}>{s}</span>
                    })()}</td>
                    <td><span className="c-arr">&#8250;</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {detailId && <TraficoDetail traficoId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
