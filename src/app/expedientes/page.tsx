'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtId, fmtDesc } from '@/lib/format-utils'
import { formatPedimento } from '@/lib/format/pedimento'
import { useSort } from '@/hooks/use-sort'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import type { DocFile } from '@/components/expedientes/DocChecklist'
import { lookupDocsForTrafico } from '@/lib/expedientes/lookup-docs'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { MonthSelector } from '@/components/admin/MonthSelector'
import { useFreshness } from '@/hooks/use-freshness'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SyncChip } from '@/components/ui/sync-chip'
import { formatDateDMY, formatNumber } from '@/lib/format'

const REQUIRED_DOCS = [
  'factura_comercial', 'packing_list', 'pedimento_detallado',
  'cove', 'acuse_cove', 'doda',
] as const

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  fecha_cruce: string | null
  pedimento: string | null
  importe_total: number | null
  descripcion_mercancia: string | null
  proveedores: string | null
  docs: DocFile[]
  docCount: number
  pct: number
  missing: string[]
  entrada: string | null
}

const PAGE_SIZE = 50

export default function ExpedientesPage() {
  return (
    <Suspense fallback={<div className="page-shell" style={{ padding: 20 }}><div className="skel" style={{ width: 200, height: 24 }} /></div>}>
      <ExpedientesContent />
    </Suspense>
  )
}

function ExpedientesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')
  const monthWindow = useMemo(() => parseMonthParam(monthParam), [monthParam])
  const monthOptions = useMemo(() => recentMonths(24), [])
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(0)
  const freshness = useFreshness(true, ['wsdl_anexo24_pull', 'globalpc_delta'])
  const { sort } = useSort('expedientes', { column: 'fecha_llegada', direction: 'desc' })

  const [cookiesReady, setCookiesReady] = useState(false)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    setUserRole(getCookieValue('user_role') ?? '')
    setCookiesReady(true)
  }, [])

  useEffect(() => {
    if (!cookiesReady) return
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const companyId = getCookieValue('company_id') ?? ''
    if (!isInternal && !companyId) { setLoading(false); return }
    const cf = !isInternal && companyId ? `&company_id=${companyId}` : ''

    setFetchError(null)
    const safeFetch = (url: string) => fetch(url).then(r => {
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
      return r.json()
    })

    const monthQ = `&gte_field=fecha_llegada&gte_value=${encodeURIComponent(monthWindow.monthStart)}&lte_field=fecha_llegada&lte_value=${encodeURIComponent(monthWindow.monthEnd)}`
    Promise.all([
      safeFetch(`/api/data?table=traficos&limit=5000&order_by=fecha_llegada&order_dir=desc${cf}${monthQ}`),
      safeFetch(`/api/data?table=expediente_documentos&limit=5000${cf}`),
      safeFetch(`/api/data?table=entradas&limit=5000${cf}`),
      safeFetch(`/api/data?table=globalpc_partidas&limit=10000${cf}`).catch(() => ({ data: [] })),
    ]).then(([traficoData, docData, entradaData, partidaData]) => {
      const traficos = (traficoData.data ?? []) as Array<Record<string, unknown>>
      const allDocs = (docData.data ?? []) as Array<Record<string, unknown>>
      const entradas = (entradaData.data ?? []) as Array<Record<string, unknown>>

      const docMap = new Map<string, DocFile[]>()
      allDocs.forEach(d => {
        const key = String(d.pedimento_id ?? '')
        if (!key) return
        if (!docMap.has(key)) docMap.set(key, [])
        docMap.get(key)!.push({
          id: String(d.id ?? ''),
          doc_type: d.doc_type as string | null,
          file_name: d.file_name as string | null,
          file_url: d.file_url as string | null,
          uploaded_at: d.uploaded_at as string | null,
        })
      })

      const partidaDescMap = new Map<string, string>()
      const allPartidas = (partidaData.data ?? []) as Array<Record<string, unknown>>
      allPartidas.forEach(p => {
        const key = String(p.cve_trafico ?? '')
        if (key && p.descripcion && !partidaDescMap.has(key)) {
          partidaDescMap.set(key, String(p.descripcion))
        }
      })

      const entradaMap = new Map<string, string>()
      entradas.forEach(e => {
        const t = String(e.trafico ?? '')
        if (t) entradaMap.set(t, String(e.cve_entrada ?? ''))
      })

      const enriched: TraficoRow[] = traficos.map(t => {
        const trafico = String(t.trafico ?? '')
        // Why dual-key lookup: expediente_documentos.pedimento_id is
        // populated as either the trafico slug ('9254-Y4568') or the
        // numeric pedimento ('6500313') depending on which sync path
        // wrote the row. Looking up only by trafico slug missed the
        // numeric-shape rows and rendered "0/6 docs" even though the
        // docs existed. lookupDocsForTrafico unions both keys and
        // dedupes by id. See ~/Desktop/data-integrity-investigation-2026-05-06.md A4.
        const docs = lookupDocsForTrafico(docMap, {
          trafico,
          pedimento: t.pedimento as string | null,
        })
        const presentTypes = new Set(docs.map(d => d.doc_type).filter(Boolean))
        const docCount = REQUIRED_DOCS.filter(r => presentTypes.has(r)).length
        const missing = REQUIRED_DOCS.filter(r => !presentTypes.has(r))
        const pct = Math.round((docCount / REQUIRED_DOCS.length) * 100)

        return {
          trafico,
          estatus: String(t.estatus ?? 'En Proceso'),
          fecha_llegada: t.fecha_llegada as string | null,
          fecha_cruce: t.fecha_cruce as string | null,
          pedimento: t.pedimento as string | null,
          importe_total: t.importe_total as number | null,
          descripcion_mercancia: (t.descripcion_mercancia as string | null) || partidaDescMap.get(trafico) || null,
          proveedores: t.proveedores as string | null,
          docs,
          docCount,
          pct,
          missing,
          entrada: entradaMap.get(trafico) ?? null,
        }
      })

      setRows(enriched)
    }).catch(err => {
      if (err.message === 'session_expired') { window.location.href = '/login'; return }
      setFetchError('Error cargando expedientes. Reintentar →')
    }).finally(() => setLoading(false))
  }, [cookiesReady, userRole, monthWindow.monthStart, monthWindow.monthEnd])

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = useMemo(() => {
    let out = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        fmtId(r.trafico).toLowerCase().includes(q) ||
        (r.pedimento ?? '').toLowerCase().includes(q) ||
        (r.descripcion_mercancia ?? '').toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      const col = sort.column as keyof TraficoRow
      const aVal = a[col]
      const bVal = b[col]
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, search, sort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const withPedimento = useMemo(() => rows.filter(r => r.pedimento), [rows])
  const completeCount = useMemo(() => withPedimento.filter(r => r.pct === 100).length, [withPedimento])

  const REQUIRED_TOTAL = REQUIRED_DOCS.length

  const columns: DataTableColumn<TraficoRow>[] = [
    {
      key: 'embarque',
      header: 'Embarque',
      width: 140,
      mono: true,
      render: (r) => (
        <span className="font-semibold text-[var(--text-primary)]">{fmtId(r.trafico)}</span>
      ),
    },
    {
      key: 'pedimento',
      header: 'Pedimento',
      width: 130,
      mono: true,
      render: (r) => r.pedimento ? (
        <span className="text-[var(--text-secondary)]">
          {formatPedimento(r.pedimento, r.pedimento, { dd: r.fecha_llegada?.slice(2, 4) ?? '26', ad: '24', pppp: '3596' })}
        </span>
      ) : (
        <span className="text-[var(--text-muted)] italic">Sin pedimento</span>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      width: 110,
      mono: true,
      render: (r) => formatDateDMY(r.fecha_llegada) || (
        <span className="text-[var(--text-muted)]">—</span>
      ),
    },
    {
      key: 'documentos',
      header: 'Documentos',
      width: 130,
      mono: true,
      render: (r) => (
        <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
          {formatNumber(r.docCount)} / {formatNumber(REQUIRED_TOTAL)}
        </span>
      ),
    },
    {
      key: 'mercancia',
      header: 'Mercancía',
      render: (r) => {
        const d = fmtDesc(r.descripcion_mercancia)
        return d ? (
          <span className="block truncate max-w-[400px]" title={d}>{d}</span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
  ]

  return (
    <div className="page-shell">
      {/* Header — single row: title + completeness summary + SyncChip + MonthSelector */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)] m-0">
            Expediente Digital
          </h1>
          <span className="text-[12px] text-[var(--text-muted)] font-mono [font-variant-numeric:tabular-nums]">
            {formatNumber(completeCount)} de {formatNumber(withPedimento.length)} expedientes completos
          </span>
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
              placeholder="Embarque, pedimento, mercancía…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Buscar expedientes"
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              style={{ minHeight: 60 }}
            />
          </div>
        </div>

        {fetchError && <ErrorCard message={fetchError} onRetry={() => window.location.reload()} />}

        {!loading && paged.length === 0 ? (
          <CalmEmptyState
            icon="document"
            title="No hay documentos"
            message="Los documentos aparecerán aquí cuando iniciemos nuevas operaciones."
            action={{ label: 'Ver embarques', href: '/embarques' }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={paged}
            rowKey={(r) => r.trafico}
            ariaLabel="Lista de expedientes"
            mobileMinWidth={1000}
            onRowClick={(r) => router.push(`/expedientes/${encodeURIComponent(r.trafico)}`)}
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
