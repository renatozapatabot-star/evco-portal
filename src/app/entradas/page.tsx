'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDesc } from '@/lib/format-utils'
import { useSort } from '@/hooks/use-sort'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import { fmtCarrier } from '@/lib/carrier-names'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSessionCache } from '@/hooks/use-session-cache'
import { useSupplierNames } from '@/hooks/use-supplier-names'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { MonthSelector } from '@/components/admin/MonthSelector'
import { useFreshness } from '@/hooks/use-freshness'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SyncChip } from '@/components/ui/sync-chip'
import { formatDateDMY, formatNumber } from '@/lib/format'
import { linkForPedimento } from '@/lib/links/entity-links'

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
  transportista_mexicano?: string | null
  transportista_americano?: string | null
  cve_proveedor?: string | null
  [key: string]: unknown
}

const PAGE_SIZE = 50

export default function EntradasPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ padding: 20 }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
      <EntradasContent />
    </Suspense>
  )
}

function EntradasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')
  const monthWindow = useMemo(() => parseMonthParam(monthParam), [monthParam])
  const monthOptions = useMemo(() => recentMonths(24), [])
  const [rows, setRows] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { sort } = useSort('entradas', { column: 'fecha_llegada_mercancia', direction: 'desc' })
  const [page, setPage] = useState(0)
  const [transportMap, setTransportMap] = useState<Map<string, string>>(new Map())
  const [partidaDescMap, setPartidaDescMap] = useState<Map<string, string>>(new Map())
  const { getCached, setCache } = useSessionCache()
  const freshness = useFreshness()
  const supplierNames = useSupplierNames()

  useEffect(() => {
    const userRole = getCookieValue('user_role') ?? ''
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCompanyIdCookie()
    if (!isInternal && !companyId) { setLoading(false); return }
    setLoading(true)
    setFetchError(null)
    const cacheKey = `entradas:${monthWindow.ym}`
    const cached = getCached<EntradaRow[]>(cacheKey)
    if (cached) setRows(cached)
    const params = new URLSearchParams({
      table: 'entradas', limit: '5000',
      order_by: 'fecha_llegada_mercancia', order_dir: 'desc',
      gte_field: 'fecha_llegada_mercancia', gte_value: monthWindow.monthStart,
      lte_field: 'fecha_llegada_mercancia', lte_value: monthWindow.monthEnd,
    })
    if (!isInternal && companyId) params.set('company_id', companyId)
    fetch(`/api/data?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(data => { const arr = data.data ?? data ?? []; setRows(arr); setCache(cacheKey, arr) })
      .catch(err => {
        if (err.message === 'session_expired') { window.location.href = '/login'; return }
        setFetchError('Error cargando entradas. Reintentar.')
      })
      .finally(() => setLoading(false))

    const tParams = new URLSearchParams({ table: 'traficos', limit: '5000' })
    if (!isInternal && companyId) tParams.set('company_id', companyId)
    fetch(`/api/data?${tParams}`)
      .then(r => r.json()).then(d => {
        const transMap = new Map<string, string>()
        const arr = Array.isArray(d.data) ? d.data : []
        arr.forEach((t: { trafico?: string; transportista_mexicano?: string; transportista_extranjero?: string; transportista_americano?: string }) => {
          if (t.trafico && !transMap.has(t.trafico)) {
            transMap.set(t.trafico, t.transportista_extranjero || t.transportista_americano || t.transportista_mexicano || '')
          }
        })
        setTransportMap(transMap)
      }).catch(() => {})

    fetch('/api/data?table=traficos&select=trafico&limit=5000')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d.data) ? d.data : []
        const ids = arr
          .map((t: { trafico?: string }) => t.trafico)
          .filter((t: string | undefined): t is string => !!t)
          .slice(0, 500)
        if (ids.length === 0) return
        return fetch(`/api/embarques/partes-description?traficos=${encodeURIComponent(ids.join(','))}`)
      })
      .then(r => r && r.ok ? r.json() : null)
      .then(body => {
        if (!body?.data) return
        const next = new Map<string, string>()
        for (const [trafico, payload] of Object.entries(body.data as Record<string, { descriptions: string[]; count: number }>)) {
          if (payload.descriptions.length > 0) {
            next.set(trafico, payload.descriptions.join(' · '))
          }
        }
        setPartidaDescMap(next)
      })
      .catch(() => {})
  }, [monthWindow.monthStart, monthWindow.monthEnd, getCached, setCache])

  const getTransporte = (r: EntradaRow): string => {
    if (r.trafico) {
      const fromTrafico = fmtCarrier(transportMap.get(r.trafico) || '')
      if (fromTrafico) return fromTrafico
    }
    return fmtCarrier(r.transportista_americano || r.transportista_mexicano || '')
  }

  const getProveedor = (r: EntradaRow): string => {
    const code = r.cve_proveedor ?? ''
    if (!code) return ''
    const resolved = supplierNames.resolve(code)
    return resolved === '—' ? '' : resolved
  }

  const getDesc = (r: EntradaRow): string =>
    r.descripcion_mercancia || (r.trafico ? partidaDescMap.get(r.trafico) ?? '' : '')

  const getGuia = (r: EntradaRow): string => r.num_talon || r.num_caja_trailer || ''

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        (r.trafico ?? '').toLowerCase().includes(q) ||
        getDesc(r).toLowerCase().includes(q) ||
        (r.cve_entrada ?? '').toLowerCase().includes(q) ||
        supplierNames.resolve(r.cve_proveedor ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof EntradaRow
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sort.direction === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sort, supplierNames.resolve, partidaDescMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const columns: DataTableColumn<EntradaRow>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      width: 110,
      mono: true,
      render: (r) => formatDateDMY(r.fecha_llegada_mercancia) || (
        <span className="text-[var(--text-muted)]">—</span>
      ),
    },
    {
      key: 'entrada',
      header: 'Entrada',
      width: 120,
      mono: true,
      render: (r) => (
        <span className="font-semibold text-[var(--text-primary)]">{r.cve_entrada}</span>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      width: 180,
      render: (r) => {
        const v = getProveedor(r)
        return v ? (
          <span className="block truncate max-w-[180px]" title={v}>{v}</span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
    {
      key: 'mercancia',
      header: 'Mercancía',
      render: (r) => {
        const desc = fmtDesc(getDesc(r))
        return desc ? (
          <span className="block truncate max-w-[360px]" title={desc}>{desc}</span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
    {
      key: 'trafico',
      header: 'Tráfico',
      width: 130,
      mono: true,
      render: (r) => r.trafico ? (
        <Link
          href={linkForPedimento(r.trafico) ?? '#'}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-[var(--accent-silver-bright,#E8EAED)] hover:underline underline-offset-2"
        >
          {r.trafico}
        </Link>
      ) : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'transporte',
      header: 'Transporte',
      width: 130,
      render: (r) => {
        const v = getTransporte(r)
        return v ? (
          <span className="block truncate text-[12px]" title={v}>{v}</span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
    {
      key: 'bultos',
      header: 'Bultos',
      width: 80,
      numeric: true,
      render: (r) => formatNumber(r.cantidad_bultos) || (
        <span className="text-[var(--text-muted)]">—</span>
      ),
    },
    {
      key: 'peso',
      header: 'Peso (kg)',
      width: 100,
      numeric: true,
      render: (r) => r.peso_bruto != null
        ? formatNumber(r.peso_bruto, { decimals: 2 })
        : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'guia',
      header: 'Guía',
      width: 130,
      render: (r) => {
        const g = getGuia(r)
        return g ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)]">
            {g}
          </span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
  ]

  return (
    <div className="page-shell">
      {/* Header — single row: title + SyncChip + MonthSelector */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)] m-0">
            Entradas
          </h1>
          <SyncChip lastSyncIso={freshness?.lastSyncedAt ?? null} />
        </div>
        <MonthSelector
          ym={monthWindow.ym}
          label={monthWindow.label}
          prev={monthWindow.prev}
          next={monthWindow.next}
          options={monthOptions}
        />
      </div>

      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="flex justify-end">
          <div
            className="flex items-center gap-2 px-3 rounded-[10px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)]"
            style={{ minHeight: 60, minWidth: 280 }}
          >
            <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
            <input
              placeholder="Entrada, tráfico, proveedor, descripción…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              aria-label="Buscar entradas"
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              style={{ minHeight: 60 }}
            />
          </div>
        </div>

        {fetchError && <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />}

        {!loading && paged.length === 0 ? (
          search.trim() ? (
            <div className="text-center py-10 px-5 border border-dashed border-[var(--border)] rounded-[10px] bg-[var(--bg-card)]">
              <div className="text-[14px] font-semibold text-[var(--text-secondary)]">
                Sin resultados para &ldquo;{search}&rdquo;
              </div>
              <button
                onClick={() => { setSearch(''); setPage(0) }}
                className="mt-3 inline-flex items-center justify-center px-4 rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[rgba(192,197,206,0.10)] transition-colors duration-[120ms]"
                style={{ minHeight: 60 }}
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <CalmEmptyState
              icon="package"
              title="Sin entradas en este período"
              message="Las recepciones de almacén aparecerán aquí."
            />
          )
        ) : (
          <DataTable
            columns={columns}
            data={paged}
            rowKey={(r) => r.cve_entrada}
            ariaLabel="Lista de entradas"
            mobileMinWidth={1000}
            onRowClick={(r) => {
              const href = linkForPedimento(r.trafico)
              if (href) router.push(href)
            }}
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-3 mt-2">
            <span className="text-[12px] text-[var(--text-muted)] font-mono">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                aria-label="Página anterior"
                className="inline-flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text-primary)] hover:bg-[rgba(192,197,206,0.10)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[120ms]"
                style={{ minWidth: 60, minHeight: 60 }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                aria-label="Página siguiente"
                className="inline-flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text-primary)] hover:bg-[rgba(192,197,206,0.10)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[120ms]"
                style={{ minWidth: 60, minHeight: 60 }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
