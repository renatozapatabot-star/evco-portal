'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CatalogoRow } from '@/lib/catalogo/products'

interface Props {
  rows: CatalogoRow[]
  query: string
}

/** Integer with es-MX thousand separators. */
function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return Math.trunc(Number(n)).toLocaleString('es-MX')
}

/** USD with thousand separators, no decimals. */
function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`
}

export function CatalogoTable({ rows, query }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(query)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (search.trim()) params.set('q', search.trim())
    else params.delete('q')
    startTransition(() => router.push(`/catalogo?${params.toString()}`))
  }

  return (
    <div className="cat-shell">
      <form onSubmit={onSubmit} className="cat-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción, fracción o número de parte…"
          aria-label="Buscar en catálogo"
          className="cat-search"
        />
        <button type="submit" disabled={pending} className="cat-btn">
          {pending ? 'Buscando…' : 'Buscar'}
        </button>
        <span className="cat-count">
          {rows.length.toLocaleString('es-MX')} {rows.length === 1 ? 'registro' : 'registros'}
        </span>
      </form>

      {rows.length === 0 ? (
        <div className="cat-empty">
          {query
            ? `Sin coincidencias para "${query}".`
            : 'Tu catálogo aparecerá aquí cuando se sincronicen partes.'}
        </div>
      ) : (
        <div className="cat-table-wrap">
          <table className="cat-table" role="table" aria-label="Catálogo de partes">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Producto</th>
                <th>Descripción</th>
                <th style={{ width: 130 }}>Fracción</th>
                <th style={{ width: 200 }}>Proveedor</th>
                <th style={{ width: 90 }}>País</th>
                <th style={{ width: 100, textAlign: 'right' }}>Importado</th>
                <th style={{ width: 140, textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const description = r.merchandise || r.descripcion
                const partHref = r.cve_producto ? `/catalogo/partes/${encodeURIComponent(r.cve_producto)}` : null
                return (
                  <tr key={r.id}>
                    <td className="cell-mono">
                      {partHref && r.cve_producto ? (
                        <Link href={partHref} className="cell-link">{r.cve_producto}</Link>
                      ) : (
                        r.cve_producto ?? '—'
                      )}
                    </td>
                    <td className="cell-desc" title={description}>{description || '—'}</td>
                    <td className="cell-mono">{r.fraccion ?? '—'}</td>
                    <td className="cell-soft" title={r.proveedor_nombre || undefined}>
                      {r.proveedor_nombre || '—'}
                    </td>
                    <td className="cell-soft">{r.pais_origen || '—'}</td>
                    <td className="cell-mono cell-right">
                      {r.veces_importado > 0 ? fmtInt(r.veces_importado) : '—'}
                    </td>
                    <td className="cell-mono cell-right">
                      {r.valor_ytd_usd != null && r.valor_ytd_usd > 0 ? fmtUSD(r.valor_ytd_usd) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Page-scoped polish — shadcn-feel chrome on this surface only. */}
      <style>{`
        .cat-shell { display: flex; flex-direction: column; gap: 16px; }

        /* Toolbar */
        .cat-toolbar {
          display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
        }
        .cat-search {
          flex: 1 1 280px;
          min-height: 60px;
          padding: 0 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
          transition: border-color 120ms ease, background 120ms ease;
        }
        .cat-search:focus {
          border-color: rgba(192,197,206,0.4);
          background: rgba(255,255,255,0.06);
        }
        .cat-btn {
          min-height: 60px; padding: 0 20px;
          background: rgba(192,197,206,0.10);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 10px;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          cursor: pointer;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .cat-btn:hover:not(:disabled) {
          background: rgba(192,197,206,0.16);
          border-color: rgba(192,197,206,0.3);
        }
        .cat-btn:disabled { cursor: wait; opacity: 0.6; }
        .cat-count {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          font-size: 12px;
          color: var(--text-muted);
          margin-left: auto;
        }

        /* Table */
        .cat-table-wrap {
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow-x: auto;
        }
        .cat-table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          min-width: 900px;
        }
        .cat-table th {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--text-muted);
          padding: 10px 12px;
          text-align: left;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 1;
        }
        .cat-table td {
          padding: 10px 12px;
          font-size: 13px;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .cat-table tbody tr { transition: background 120ms ease; }
        .cat-table tbody tr:nth-child(odd) { background: rgba(255,255,255,0.015); }
        .cat-table tbody tr:hover { background: rgba(192,197,206,0.06); }
        .cat-table tbody tr:last-child td { border-bottom: 0; }

        .cell-mono { font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); }
        .cell-right { text-align: right; }
        .cell-soft  { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
        .cell-desc  {
          color: var(--text-primary);
          font-weight: 500;
          max-width: 360px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cell-link  { color: var(--accent-silver-bright, #E8EAED); text-decoration: none; font-weight: 600; }
        .cell-link:hover { text-decoration: underline; text-underline-offset: 2px; }

        /* Empty */
        .cat-empty {
          padding: 32px 16px;
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: 10px;
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </div>
  )
}
