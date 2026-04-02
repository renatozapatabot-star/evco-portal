'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtDate, fmtUSD, fmtPedimentoShort, fmtKg } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useIsMobile } from '@/hooks/use-mobile'

interface TraficoRow {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  proveedores: string | null
  descripcion_mercancia: string | null
  fraccion_arancelaria: string | null
  importe_total: number | null
  peso_bruto: number | null
  regimen: string | null
  pais_procedencia: string | null
  tipo_cambio: number | null
  company_id: string | null
  [k: string]: unknown
}

const PAGE_SIZE = 50

function exportCSV(rows: TraficoRow[], clave: string) {
  const h = ['Pedimento', 'Fecha', 'Proveedor', 'Fraccion', 'Descripcion', 'T-MEC', 'Valor_USD', 'Peso_kg', 'Origen', 'Regimen']
  const c = rows.map(r => [
    r.pedimento ?? '', r.fecha_pago ?? r.fecha_llegada ?? '',
    (r.proveedores ?? '').replace(/,/g, ';'), r.fraccion_arancelaria ?? '',
    (r.descripcion_mercancia ?? '').replace(/,/g, ' '),
    isT(r.regimen) ? 'SI' : 'NO',
    r.importe_total ?? '', r.peso_bruto ?? '', r.pais_procedencia ?? '', r.regimen ?? '',
  ].join(','))
  const blob = new Blob([['CRUZ — Reporte Anexo 24', `Clave: ${clave}`, `Exportado: ${fmtDate(new Date())}`, '', h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Anexo24_${clave}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

function isT(regimen: string | null): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}

export function Anexo24View() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tmecFilter, setTmecFilter] = useState<'all' | 'si' | 'no'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [supplierLookup, setSupplierLookup] = useState<Map<string, string>>(new Map())

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

    const params = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_pago', order_dir: 'desc',
      not_null: 'pedimento',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    fetch('/api/data?table=globalpc_proveedores&limit=5000')
      .then(r => r.json())
      .then(d => {
        const provs = (d.data ?? []) as { cve_proveedor?: string; nombre?: string }[]
        const lookup = new Map<string, string>()
        provs.forEach(p => { if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre) })
        setSupplierLookup(lookup)
      })
      .catch(() => {})

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d.data) ? d.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [cookiesReady, companyId, userRole])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.proveedores ?? '').toLowerCase().includes(q) ||
        (r.fraccion_arancelaria ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q)
      )
    }
    if (tmecFilter === 'si') out = out.filter(r => isT(r.regimen))
    if (tmecFilter === 'no') out = out.filter(r => !isT(r.regimen))
    if (dateFrom) out = out.filter(r => (r.fecha_pago || r.fecha_llegada || '') >= dateFrom)
    if (dateTo) out = out.filter(r => (r.fecha_pago || r.fecha_llegada || '') <= dateTo)
    return out
  }, [rows, search, tmecFilter, dateFrom, dateTo])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const resolveProvs = (raw: string | null) => {
    if (!raw) return '—'
    return raw.split(',').map(s => s.trim()).filter(Boolean)
      .map(code => supplierLookup.get(code) || code).join(', ')
  }

  const tmecCount = useMemo(() => rows.filter(r => isT(r.regimen)).length, [rows])

  return (
    <div className="page-shell">
      <div className="section-header">
        <div>
          <h1 className="page-title">Anexo 24</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 4 }}>
            {filtered.length.toLocaleString('es-MX')} registros
            {tmecCount > 0 && <> · <span style={{ color: '#16A34A', fontWeight: 600 }}>{tmecCount} T-MEC</span></>}
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
          <input placeholder="Pedimento, proveedor, fracción..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)' }} />
        </div>
        {(['all', 'si', 'no'] as const).map(v => (
          <button key={v} onClick={() => { setTmecFilter(v); setPage(0) }}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${tmecFilter === v ? '#16A34A' : 'var(--border-card)'}`,
              background: tmecFilter === v ? '#F0FDF4' : 'transparent',
              color: tmecFilter === v ? '#16A34A' : 'var(--slate-500)',
            }}>
            {v === 'all' ? 'Todos' : v === 'si' ? 'T-MEC' : 'Sin T-MEC'}
          </button>
        ))}
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
          style={{ height: 32, border: '1px solid var(--border-card)', borderRadius: 6, padding: '0 8px', fontSize: 11, color: 'var(--slate-500)', background: 'var(--slate-50)' }} />
        <span style={{ color: 'var(--slate-400)', fontSize: 11 }}>—</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
          style={{ height: 32, border: '1px solid var(--border-card)', borderRadius: 6, padding: '0 8px', fontSize: 11, color: 'var(--slate-500)', background: 'var(--slate-50)' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
            style={{ fontSize: 10, color: '#DC2626', border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
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
            <EmptyState icon="📄" title="Sin registros" description="Los pedimentos con datos Anexo 24 aparecerán aquí" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cruz-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Pedimento</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Fracción</th>
                  <th>Descripción</th>
                  <th>T-MEC</th>
                  <th style={{ textAlign: 'right' }}>Valor USD</th>
                  <th style={{ textAlign: 'right' }}>Peso (kg)</th>
                  <th>Origen</th>
                  <th>Régimen</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={`${r.pedimento}-${i}`} className={`${i % 2 === 0 ? 'row-even' : 'row-odd'}`}>
                    <td className="font-mono" style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtPedimentoShort(r.pedimento)}
                    </td>
                    <td className="timestamp">{fmtDate(r.fecha_pago || r.fecha_llegada)}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                      title={resolveProvs(r.proveedores)}>
                      {resolveProvs(r.proveedores)}
                    </td>
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--gold-dark, #8B6914)' }}>
                      {r.fraccion_arancelaria || '—'}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--slate-600)' }}>
                      {r.descripcion_mercancia || '—'}
                    </td>
                    <td>
                      {isT(r.regimen) ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 9999 }}>SI</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>NO</span>
                      )}
                    </td>
                    <td className="currency text-right">{r.importe_total ? `${fmtUSD(r.importe_total)} USD` : '—'}</td>
                    <td className="font-mono text-right" style={{ fontSize: 12 }}>{fmtKg(r.peso_bruto) || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--slate-500)' }}>{r.pais_procedencia || '—'}</td>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.regimen || '—'}</td>
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
          <span className="pagination-info">{(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}</span>
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
