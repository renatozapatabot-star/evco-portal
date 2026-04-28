'use client'

import Link from 'next/link'
import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CatalogoRow } from '@/lib/catalogo/products'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { formatNumber, formatCurrencyUSD } from '@/lib/format'
import styles from './CatalogoTable.module.css'

interface Props {
  rows: CatalogoRow[]
  query: string
}

const PAGE_SIZE = 50

/**
 * Client-side dedup: group rows by `${cve_producto}|${fraccion ?? ''}`
 * and keep the first occurrence. If duplicates collide (same key),
 * sum `veces_importado` and `valor_ytd_usd` so the row reflects all
 * usages. Pure UI aggregation — no extra queries.
 */
function dedupRows(rows: CatalogoRow[]): CatalogoRow[] {
  const map = new Map<string, CatalogoRow>()
  for (const r of rows) {
    const key = `${r.cve_producto ?? ''}|${r.fraccion ?? ''}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...r })
    } else {
      prev.veces_importado = (prev.veces_importado ?? 0) + (r.veces_importado ?? 0)
      prev.valor_ytd_usd = (prev.valor_ytd_usd ?? 0) + (r.valor_ytd_usd ?? 0)
    }
  }
  return Array.from(map.values())
}

export function CatalogoTable({ rows, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(query)
  const [page, setPage] = useState(0)
  const [pending, startTransition] = useTransition()

  const deduped = useMemo(() => dedupRows(rows), [rows])
  const totalPages = Math.max(1, Math.ceil(deduped.length / PAGE_SIZE))
  const paged = useMemo(
    () => deduped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [deduped, page],
  )

  // Debounced live filter (Cluster G · 2026-04-28). Replaces the
  // press-Enter-to-search behavior with a 300ms debounce — matches
  // standard SaaS search UX. The form's onSubmit is preserved as a
  // fast-path so Enter still flushes immediately. ?q= URL behavior
  // is unchanged: each keystroke (after debounce) router.pushes the
  // updated URL so the server re-fetches with the new query AND the
  // URL stays shareable / refreshable.
  const lastPushedRef = useRef<string | null>(query)
  function pushSearch(next: string) {
    const trimmed = next.trim()
    if (lastPushedRef.current === trimmed) return
    lastPushedRef.current = trimmed
    const params = new URLSearchParams(searchParams.toString())
    if (trimmed) params.set('q', trimmed)
    else params.delete('q')
    setPage(0)
    startTransition(() => router.push(`/catalogo?${params.toString()}`))
  }

  useEffect(() => {
    const t = setTimeout(() => pushSearch(search), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushSearch(search) // fast-path: Enter flushes the pending debounce
  }

  const columns: DataTableColumn<CatalogoRow>[] = [
    {
      key: 'producto',
      header: 'Producto',
      width: 140,
      mono: true,
      render: (r) => r.cve_producto ? (
        <Link
          href={`/catalogo/partes/${encodeURIComponent(r.cve_producto)}`}
          className="font-semibold text-[var(--accent-silver-bright,#E8EAED)] no-underline hover:underline underline-offset-2"
        >
          {r.cve_producto}
        </Link>
      ) : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (r) => {
        const d = r.merchandise || r.descripcion
        return d ? (
          <span className="block truncate max-w-[360px] text-[var(--text-primary)] font-medium" title={d}>{d}</span>
        ) : <span className="text-[var(--text-muted)]">—</span>
      },
    },
    {
      key: 'fraccion',
      header: 'Fracción',
      width: 130,
      mono: true,
      render: (r) => r.fraccion ? (
        <span>{r.fraccion}</span>
      ) : (
        <span className={styles.fraccionPending}>Pendiente IA</span>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      width: 200,
      render: (r) => r.proveedor_nombre ? (
        <span className="block truncate max-w-[220px]" title={r.proveedor_nombre}>{r.proveedor_nombre}</span>
      ) : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'pais',
      header: 'País',
      width: 90,
      render: (r) => r.pais_origen || <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'importado',
      header: 'Importado',
      width: 100,
      numeric: true,
      render: (r) => r.veces_importado > 0
        ? formatNumber(r.veces_importado)
        : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      width: 160,
      numeric: true,
      render: (r) => r.valor_ytd_usd != null && r.valor_ytd_usd > 0
        ? formatCurrencyUSD(r.valor_ytd_usd)
        : <span className="text-[var(--text-muted)]">—</span>,
    },
  ]

  return (
    <div className={styles.shell}>
      <form onSubmit={onSubmit} className={styles.toolbar}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción, fracción o número de parte…"
          aria-label="Buscar en catálogo"
          className={styles.search}
        />
        <button type="submit" disabled={pending} className={styles.btn}>
          {pending ? 'Buscando…' : 'Buscar'}
        </button>
        <span className={styles.count}>
          {formatNumber(deduped.length)} {deduped.length === 1 ? 'registro' : 'registros'}
        </span>
      </form>

      {paged.length === 0 ? (
        <div className={styles.empty}>
          {query ? (
            <>
              <div>{`Sin coincidencias para "${query}".`}</div>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  pushSearch('')
                }}
                className={styles.btn}
                style={{ marginTop: 12, minHeight: 60 }}
              >
                Limpiar filtros
              </button>
            </>
          ) : (
            'Tu catálogo aparecerá aquí cuando se sincronicen partes.'
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={paged}
          rowKey={(r) => r.id}
          ariaLabel="Catálogo de partes"
          mobileMinWidth={900}
        />
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
            className={styles.paginationBtn}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Página siguiente"
            className={styles.paginationBtn}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
