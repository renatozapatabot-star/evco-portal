'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getClientClaveCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc, fmtDate } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'
import { InsightWhisper } from '@/components/ui/InsightWhisper'
import { useWhisper } from '@/hooks/use-whisper'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'

interface EntradaRow {
  id: number
  cve_entrada: string
  trafico?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  num_talon?: string | null
  num_caja_trailer?: string | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

const fmtTrafico = (id: string) => {
  const clave = getClientClaveCookie()
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clave}-`) ? clean : `${clave}-${clean}`
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
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())
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
    const params = new URLSearchParams({
      table: 'entradas', limit: '5000',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      gte_field: 'fecha_llegada_mercancia', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(data => { const arr = data.data ?? data ?? []; setRows(arr); setCache('entradas', arr) })
      .catch(() => setFetchError('Error cargando entradas. Reintentar.'))
      .finally(() => setLoading(false))

    // Partida descriptions (pedimento merchandise)
    const partidaParams = new URLSearchParams({ table: 'globalpc_partidas', select: 'cve_trafico,descripcion', limit: '5000' })
    fetch(`/api/data?${partidaParams}`)
      .then(r => r.json()).then(d => {
        const map = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((p: { cve_trafico?: string; descripcion?: string }) => {
          if (p.cve_trafico && p.descripcion && !map.has(p.cve_trafico)) map.set(p.cve_trafico, p.descripcion)
        })
        setPartidaDescMap(map)
      }).catch(() => {})
  }, [])

  const filtered = (() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  })()

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) =>
    sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  const getDesc = (r: EntradaRow) => {
    if (r.trafico) {
      const partidaDesc = partidaDescMap.get(r.trafico)
      if (partidaDesc) return fmtDesc(partidaDesc)
    }
    if (r.descripcion_mercancia) return fmtDesc(r.descripcion_mercancia)
    return null
  }

  return (
    <div className="page-shell">
      <InsightWhisper text={useWhisper("entradas")} />

      {/* Title removed — sidebar indicates current page */}

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search">
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Entrada, tráfico, descripción..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
            />
          </div>
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{ padding: 16 }}>
            <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 44, borderRadius: 6 }} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && paged.length === 0 && (
          search.trim() ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
            </div>
          ) : (
            <EmptyState icon="🏭" title="No hay entradas registradas" description="Las entradas aparecerán aquí cuando se registren." />
          )
        )}

        {/* Mobile cards */}
        {!loading && paged.length > 0 && isMobile && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paged.map(r => (
              <div
                key={r.cve_entrada}
                onClick={() => router.push(r.trafico ? `/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}` : `/entradas/${r.cve_entrada}`)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px', cursor: 'pointer', minHeight: 60,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{r.cve_entrada}</span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {r.fecha_llegada_mercancia ? fmtDate(r.fecha_llegada_mercancia) : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getDesc(r) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente tráfico</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop table */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="cruz-table" role="table" aria-label="Lista de entradas" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 120 }} onClick={() => toggleSort('cve_entrada')}>Entrada<SortArrow col="cve_entrada" /></th>
                  <th style={{ width: 140 }}>Tráfico</th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha_llegada_mercancia')}>Fecha<SortArrow col="fecha_llegada_mercancia" /></th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 80 }} onClick={() => toggleSort('cantidad_bultos')}>Bultos<SortArrow col="cantidad_bultos" /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 100 }} onClick={() => toggleSort('peso_bruto')}>Peso (kg)<SortArrow col="peso_bruto" /></th>
                  <th style={{ width: 120 }}>Guía</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr
                    key={r.cve_entrada}
                    className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => router.push(r.trafico ? `/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}` : `/entradas/${r.cve_entrada}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.cve_entrada}
                      </span>
                    </td>
                    <td>
                      {r.trafico ? (
                        <Link
                          href={`/traficos/${encodeURIComponent(fmtTrafico(r.trafico))}`}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--gold-dark, #8B6914)', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {fmtTrafico(r.trafico)}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.fecha_llegada_mercancia ? <time dateTime={r.fecha_llegada_mercancia.split('T')[0]}>{fmtDate(r.fecha_llegada_mercancia)}</time> : '—'}
                    </td>
                    <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {getDesc(r) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente tráfico</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.cantidad_bultos ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.peso_bruto ? `${Number(r.peso_bruto).toLocaleString('es-MX')}` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {r.num_talon || r.num_caja_trailer || '—'}
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
          <span className="pagination-info">
            {(page * PAGE_SIZE + 1).toLocaleString()}-{Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} de {filtered.length.toLocaleString()}
          </span>
          <div className="pagination-btns">
            <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
            <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
