'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { Search, Download, ChevronLeft, ChevronRight, Truck } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc, fmtUSDCompact, fmtDate, fmtDateShort, fmtPedimentoShort } from '@/lib/format-utils'
import { formatPedimento } from '@/lib/format/pedimento'
import { useSort, type SortState } from '@/hooks/use-sort'
import { useIsMobile } from '@/hooks/use-mobile'
import { ErrorBoundary } from '@/components/error-boundary'
import { useSessionCache } from '@/hooks/use-session-cache'
import { EmptyState } from '@/components/ui/EmptyState'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSupplierNames } from '@/hooks/use-supplier-names'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { MonthSelector } from '@/components/admin/MonthSelector'
import { FreshnessBanner } from '@/components/aguila'
import { useFreshness } from '@/hooks/use-freshness'

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  descripcion_mercancia?: string | null
  peso_bruto?: number | null
  importe_total?: number | null
  pedimento?: string | null
  proveedores?: string | null
  facturas?: string | null
  embarque?: number | null
  transportista_mexicano?: string | null
  [key: string]: unknown
}

/** Generate date-based guía from fecha_llegada: MMDDYY */
function computeGuia(fechaLlegada: string | null | undefined): string {
  if (!fechaLlegada) return ''
  const d = new Date(fechaLlegada)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}${dd}${yy}`
}

interface FacturaLookup {
  proveedor: string
  num_factura: string
  valor_usd: number
  descripcion: string
}

const PAGE_SIZE = 50

/** Binary status: Cruzado or Pendiente.
 *  GlobalPC uses 'Cruzado'; SAT uses 'E1'; manual entries sometimes
 *  say 'Entregado'. All three are post-cross terminal states in CRUZ's
 *  scope. Without this alignment the list would show E1/Entregado rows
 *  as "Pendiente" while their detail page shows "Cruzado". */
const CRUZADO_ESTATUS = new Set(['Cruzado', 'E1', 'Entregado'])
function getStatus(estatus: string | undefined): 'Cruzado' | 'Pendiente' {
  if (!estatus) return 'Pendiente'
  if (CRUZADO_ESTATUS.has(estatus)) return 'Cruzado'
  // Defensive: historical data sometimes has casing variants.
  return estatus.toLowerCase().includes('cruz') ? 'Cruzado' : 'Pendiente'
}

function exportCSV(
  rows: TraficoRow[],
  clientClave: string,
  companyId: string,
  facMap: Map<string, FacturaLookup>,
  entMap: Map<string, string>,
) {
  const meta = [
    'PORTAL — Renato Zapata & Company',
    `Clave: ${clientClave}`,
    `Exportado: ${fmtDate(new Date())}`,
    `Total registros: ${rows.length}`,
    '',
  ]
  const h = ['Clave_Trafico', 'Entrada', 'Proveedor', 'Invoice', 'Descripcion', 'Valor_USD', 'Pedimento', 'Status']
  const c = rows.map(r => {
    const fac = facMap.get(r.trafico)
    return [
      r.trafico,
      entMap.get(r.trafico) ?? '',
      (fac?.proveedor || r.proveedores || '').replace(/,/g, ';'),
      (fac?.num_factura || r.facturas || '').replace(/,/g, ';'),
      (r.descripcion_mercancia ?? fac?.descripcion ?? '').replace(/,/g, ' '),
      fac?.valor_usd || r.importe_total || '',
      r.pedimento ?? '',
      getStatus(r.estatus),
    ].join(',')
  })
  const b = new Blob([[...meta, h.join(','), ...c].join('\n')], { type: 'text/csv' })
  const fname = `${(companyId || 'export').toUpperCase()}_Traficos_${new Date().toISOString().split('T')[0]}.csv`
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click()
}

function SortArrow({ col, sort }: { col: string; sort: SortState }) {
  if (sort.column !== col) return null
  return <span style={{ marginLeft: 4, fontSize: 'var(--aguila-fs-label)' }}>{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
}

export default function TraficosPage() {
  return (
    <ErrorBoundary fallbackTitle="Error al cargar embarques">
      <Suspense fallback={<div className="page-container" style={{ padding: '20px 24px' }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
        <TraficosContent />
      </Suspense>
    </ErrorBoundary>
  )
}

function TraficosContent() {
  const { resolve: resolveSupplier } = useSupplierNames()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const sortParam = searchParams.get('sort')
  const orderParam = searchParams.get('order')
  const monthParam = searchParams.get('month')
  const monthWindow = useMemo(() => parseMonthParam(monthParam), [monthParam])
  const monthOptions = useMemo(() => recentMonths(24), [])
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)
  const { sort, toggleSort } = useSort('traficos', { column: 'fecha_llegada', direction: 'desc' })
  const router = useRouter()
  const isMobile = useIsMobile()
  const { getCached, setCache } = useSessionCache()
  const freshness = useFreshness(true, ['globalpc_delta', 'globalpc_full', 'aduanet_scrape'])

  // Lookup maps from aduanet_facturas, entradas, globalpc_partidas, globalpc_facturas, globalpc_proveedores
  const [facturasMap, setFacturasMap] = useState<Map<string, FacturaLookup>>(new Map())
  const [entradaMap, setEntradaMap] = useState<Map<string, string>>(new Map())
  // partidaDescMap removed — see comment near former query at line ~221
  const [gpcFacturasMap, setGpcFacturasMap] = useState<Map<string, { cve_proveedor: string; numero: string; valor_comercial: number }>>(new Map())
  const [proveedorMap, setProveedorMap] = useState<Map<string, string>>(new Map())
  // Partes-based descriptions: trafico → joined product descriptions from
  // partidas → productos. Populated after the main row fetch lands.
  const [partesDescMap, setPartesDescMap] = useState<Map<string, string>>(new Map())

  const [companyId, setCompanyId] = useState('')
  const [clientClave, setClientClave] = useState('')
  const [userRole, setUserRole] = useState('')
  const [cookiesReady, setCookiesReady] = useState(false)

  useEffect(() => {
    setCompanyId(getCookieValue('company_id') ?? '')
    setClientClave(getCookieValue('company_clave') ?? '')
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)
    setFetchError(null)

    const cacheKey = `traficos:${monthWindow.ym}`
    const cached = getCached<TraficoRow[]>(cacheKey)
    if (cached) setRows(cached)

    const traficosParams = new URLSearchParams({
      table: 'traficos', limit: '5000',
      order_by: 'fecha_llegada', order_dir: 'desc',
      gte_field: 'fecha_llegada', gte_value: monthWindow.monthStart,
      lte_field: 'fecha_llegada', lte_value: monthWindow.monthEnd,
    })
    if (!isInternal) traficosParams.set('company_id', companyId)

    fetch(`/api/data?${traficosParams}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(d => {
        const arr = Array.isArray(d.data ?? d) ? (d.data ?? d) : []
        setRows(arr)
        setCache(cacheKey, arr)

        // Enrich with partes-derived descriptions — one batched call
        // to the new endpoint. Descripcion_mercancia on traficos is
        // usually a generic summary; the partes chain gives the actual
        // merchandise the client recognizes. Falls back silently if
        // the endpoint errors.
        const traficoIds = arr
          .map((r: { trafico?: string }) => r.trafico)
          .filter((t: string | undefined): t is string => typeof t === 'string' && t.length > 0)
          .slice(0, 500)
        if (traficoIds.length > 0) {
          fetch(`/api/embarques/partes-description?traficos=${encodeURIComponent(traficoIds.join(','))}`)
            .then(r => r.ok ? r.json() : null)
            .then(body => {
              if (!body?.data) return
              const next = new Map<string, string>()
              for (const [trafico, payload] of Object.entries(body.data as Record<string, { descriptions: string[]; count: number }>)) {
                if (payload.descriptions.length > 0) {
                  next.set(trafico, payload.descriptions.join(' · '))
                }
              }
              setPartesDescMap(next)
            })
            .catch(() => { /* silent — description falls back to descripcion_mercancia */ })
        }
      })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setFetchError('Error cargando tráficos. Reintentar.')
      })
      .finally(() => setLoading(false))

    // Fetch aduanet_facturas for proveedor, invoice#, valor
    const facParams = new URLSearchParams({ table: 'aduanet_facturas', limit: '5000' })
    if (!isInternal && clientClave) facParams.set('clave_cliente', clientClave)
    fetch(`/api/data?${facParams}`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const map = new Map<string, FacturaLookup>()
        // Group by referencia (= trafico ID), aggregate
        for (const f of arr as { referencia?: string; proveedor?: string; num_factura?: string; valor_usd?: number; descripcion?: string }[]) {
          if (!f.referencia) continue
          const existing = map.get(f.referencia)
          if (existing) {
            existing.valor_usd += Number(f.valor_usd) || 0
            if (!existing.proveedor && f.proveedor) existing.proveedor = f.proveedor
            if (!existing.num_factura && f.num_factura) existing.num_factura = f.num_factura
            if (!existing.descripcion && f.descripcion) existing.descripcion = f.descripcion
          } else {
            map.set(f.referencia, {
              proveedor: f.proveedor || '',
              num_factura: f.num_factura || '',
              valor_usd: Number(f.valor_usd) || 0,
              descripcion: f.descripcion || '',
            })
          }
        }
        setFacturasMap(map)
      })
      .catch(() => {})

    // Fetch entradas for cve_entrada → trafico mapping
    const entParams = new URLSearchParams({ table: 'entradas', limit: '5000' })
    if (!isInternal && companyId) entParams.set('company_id', companyId)
    fetch(`/api/data?${entParams}`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const map = new Map<string, string>()
        for (const e of arr as { trafico?: string; cve_entrada?: string }[]) {
          if (e.trafico && e.cve_entrada && !map.has(e.trafico)) {
            map.set(e.trafico, e.cve_entrada)
          }
        }
        setEntradaMap(map)
      })
      .catch(() => {})

    // Description fallback chain via partidas was removed: globalpc_partidas has
    // (folio, cve_producto), not (cve_trafico, descripcion). The previous query
    // returned silently empty rows. To restore a partidas → product description
    // join requires 3-table chain (facturas→partidas→productos) — deferred.

    // GlobalPC facturas — fallback for proveedor, invoice, valor when aduanet_facturas has no match
    fetch('/api/data?table=globalpc_facturas&limit=10000')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const map = new Map<string, { cve_proveedor: string; numero: string; valor_comercial: number }>()
        for (const f of arr as { cve_trafico?: string; cve_proveedor?: string; numero?: string; valor_comercial?: number }[]) {
          if (!f.cve_trafico) continue
          const existing = map.get(f.cve_trafico)
          if (existing) {
            existing.valor_comercial += Number(f.valor_comercial) || 0
            if (!existing.cve_proveedor && f.cve_proveedor) existing.cve_proveedor = f.cve_proveedor
            if (!existing.numero && f.numero) existing.numero = f.numero
          } else {
            map.set(f.cve_trafico, {
              cve_proveedor: f.cve_proveedor || '',
              numero: f.numero || '',
              valor_comercial: Number(f.valor_comercial) || 0,
            })
          }
        }
        setGpcFacturasMap(map)
      })
      .catch(() => {})

    // GlobalPC proveedores — supplier code → name resolution
    fetch('/api/data?table=globalpc_proveedores&limit=5000')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const map = new Map<string, string>()
        for (const p of arr as { cve_proveedor?: string; nombre?: string }[]) {
          if (p.cve_proveedor && p.nombre) map.set(p.cve_proveedor, p.nombre)
        }
        setProveedorMap(map)
      })
      .catch(() => {})
  }, [cookiesReady, companyId, clientClave, userRole, monthWindow.monthStart, monthWindow.monthEnd])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Helpers to get enriched data (fallback chain: aduanet → traficos → globalpc)
  const getProveedor = (r: TraficoRow): string => {
    const fac = facturasMap.get(r.trafico)
    const raw = fac?.proveedor || r.proveedores || ''
    if (raw) {
      const first = raw.split(',')[0]?.trim() || ''
      return resolveSupplier(first)
    }
    // Fallback: globalpc_facturas → globalpc_proveedores
    const gpc = gpcFacturasMap.get(r.trafico)
    if (gpc?.cve_proveedor) return proveedorMap.get(gpc.cve_proveedor) || gpc.cve_proveedor
    return ''
  }

  const getInvoice = (r: TraficoRow): string => {
    const fac = facturasMap.get(r.trafico)
    if (fac?.num_factura) return fac.num_factura
    if (r.facturas) return r.facturas
    // Fallback: globalpc_facturas
    const gpc = gpcFacturasMap.get(r.trafico)
    return gpc?.numero || ''
  }

  const getValor = (r: TraficoRow): number => {
    const fac = facturasMap.get(r.trafico)
    if (fac?.valor_usd && fac.valor_usd > 0) return fac.valor_usd
    if (r.importe_total && Number(r.importe_total) > 0) return Number(r.importe_total)
    // Fallback: globalpc_facturas
    const gpc = gpcFacturasMap.get(r.trafico)
    return gpc?.valor_comercial || 0
  }

  const getDesc = (r: TraficoRow): string => {
    // Partes-first: the joined product descriptions from partidas →
    // productos are what the client recognizes. Falls back to
    // trafico.descripcion_mercancia (usually generic) and finally
    // factura.descripcion if both are empty.
    const partes = partesDescMap.get(r.trafico)
    if (partes) return partes
    if (r.descripcion_mercancia) return r.descripcion_mercancia
    const fac = facturasMap.get(r.trafico)
    return fac?.descripcion || ''
  }

  const getEntrada = (r: TraficoRow): string => entradaMap.get(r.trafico) || ''

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        fmtId(r.trafico).toLowerCase().includes(q) ||
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        getDesc(r).toLowerCase().includes(q) ||
        getProveedor(r).toLowerCase().includes(q) ||
        getInvoice(r).toLowerCase().includes(q) ||
        getEntrada(r).toLowerCase().includes(q)
      )
    }
    const activeSort = sortParam ? { column: sortParam, direction: (orderParam ?? 'desc') as 'asc' | 'desc' } : sort
    return [...out].sort((a, b) => {
      const aVal = a[activeSort.column as keyof TraficoRow]
      const bVal = b[activeSort.column as keyof TraficoRow]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return activeSort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort, sortParam, orderParam, facturasMap, entradaMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="page-shell">
      {/* Header — glass theme */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(192,197,206,0.08)',
          border: '1px solid rgba(192,197,206,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Truck size={20} color="var(--portal-fg-3)" strokeWidth={1.8} />
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 800, color: 'var(--portal-fg-1)',
          letterSpacing: '-0.02em', margin: 0,
        }}>
          Embarques
        </h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <MonthSelector
          ym={monthWindow.ym}
          label={monthWindow.label}
          prev={monthWindow.prev}
          next={monthWindow.next}
          options={monthOptions}
        />
      </div>

      {freshness && <div style={{ marginBottom: 12 }}><FreshnessBanner reading={freshness} /></div>}

      {fetchError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />
        </div>
      )}

      <div className="table-shell">
        <div className="table-toolbar" style={{ justifyContent: 'flex-end' }}>
          <div className="toolbar-search" style={{ minHeight: 60 }}>
            <Search size={12} style={{ color: 'var(--slate-400)', flexShrink: 0 }} />
            <input
              placeholder="Tráfico, pedimento, proveedor, factura..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Buscar embarques"
            />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(filtered, clientClave, companyId, facturasMap, entradaMap)}>
            <Download size={12} /> CSV
          </button>
        </div>

        {/* Mobile Cards */}
        {isMobile && !loading && paged.length > 0 && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paged.map(r => {
              const status = getStatus(r.estatus)
              const prov = getProveedor(r)
              const valor = getValor(r)
              return (
                <div
                  key={r.trafico}
                  onClick={() => router.push(`/embarques/${encodeURIComponent(r.trafico)}`)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{fmtId(r.trafico)}</span>
                    <span className={`badge ${status === 'Cruzado' ? 'badge-cruzado' : 'badge-proceso'}`} style={{ fontSize: 'var(--aguila-fs-meta)' }}>
                      <span className="badge-dot" aria-hidden="true" />
                      {status}
                    </span>
                  </div>
                  {prov && prov !== '—' && (
                    <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prov}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                    {fmtDesc(getDesc(r)) || '—'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'var(--aguila-fs-meta)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {valor > 0 && <span>{fmtUSDCompact(valor)}</span>}
                    {r.pedimento ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`/api/pedimento-pdf?trafico=${encodeURIComponent(r.trafico)}`, '_blank')
                        }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
                      >
                        {formatPedimento(r.pedimento, r.pedimento ?? '—', { dd: r.fecha_llegada?.slice(2,4) ?? '26', ad: '24', pppp: '3596' })}
                      </button>
                    ) : <span>Ped. pendiente</span>}
                    {r.fecha_llegada ? <span>{fmtDateShort(r.fecha_llegada)}</span> : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isMobile && !loading && paged.length === 0 && (
          <div style={{ padding: 16 }}>
            {search.trim() ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--text-secondary)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar búsqueda</button>
              </div>
            ) : (
              <CalmEmptyState
                icon="package"
                title="Tu operación está en calma"
                message="No hay embarques activos en este período."
              />
            )}
          </div>
        )}

        {/* Desktop table */}
        {!isMobile && (
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table className="aguila-table" aria-label="Lista de embarques" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 150, cursor: 'pointer' }} onClick={() => toggleSort('trafico')}>Clave de Tráfico<SortArrow col="trafico" sort={sort} /></th>
                  <th scope="col" style={{ minWidth: 220 }}>Mercancía</th>
                  <th scope="col" style={{ width: 140 }}>Pedimento</th>
                  <th scope="col" style={{ width: 110 }}>Fecha Cruce</th>
                  <th scope="col" style={{ width: 80 }}>Guía</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`s-${i}`}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j}><div className="skeleton-shimmer" style={{ width: j === 1 ? 200 : 80, height: 13 }} /></td>
                    ))}
                  </tr>
                ))}
                {!loading && paged.length === 0 && (
                  <tr><td colSpan={5}>
                    {search.trim() ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--slate-600)' }}>Sin resultados para &ldquo;{search}&rdquo;</div>
                        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearchInput(''); setSearch('') }}>Limpiar filtros</button>
                      </div>
                    ) : (
                      <CalmEmptyState
                        icon="package"
                        title="Tu operación está en calma"
                        message="No hay embarques activos en este período."
                      />
                    )}
                  </td></tr>
                )}
                {paged.map((r, idx) => {
                  return (
                    <tr
                      key={r.trafico}
                      className={`clickable-row ${idx % 2 === 0 ? 'row-even' : 'row-odd'}`}
                      onClick={() => router.push(`/embarques/${encodeURIComponent(r.trafico)}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="trafico-id">{fmtId(r.trafico)}</span>
                      </td>
                      <td className="desc-text" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
                        {(() => {
                          const d = fmtDesc(getDesc(r))
                          if (!d) return <span style={{ color: 'var(--text-muted)' }}>—</span>
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
                      <td>
                        {r.pedimento ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`/api/pedimento-pdf?trafico=${encodeURIComponent(r.trafico)}`, '_blank')
                            }}
                            title="Abrir PDF del pedimento"
                            className="pedimento-num"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}
                          >
                            {formatPedimento(r.pedimento, r.pedimento ?? '—', { dd: r.fecha_llegada?.slice(2,4) ?? '26', ad: '24', pppp: '3596' })}
                          </button>
                        ) : (
                          <span className="pedimento-pending">Pendiente</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary)' }}>
                        {r.fecha_cruce ? fmtDate(r.fecha_cruce) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary)' }}>
                        {computeGuia(r.fecha_llegada) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Página {page + 1} de {totalPages}</span>
            <div className="pagination-btns">
              <button className="pagination-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></button>
              <button className="pagination-btn current">{page + 1}</button>
              <button className="pagination-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Página siguiente"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
