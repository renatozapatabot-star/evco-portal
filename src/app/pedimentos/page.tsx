'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtUSDFull as fmtUSD, fmtDate, fmtPedimentoShort, fmtDesc, fmtId } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

interface TraficoRow {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  importe_total: number | null
  estatus: string | null
  regimen: string | null
  proveedores: string | null
  descripcion_mercancia: string | null
  company_id: string | null
  [key: string]: unknown
}

interface PedGroup {
  pedimento: string
  trafico: string
  fecha: string | null
  importe: number
  regimen: string
  tmec: boolean
  descripcion: string
}

const PAGE_SIZE = 50

export default function PedimentosPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { sort, toggleSort } = useSort('pedimentos', { column: 'fecha', direction: 'desc' })
  const [tmecFilter, setTmecFilter] = useState<string | null>(null)
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())
  const [aduanetValorMap, setAduanetValorMap] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    setLoading(true)
    const userRole = getCookieValue('user_role') ?? ''
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCompanyIdCookie()

    const params = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_pago', order_dir: 'desc',
      not_null: 'pedimento',
      gte_field: 'fecha_llegada', gte_value: '2024-01-01',
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    fetch(`/api/data?${params}`)
      .then(r => r.json())
      .then(data => setRows((data.data ?? data ?? []) as TraficoRow[]))
      .catch((err) => console.error('[pedimentos] traficos fetch:', err.message))
      .finally(() => setLoading(false))

    // Partida descriptions
    const partidaParams = new URLSearchParams({ table: 'globalpc_partidas', select: 'cve_trafico,descripcion', limit: '5000' })
    fetch(`/api/data?${partidaParams}`)
      .then(r => r.json()).then(d => {
        const map = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((p: { cve_trafico?: string; descripcion?: string }) => {
          if (p.cve_trafico && p.descripcion && !map.has(p.cve_trafico)) map.set(p.cve_trafico, p.descripcion)
        })
        setPartidaDescMap(map)
      }).catch((err) => console.error('[pedimentos] partidas fetch:', err.message))

    // Aduanet facturas for valor fallback
    const aduanetParams = new URLSearchParams({ table: 'aduanet_facturas', select: 'pedimento,valor_usd', limit: '5000' })
    if (!isInternal && companyId) aduanetParams.set('company_id', companyId)
    fetch(`/api/data?${aduanetParams}`)
      .then(r => r.json()).then(d => {
        const map = new Map<string, number>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((f: { pedimento?: string; valor_usd?: number }) => {
          if (f.pedimento && f.valor_usd && !map.has(f.pedimento)) map.set(f.pedimento, f.valor_usd)
        })
        setAduanetValorMap(map)
      }).catch((err) => console.error('[pedimentos] aduanet fetch:', err.message))
  }, [])

  const groups: PedGroup[] = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    let filtered = rows.filter(r => {
      const fecha = r.fecha_pago || r.fecha_llegada
      if (fecha && fecha > today) return false
      return true
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.trafico ?? '').toLowerCase().includes(q) ||
        (r.proveedores ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q))
    }

    const map = new Map<string, TraficoRow[]>()
    filtered.forEach(r => {
      const key = r.pedimento!
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })

    const result = Array.from(map.entries()).map(([pedimento, pedRows]) => {
      const first = pedRows[0]
      const reg = (first.regimen ?? '').toUpperCase()
      const tmec = reg === 'ITE' || reg === 'ITR' || reg === 'IMD'
      return {
        pedimento,
        trafico: first.trafico,
        fecha: first.fecha_pago || first.fecha_llegada,
        importe: Number(first.importe_total) || aduanetValorMap.get(pedimento) || 0,
        regimen: first.regimen ?? '',
        tmec,
        descripcion: first.descripcion_mercancia ?? '',
      }
    })

    // Apply T-MEC filter
    const tmecFiltered = tmecFilter === 'tmec' ? result.filter(g => g.tmec)
      : tmecFilter === 'sin_tmec' ? result.filter(g => !g.tmec)
      : result

    tmecFiltered.sort((a, b) => {
      const col = sort.column as keyof PedGroup
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })

    return tmecFiltered
  }, [rows, search, sort, aduanetValorMap, tmecFilter])

  const totalPages = Math.ceil(groups.length / PAGE_SIZE)
  const paged = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const SortArrow = ({ col }: { col: string }) =>
    sort.column === col ? <span style={{ marginLeft: 4, fontSize: 10 }}>{sort.direction === 'asc' ? '↑' : '↓'}</span> : null

  const getDesc = (g: PedGroup) => {
    const partidaDesc = partidaDescMap.get(g.trafico)
    if (partidaDesc) return fmtDesc(partidaDesc)
    if (g.descripcion) return fmtDesc(g.descripcion)
    return null
  }

  // T-MEC stats (recomputed from raw rows for accurate counts regardless of tmecFilter)
  const allGroups = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const filtered = rows.filter(r => {
      const fecha = r.fecha_pago || r.fecha_llegada
      if (fecha && fecha > today) return false
      return true
    }).filter(r => r.pedimento)
    const map = new Map<string, TraficoRow[]>()
    filtered.forEach(r => { const k = r.pedimento!; if (!map.has(k)) map.set(k, []); map.get(k)!.push(r) })
    return Array.from(map.entries()).map(([, pedRows]) => {
      const reg = (pedRows[0].regimen ?? '').toUpperCase()
      return { tmec: reg === 'ITE' || reg === 'ITR' || reg === 'IMD' }
    })
  }, [rows])
  const kpiTodos = allGroups.length
  const kpiTmec = allGroups.filter(g => g.tmec).length
  const kpiSinTmec = allGroups.filter(g => !g.tmec).length

  return (
    <div className="page-shell">
      {/* T-MEC Filter Bar */}
      {!loading && kpiTodos > 0 && (
        <div className="stat-filter-bar" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { key: null, label: 'Todos', value: kpiTodos },
            { key: 'tmec', label: 'T-MEC', value: kpiTmec },
            { key: 'sin_tmec', label: 'Sin T-MEC', value: kpiSinTmec },
          ].map(stat => (
            <button
              key={stat.key ?? 'all'}
              className={`stat-filter-item${tmecFilter === stat.key ? ' active' : ''}`}
              onClick={() => { setTmecFilter(tmecFilter === stat.key ? null : stat.key); setPage(0) }}
            >
              <span className={`stat-filter-value${stat.value === 0 ? ' zero' : ''}`}>{stat.value}</span>
              <span className="stat-filter-label">{stat.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="table-shell" style={!loading && kpiTodos > 0 ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : undefined}>
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Pedimento, tráfico, proveedor..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              aria-label="Buscar pedimentos"
            />
          </div>
        </div>

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
            <EmptyState icon="📋" title="Sin pedimentos registrados" description="Los pedimentos aparecerán aquí cuando se asignen a los tráficos." />
          )
        )}

        {/* Mobile cards */}
        {!loading && paged.length > 0 && isMobile && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paged.map(g => (
              <Link
                key={g.pedimento}
                href={`/traficos/${encodeURIComponent(g.trafico)}`}
                style={{
                  textDecoration: 'none', color: 'inherit',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${g.tmec ? 'var(--success)' : 'var(--gold, #C9A84C)'}`,
                  borderRadius: 10, padding: '14px 16px', display: 'block', minHeight: 60,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{fmtPedimentoShort(g.pedimento)}</span>
                  {g.tmec && <span className="badge-tmec">T-MEC</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{g.fecha ? fmtDate(g.fecha) : ''}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {g.importe > 0 ? fmtUSD(g.importe) : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getDesc(g) || '—'}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Desktop table */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="cruz-table" role="table" aria-label="Lista de pedimentos" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 160 }} onClick={() => toggleSort('pedimento')}>Pedimento<SortArrow col="pedimento" /></th>
                  <th style={{ width: 140, cursor: 'pointer' }} onClick={() => toggleSort('trafico')}>Tráfico<SortArrow col="trafico" /></th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha')}>Fecha<SortArrow col="fecha" /></th>
                  <th>Mercancía</th>
                  <th style={{ width: 100, cursor: 'pointer' }} onClick={() => toggleSort('regimen')}>Régimen<SortArrow col="regimen" /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 130 }} onClick={() => toggleSort('importe')}>Valor USD<SortArrow col="importe" /></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((g, i) => (
                  <tr
                    key={g.pedimento}
                    className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => window.location.href = `/traficos/${encodeURIComponent(g.trafico)}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {fmtPedimentoShort(g.pedimento)}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/traficos/${encodeURIComponent(g.trafico)}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--gold-dark, #8B6914)', textDecoration: 'none' }}
                      >
                        {fmtId(g.trafico)}
                      </Link>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {g.fecha ? fmtDate(g.fecha) : '—'}
                    </td>
                    <td className="desc-text" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {getDesc(g) || '—'}
                    </td>
                    <td style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {g.regimen || '—'}
                      {g.tmec && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>T-MEC</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {g.importe > 0 ? `${fmtUSD(g.importe)}` : '—'}
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
            <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></button>
            <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Página siguiente"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
