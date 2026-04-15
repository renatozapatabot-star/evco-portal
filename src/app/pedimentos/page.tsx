'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtUSDFull as fmtUSD, fmtDate, fmtPedimentoShort, fmtDesc, fmtId } from '@/lib/format-utils'
import { useSort, type SortState } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { MonthSelector } from '@/components/admin/MonthSelector'
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

function SortArrow({ col, sort }: { col: string; sort: SortState }) {
  if (sort.column !== col) return null
  return <span style={{ marginLeft: 4, fontSize: 'var(--aguila-fs-label)' }}>{sort.direction === 'asc' ? '↑' : '↓'}</span>
}

export default function PedimentosPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ padding: 20 }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
      <PedimentosContent />
    </Suspense>
  )
}

function PedimentosContent() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')
  const monthWindow = useMemo(() => parseMonthParam(monthParam), [monthParam])
  const monthOptions = useMemo(() => recentMonths(24), [])
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { sort, toggleSort } = useSort('pedimentos', { column: 'fecha', direction: 'desc' })
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
      gte_field: 'fecha_llegada', gte_value: monthWindow.monthStart,
      lte_field: 'fecha_llegada', lte_value: monthWindow.monthEnd,
    })
    if (!isInternal && companyId) params.set('company_id', companyId)

    // Retrofit B6a: prefer new `pedimentos` table; traficos query is fallback
    // for rows not yet migrated. Merge by pedimento_number (new table wins).
    const pedimentoParams = new URLSearchParams({
      table: 'pedimentos', limit: '5000',
      order_by: 'created_at', order_dir: 'desc',
    })
    if (!isInternal && companyId) pedimentoParams.set('company_id', companyId)

    Promise.all([
      fetch(`/api/data?${params}`).then(r => r.json()).catch((err: Error) => {
        console.error('[pedimentos] traficos fetch:', err.message)
        return { data: [] }
      }),
      fetch(`/api/data?${pedimentoParams}`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([traficoRes, pedimentoRes]) => {
        const traficoRows = (traficoRes.data ?? traficoRes ?? []) as TraficoRow[]
        const pedimentoRows = (pedimentoRes.data ?? []) as Array<{
          pedimento_number: string | null
          trafico_id: string
          company_id: string
          status: string | null
          created_at: string
        }>
        const existingNumbers = new Set(traficoRows.map(r => r.pedimento).filter(Boolean))
        const overlayRows: TraficoRow[] = pedimentoRows
          .filter(p => p.pedimento_number && !existingNumbers.has(p.pedimento_number))
          .map(p => ({
            trafico: p.trafico_id,
            pedimento: p.pedimento_number,
            fecha_pago: null,
            fecha_llegada: p.created_at,
            importe_total: null,
            estatus: p.status ?? null,
            regimen: null,
            proveedores: null,
            descripcion_mercancia: null,
            company_id: p.company_id,
          }))
        setRows([...traficoRows, ...overlayRows])
      })
      .finally(() => setLoading(false))

    // Partida descriptions — scope by company to avoid cross-client description bleed.
    // For client role, /api/data auto-injects the signed session company_id. For
    // broker/admin, we pass the currently-viewed company_id explicitly (or skip
    // the fetch entirely when broker is aggregating across all clients).
    const partidaParams = new URLSearchParams({ table: 'globalpc_partidas', select: 'cve_trafico,descripcion', limit: '5000' })
    if (!isInternal && companyId) partidaParams.set('company_id', companyId)
    else if (isInternal && companyId) partidaParams.set('company_id', companyId)
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
  }, [monthWindow.monthStart, monthWindow.monthEnd])

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

    result.sort((a, b) => {
      const col = sort.column as keyof PedGroup
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })

    return result
  }, [rows, search, sort, aduanetValorMap])

  const totalPages = Math.ceil(groups.length / PAGE_SIZE)
  const paged = groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const getDesc = (g: PedGroup) => {
    const partidaDesc = partidaDescMap.get(g.trafico)
    if (partidaDesc) return fmtDesc(partidaDesc)
    if (g.descripcion) return fmtDesc(g.descripcion)
    return null
  }

  return (
    <div className="page-shell">

      <div style={{ marginBottom: 16 }}>
        <MonthSelector
          ym={monthWindow.ym}
          label={monthWindow.label}
          prev={monthWindow.prev}
          next={monthWindow.next}
          options={monthOptions}
        />
      </div>

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Pedimento, embarque, proveedor..."
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
              <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setPage(0) }}>Limpiar búsqueda</button>
            </div>
          ) : (
            <EmptyState icon="📋" title="Sin pedimentos registrados" description="Los pedimentos aparecerán aquí cuando se asignen a los embarques." />
          )
        )}

        {/* Mobile cards */}
        {!loading && paged.length > 0 && isMobile && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paged.map(g => (
              <button
                key={g.pedimento}
                type="button"
                onClick={() => window.open(`/api/pedimento-pdf?trafico=${encodeURIComponent(g.trafico)}`, '_blank')}
                style={{
                  textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  textDecoration: 'none', color: 'inherit',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${g.tmec ? 'var(--success)' : 'var(--gold, #E8EAED)'}`,
                  borderRadius: 10, padding: '14px 16px', display: 'block', minHeight: 60,
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{fmtPedimentoShort(g.pedimento)}</span>
                  {g.tmec && <span className="badge-tmec">T-MEC</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{g.fecha ? fmtDate(g.fecha) : ''}</span>
                  <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                    {g.importe > 0 ? fmtUSD(g.importe) : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getDesc(g) || '—'}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Desktop table */}
        {!loading && paged.length > 0 && !isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="aguila-table" role="table" aria-label="Lista de pedimentos" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: 160 }} onClick={() => toggleSort('pedimento')}>Pedimento<SortArrow col="pedimento" sort={sort} /></th>
                  <th style={{ width: 140, cursor: 'pointer' }} onClick={() => toggleSort('trafico')}>Embarque<SortArrow col="trafico" sort={sort} /></th>
                  <th style={{ cursor: 'pointer', width: 110 }} onClick={() => toggleSort('fecha')}>Fecha<SortArrow col="fecha" sort={sort} /></th>
                  <th>Mercancía</th>
                  <th style={{ width: 100, cursor: 'pointer' }} onClick={() => toggleSort('regimen')}>Régimen<SortArrow col="regimen" sort={sort} /></th>
                  <th style={{ textAlign: 'right', cursor: 'pointer', width: 130 }} onClick={() => toggleSort('importe')}>Valor USD<SortArrow col="importe" sort={sort} /></th>
                  <th style={{ width: 50, textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((g, i) => (
                  <tr
                    key={g.pedimento}
                    className={`clickable-row ${i % 2 === 0 ? 'row-even' : 'row-odd'}`}
                    onClick={() => window.open(`/api/pedimento-pdf?trafico=${encodeURIComponent(g.trafico)}`, '_blank')}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {fmtPedimentoShort(g.pedimento)}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/embarques/${encodeURIComponent(g.trafico)}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--gold-dark, #7A7E86)', textDecoration: 'none' }}
                      >
                        {fmtId(g.trafico)}
                      </Link>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
                      {g.fecha ? fmtDate(g.fecha) : '—'}
                    </td>
                    <td className="desc-text" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
                      {(() => {
                        const d = getDesc(g)
                        if (!d) return '—'
                        return (
                          <Link
                            href={`/catalogo?q=${encodeURIComponent(d)}`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none', borderBottom: '1px dashed rgba(192,197,206,0.25)' }}
                            title="Ver en catálogo / fracción"
                          >
                            {d}
                          </Link>
                        )
                      })()}
                    </td>
                    <td style={{ fontSize: 'var(--aguila-fs-body)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {g.regimen || '—'}
                      {g.tmec && <span style={{ marginLeft: 6, fontSize: 'var(--aguila-fs-meta)', color: 'var(--success)', fontWeight: 600 }}>T-MEC</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {g.importe > 0 ? `${fmtUSD(g.importe)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/api/pedimento-pdf?trafico=${encodeURIComponent(g.trafico)}`, '_blank')
                        }}
                        title="Descargar PDF"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 4, borderRadius: 4, display: 'inline-flex',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Download size={14} />
                      </button>
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
