'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { getClientNameCookie, getClientClaveCookie, getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc, fmtDate } from '@/lib/format-utils'
import { fmtCarrier } from '@/lib/carrier-names'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'

interface EntradaRow {
  id: number
  cve_entrada: string
  cve_embarque?: number | null
  cve_cliente?: string | null
  cve_proveedor?: string | null
  trafico?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  peso_neto?: number | null
  tipo_operacion?: string | null
  tipo_carga?: string | null
  transportista_americano?: string | null
  transportista_mexicano?: string | null
  recibido_por?: string | null
  mercancia_danada?: boolean | null
  tiene_faltantes?: boolean | null
  recibio_facturas?: boolean | null
  recibio_packing_list?: boolean | null
  num_pedido?: string | null
  num_talon?: string | null
  num_caja_trailer?: string | null
  comentarios_faltantes?: string | null
  comentarios_danada?: string | null
  comentarios_generales?: string | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

const fmtTrafico = (id: string) => {
  const clave = getClientClaveCookie()
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clave}-`) ? clean : `${clave}-${clean}`
}

function exportCSV(rows: EntradaRow[], clave: string) {
  const h = ['Entrada', 'Trafico', 'Fecha', 'Descripcion', 'Bultos', 'Peso_kg', 'Transportista']
  const c = rows.map(r => [r.cve_entrada, r.trafico ?? '', r.fecha_llegada_mercancia ?? '', (r.descripcion_mercancia ?? '').replace(/,/g, ' '), r.cantidad_bultos ?? '', r.peso_bruto ?? '', r.transportista_mexicano ?? ''].join(','))
  const blob = new Blob([['CRUZ — Entradas', `Clave: ${clave}`, `Exportado: ${fmtDate(new Date())}`, '', h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Entradas_${clave}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [faltantesOnly, setFaltantesOnly] = useState(false)
  const [showHistorico, setShowHistorico] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'vinculado' | 'sin-trafico'>('all')
  const [groupByProv, setGroupByProv] = useState(false)
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
    const params = new URLSearchParams({ table: 'entradas', limit: '5000', order_by: 'fecha_llegada_mercancia', order_dir: 'desc' })
    if (!showHistorico) { params.set('gte_field', 'fecha_llegada_mercancia'); params.set('gte_value', '2024-01-01') }
    if (!isInternal && companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then((r) => r.json())
      .then((data) => { const arr = data.data ?? data ?? []; setRows(arr); setCache('entradas', arr) })
      .catch(() => setFetchError('Error cargando entradas. Reintentar →'))
      .finally(() => setLoading(false))
  }, [showHistorico])

  const filtered = (() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter((r) =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q)
      )
    }
    if (dateFrom) out = out.filter(r => (r.fecha_llegada_mercancia || '') >= dateFrom)
    if (dateTo) out = out.filter(r => (r.fecha_llegada_mercancia || '') <= dateTo)
    if (faltantesOnly) out = out.filter(r => r.tiene_faltantes)
    if (statusFilter === 'vinculado') out = out.filter(r => !!r.trafico)
    if (statusFilter === 'sin-trafico') out = out.filter(r => !r.trafico)
    // Group by proveedor if toggled
    if (groupByProv) {
      out = [...out].sort((a, b) => (a.cve_proveedor ?? '').localeCompare(b.cve_proveedor ?? ''))
    }
    // Apply sort (secondary when grouping)
    if (!groupByProv) out = [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return out
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 className="page-title">Entradas</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {rows.length.toLocaleString()} remesas &middot;
            {rows.filter((r: any) => r.tiene_faltantes).length > 0
              ? ` ${rows.filter((r: any) => r.tiene_faltantes).length} con faltantes`
              : ' Sin incidencias esta semana'
            }
          </p>
        </div>
        <div className="flex items-center gap-2.5" style={{ flexWrap: 'wrap' }}>
          <button onClick={() => exportCSV(filtered, getClientClaveCookie())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-[12px] font-medium"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <Download size={12} strokeWidth={2} /> CSV
          </button>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="rounded-[6px] px-2 py-1 text-[11px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--slate-500)', background: 'var(--slate-50)', height: 44, minHeight: 44 }} />
            <span style={{ color: 'var(--text-disabled)', fontSize: 11 }}>—</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="rounded-[6px] px-2 py-1 text-[11px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--slate-500)', background: 'var(--slate-50)', height: 44, minHeight: 44 }} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: 'var(--red-text)', border: '1px solid var(--red-border)', background: 'var(--red-bg)' }}>✕</button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: 'Semana', fn: () => { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]); setDateTo(''); setPage(0) } },
              { label: 'Mes', fn: () => { const d = new Date(); setDateFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setDateTo(''); setPage(0) } },
              { label: 'Año', fn: () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(''); setPage(0) } },
            ].map(p => (
              <button key={p.label} onClick={p.fn}
                className="text-[10px] font-medium px-2 py-0.5 rounded"
                style={{ border: '1px solid var(--border)', color: 'var(--slate-500)', background: 'var(--slate-50)', cursor: 'pointer' }}>{p.label}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: faltantesOnly ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={faltantesOnly} onChange={e => { setFaltantesOnly(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            Faltantes
          </label>
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: showHistorico ? 'var(--info)' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showHistorico} onChange={e => { setShowHistorico(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            Incluir anteriores a 2024
          </label>
          <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: groupByProv ? 'var(--info)' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={groupByProv} onChange={e => { setGroupByProv(e.target.checked); setPage(0) }} style={{ width: 13, height: 13 }} />
            Agrupar por proveedor
          </label>
          <div
            className="flex items-center gap-2 rounded-[3px] px-3 py-1.5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', width: isMobile ? '100%' : 220 }}
          >
            <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Tráfico, entrada, descripción..." aria-label="Buscar entradas"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="flex-1 bg-transparent outline-none text-[12.5px]"
              style={{ color: 'var(--slate-500)' }}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
        </div>
      )}

      {/* Status count chips */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {([
            { key: 'all' as const, label: 'Todas', count: rows.length },
            { key: 'vinculado' as const, label: 'Vinculadas', count: rows.filter(r => !!r.trafico).length },
            { key: 'sin-trafico' as const, label: 'Sin tráfico', count: rows.filter(r => !r.trafico).length },
          ]).map(s => (
            <button key={s.key} onClick={() => { setStatusFilter(s.key); setPage(0) }}
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 9999, cursor: 'pointer',
                border: `1px solid ${statusFilter === s.key ? 'var(--gold)' : 'var(--border-card)'}`,
                background: statusFilter === s.key ? 'rgba(196,150,60,0.08)' : 'transparent',
                color: statusFilter === s.key ? 'var(--gold-dark, #8B6914)' : 'var(--slate-500)',
              }}>
              {s.label} <span className="font-mono" style={{ marginLeft: 4 }}>({s.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {(search || dateFrom || dateTo || faltantesOnly || showHistorico) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {search && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: 'var(--slate-100)', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 4 }}>Búsqueda: {search} <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 12, lineHeight: 1 }}>✕</button></span>}
          {dateFrom && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: 'var(--slate-100)', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 4 }}>Desde: {dateFrom} <button onClick={() => setDateFrom('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 12, lineHeight: 1 }}>✕</button></span>}
          {dateTo && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: 'var(--slate-100)', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 4 }}>Hasta: {dateTo} <button onClick={() => setDateTo('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 12, lineHeight: 1 }}>✕</button></span>}
          {faltantesOnly && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: 'var(--warning-bg)', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: 4 }}>Faltantes <button onClick={() => setFaltantesOnly(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warning-text)', fontSize: 12, lineHeight: 1 }}>✕</button></span>}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-16 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && paged.length === 0 && (
        search.trim() ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
          </div>
        ) : (
          <EmptyState
            icon="🏭"
            title="No hay entradas registradas"
            description="Las entradas aparecerán aquí cuando se registren."
          />
        )
      )}

      {/* Mobile card layout */}
      {!loading && paged.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paged.map((r) => {
            const hasIncidencia = r.mercancia_danada || r.tiene_faltantes
            const statusColor = hasIncidencia ? 'var(--danger-500)' : '#16A34A'
            return (
              <div
                key={r.cve_entrada}
                onClick={() => router.push(`/entradas/${r.cve_entrada}`)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: 'var(--r-md, 8px)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  minHeight: 60,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.cve_entrada}</span>
                  {hasIncidencia ? (
                    <span className="badge badge-hold"><span className="badge-dot" />Incidencia</span>
                  ) : (
                    <span className="badge badge-cruzado"><span className="badge-dot" />OK</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha_llegada_mercancia)}</span>
                  {r.peso_bruto && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--slate-500)' }}>{Number(r.peso_bruto).toLocaleString('es-MX')} kg</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtDesc(r.descripcion_mercancia)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop table layout */}
      {!loading && paged.length > 0 && !isMobile && (
        <div
          className="rounded-[3px] overflow-hidden"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <table className="data-table" role="table" aria-label="Lista de entradas">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('cve_entrada')}>Entrada{sort.column === 'cve_entrada' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th>Tráfico</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('fecha_llegada_mercancia')}>Fecha Llegada{sort.column === 'fecha_llegada_mercancia' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('cantidad_bultos')}>Bultos{sort.column === 'cantidad_bultos' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('peso_bruto')}>Peso (kg){sort.column === 'peso_bruto' ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</th>
                  <th>Transportista</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={r.cve_entrada} className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => router.push(r.trafico ? `/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}` : `/entradas/${r.cve_entrada}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="mono text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {r.cve_entrada}
                      </span>
                    </td>
                    <td>
                      {r.trafico ? (
                        <Link href={`/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}`} className="mono text-[12.5px] font-semibold"
                          style={{ color: 'var(--info)', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}>
                          {fmtTrafico(r.trafico)}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No vinculado</span>
                      )}
                    </td>
                    <td className="text-[12px]" style={{ color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                      {r.fecha_llegada_mercancia ? <time dateTime={r.fecha_llegada_mercancia.split('T')[0]}>{fmtDate(r.fecha_llegada_mercancia)}</time> : '—'}
                    </td>
                    <td
                      className="text-[12px] max-w-[200px] truncate"
                      style={{ color: r.descripcion_mercancia ? 'var(--slate-500)' : 'var(--text-muted)' }}
                    >
                      {fmtDesc(r.descripcion_mercancia)}
                    </td>
                    <td className="text-right mono text-[12px]" style={{ color: 'var(--slate-500)' }}>
                      {r.cantidad_bultos ?? '-'}
                    </td>
                    <td className="text-right mono text-[12px]" style={{ color: 'var(--slate-500)' }}>
                      {r.peso_bruto ? `${Number(r.peso_bruto).toLocaleString('es-MX')} kg` : '-'}
                    </td>
                    <td className="text-[12px]" style={{ color: 'var(--slate-500)' }}>
                      {fmtCarrier(r.transportista_mexicano) || fmtCarrier(r.transportista_americano) || '—'}
                    </td>
                    <td>
                      {r.trafico ? (
                        <span className="badge badge-vinculado"><span className="badge-dot" />Vinculado</span>
                      ) : (() => {
                        const age = r.fecha_llegada_mercancia
                          ? Math.floor((Date.now() - new Date(r.fecha_llegada_mercancia).getTime()) / 86400000)
                          : 0
                        if (age > 90) return <span className="badge badge-urgente"><span className="badge-dot" />Urgente</span>
                        if (age > 30) return <span className="badge badge-hold"><span className="badge-dot" />Pendiente</span>
                        if (age > 7) return <span className="badge badge-proceso"><span className="badge-dot" />Nuevo</span>
                        return <span className="badge badge-sin-trafico"><span className="badge-dot" />Reciente</span>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page === 0 ? '#f7f8fa' : 'var(--card-bg)', border: '1px solid var(--border)', color: page === 0 ? '#d1d5db' : '#374151', cursor: page === 0 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={12} /> Anterior
            </button>
            <span className="mono text-[11px] px-2" style={{ color: 'var(--text-muted)' }}>{page + 1}/{totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11.5px] font-medium"
              style={{ background: page >= totalPages - 1 ? '#f7f8fa' : 'var(--card-bg)', border: '1px solid var(--border)', color: page >= totalPages - 1 ? '#d1d5db' : '#374151', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}
            >
              Siguiente <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
