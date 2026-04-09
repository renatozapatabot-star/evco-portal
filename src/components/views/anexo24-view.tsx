'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSD, fmtPedimentoShort } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { DateInputES } from '@/components/ui/DateInputES'
import { useIsMobile } from '@/hooks/use-mobile'

interface PartidaRow {
  cve_trafico: string
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  descripcion?: string | null
  cantidad?: number | null
  precio_unitario?: number | null
  [k: string]: unknown
}

interface TraficoContext {
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  proveedores: string | null
  regimen: string | null
  pais_procedencia: string | null
  importe_total: number | null
}

interface EnrichedRow {
  rowNum: number
  pedimento: string
  fecha: string | null
  fraccion: string
  descripcion: string
  cantidad: number
  valorUSD: number
  proveedor: string
  origen: string
  regimen: string
  tmec: boolean
}

const PAGE_SIZE = 50

function isT(regimen: string | null): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}

function exportCSV(rows: EnrichedRow[], clave: string) {
  const h = ['#', 'Pedimento', 'Fecha', 'Fracción', 'Descripción', 'Cantidad', 'Valor_USD', 'Proveedor', 'Origen', 'T-MEC']
  const c = rows.map(r => [
    r.rowNum, r.pedimento, r.fecha ?? '',
    r.fraccion, (r.descripcion).replace(/,/g, ' '),
    r.cantidad, r.valorUSD,
    (r.proveedor).replace(/,/g, ';'), r.origen,
    r.tmec ? 'SI' : 'NO',
  ].join(','))
  const blob = new Blob([['CRUZ — Reporte Anexo 24', `Clave: ${clave}`, `Exportado: ${fmtDate(new Date())}`, '', h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Anexo24_${clave}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

export function Anexo24View() {
  const isMobile = useIsMobile()
  const [partidas, setPartidas] = useState<PartidaRow[]>([])
  const [traficoMap, setTraficoMap] = useState<Map<string, TraficoContext>>(new Map())
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tmecFilter, setTmecFilter] = useState<'all' | 'si' | 'no'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? getClientClaveCookie())
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }

    const companyFilter = !isInternal && companyId ? `&company_id=${companyId}` : ''

    // Fetch all three in parallel
    const safeFetch = (u: string) => fetch(u).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
      return r.json()
    })
    Promise.all([
      safeFetch(`/api/data?table=globalpc_partidas&limit=10000${companyFilter}`),
      safeFetch(`/api/data?table=traficos&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01${companyFilter}`),
      safeFetch(`/api/data?table=globalpc_proveedores&limit=5000${companyFilter}`),
    ])
      .then(([partidaData, traficoData, provData]) => {
        setPartidas(Array.isArray(partidaData.data) ? partidaData.data : [])

        // Build trafico context map
        const tMap = new Map<string, TraficoContext>()
        const traficos = Array.isArray(traficoData.data) ? traficoData.data : []
        traficos.forEach((t: Record<string, unknown>) => {
          if (t.trafico) {
            tMap.set(t.trafico as string, {
              pedimento: (t.pedimento as string) || null,
              fecha_pago: (t.fecha_pago as string) || null,
              fecha_llegada: (t.fecha_llegada as string) || null,
              proveedores: (t.proveedores as string) || null,
              regimen: (t.regimen as string) || null,
              pais_procedencia: (t.pais_procedencia as string) || null,
              importe_total: t.importe_total != null ? Number(t.importe_total) : null,
            })
          }
        })
        setTraficoMap(tMap)

        // Supplier lookup
        const sMap = new Map<string, string>()
        const provs = Array.isArray(provData.data) ? provData.data : []
        provs.forEach((p: { cve_proveedor?: string; nombre?: string }) => {
          if (p.cve_proveedor && p.nombre) sMap.set(p.cve_proveedor, p.nombre)
        })
        setSupplierLookup(sMap)
      })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
      })
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  const resolveProvs = (raw: string | null) => {
    if (!raw) return '—'
    return raw.split(',').map(s => s.trim()).filter(Boolean)
      .map(code => supplierLookup.get(code) || code).join(', ')
  }

  // Build enriched rows: partida + tráfico context
  const enriched: EnrichedRow[] = useMemo(() => {
    const rows: EnrichedRow[] = []
    let num = 0
    // Sort partidas by tráfico (groups by pedimento)
    const sorted = [...partidas].sort((a, b) => (a.cve_trafico || '').localeCompare(b.cve_trafico || ''))

    for (const p of sorted) {
      const ctx = traficoMap.get(p.cve_trafico)
      // Include partidas even without pedimento — show as 'Pendiente'
      num++
      rows.push({
        rowNum: num,
        pedimento: ctx?.pedimento || 'Pendiente',
        fecha: ctx?.fecha_pago || ctx?.fecha_llegada || null,
        fraccion: p.fraccion_arancelaria || p.fraccion || '—',
        descripcion: p.descripcion || '—',
        cantidad: Number(p.cantidad) || 0,
        valorUSD: Number(p.precio_unitario) || 0,
        proveedor: resolveProvs(ctx?.proveedores || null),
        origen: ctx?.pais_procedencia || '—',
        regimen: ctx?.regimen || '',
        tmec: isT(ctx?.regimen || null),
      })
    }
    return rows
  }, [partidas, traficoMap, supplierLookup])

  const filtered = useMemo(() => {
    let out = enriched
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.pedimento.toLowerCase().includes(q) ||
        r.fraccion.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q)
      )
    }
    if (tmecFilter === 'si') out = out.filter(r => r.tmec)
    if (tmecFilter === 'no') out = out.filter(r => !r.tmec)
    if (dateFrom) out = out.filter(r => (r.fecha || '') >= dateFrom)
    if (dateTo) out = out.filter(r => (r.fecha || '') <= dateTo)
    return out
  }, [enriched, search, tmecFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const tmecCount = useMemo(() => enriched.filter(r => r.tmec).length, [enriched])

  return (
    <div className="page-shell">
      <div className="section-header">
        <div>
          <h1 className="page-title">Anexo 24</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>
            {filtered.length.toLocaleString('es-MX')} partidas
            {tmecCount > 0 && <> · <span style={{ color: 'var(--success)', fontWeight: 600 }}>{tmecCount} T-MEC</span></>}
          </p>
        </div>
        <button onClick={() => exportCSV(filtered, clientClave)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid var(--border-card)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--slate-600)' }}>
          <Download size={13} /> CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 8, padding: '0 12px', height: 36, flex: isMobile ? '1 1 100%' : '0 1 320px' }}>
          <Search size={13} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
          <input placeholder="Pedimento, fracción, proveedor..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)' }} />
        </div>
        {(['all', 'si', 'no'] as const).map(v => (
          <button key={v} onClick={() => { setTmecFilter(v); setPage(0) }}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${tmecFilter === v ? 'var(--success)' : 'var(--border-card)'}`,
              background: tmecFilter === v ? '#F0FDF4' : 'transparent',
              color: tmecFilter === v ? 'var(--success)' : 'var(--slate-500)',
            }}>
            {v === 'all' ? 'Todos' : v === 'si' ? 'T-MEC' : 'Sin T-MEC'}
          </button>
        ))}
        <DateInputES value={dateFrom} onChange={v => { setDateFrom(v); setPage(0) }} />
        <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>—</span>
        <DateInputES value={dateTo} onChange={v => { setDateTo(v); setPage(0) }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
            style={{ fontSize: 13, color: 'var(--danger)', border: '1px solid #FCA5A5', background: 'var(--danger-bg)', borderRadius: 6, padding: '0 12px', minWidth: 40, minHeight: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        )}
      </div>

      {/* Table */}
      <div className="table-shell">
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-shimmer" style={{ height: 40 }} />)}
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: 32 }}>
            <EmptyState icon="📄" title="Sin partidas" description="Las partidas del Anexo 24 aparecerán aquí" />
          </div>
        ) : isMobile ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paged.map((r) => (
                <div key={`${r.pedimento}-${r.rowNum}`} style={{
                  background: 'var(--bg-main)', border: '1px solid var(--border-card)',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                      {fmtPedimentoShort(r.pedimento)}
                    </span>
                    {r.tmec ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 9999 }}>T-MEC</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.descripcion}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-dark, #8B6914)', fontWeight: 600 }}>
                      {r.fraccion}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>
                      {r.valorUSD > 0 ? fmtUSD(r.valorUSD) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha)}</span>
                    <span>{r.origen}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cruz-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>#</th>
                  <th>Pedimento</th>
                  <th>Fecha</th>
                  <th>Fracción</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Valor USD</th>
                  <th>Proveedor</th>
                  <th>Origen</th>
                  <th>T-MEC</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={`${r.pedimento}-${r.rowNum}`} className={`${i % 2 === 0 ? 'row-even' : 'row-odd'}`}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {r.rowNum}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtPedimentoShort(r.pedimento)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtDate(r.fecha)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold-dark, #8B6914)', fontWeight: 600 }}>
                      {r.fraccion}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.descripcion}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {r.cantidad > 0 ? r.cantidad.toLocaleString('es-MX') : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>
                      {r.valorUSD > 0 ? fmtUSD(r.valorUSD) : '—'}
                    </td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {r.proveedor}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.origen}</td>
                    <td>
                      {r.tmec ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: 9999 }}>T-MEC</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                      )}
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
            <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
            <button className="pagination-btn current">{page + 1}</button>
            <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
