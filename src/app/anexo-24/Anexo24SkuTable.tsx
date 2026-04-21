'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import type { AnexoSku } from '@/lib/anexo24/snapshot'
import { formatFraccion } from '@/lib/format/fraccion'
import { fmtUSDCompact } from '@/lib/format-utils'
import { renderNull, renderEmpty } from '@/lib/ui/cell-renderers'

interface Props {
  skus: AnexoSku[]
  initialQuery?: string
}

/**
 * SKU table — Anexo 24-framed. Search + sort client-side over the
 * pre-fetched slice (up to 300 rows). Each row is a link into
 * /anexo-24/[cveProducto] for full-part drill-down (Phase 2).
 *
 * Mobile rendering collapses to one card-per-SKU with the search
 * box stuck at the top. 60px tap targets, tabular-nums inherited
 * from the .aguila-table CSS (Saturday theme pass).
 */
export function Anexo24SkuTable({ skus, initialQuery = '' }: Props) {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState(initialQuery)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return skus
    return skus.filter((s) => {
      const cve = (s.cve_producto ?? '').toLowerCase()
      const desc = s.descripcion.toLowerCase()
      const frac = (s.fraccion ?? '').toLowerCase()
      const prov = (s.proveedor_nombre ?? '').toLowerCase()
      return cve.includes(q) || desc.includes(q) || frac.includes(q) || prov.includes(q)
    })
  }, [skus, query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label
        htmlFor="anexo24-search"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          minHeight: 60,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(192,197,206,0.12)',
          transition: 'border-color var(--dur-fast, 150ms) ease, background var(--dur-fast, 150ms) ease',
        }}
      >
        <Search size={16} strokeWidth={1.8} color="rgba(148,163,184,0.7)" />
        <input
          id="anexo24-search"
          type="search"
          placeholder="Buscar parte, descripción, fracción, proveedor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar en Anexo 24"
          style={{
            flex: 1,
            minHeight: 44,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--portal-fg-1)',
            fontSize: 'var(--aguila-fs-section, 15px)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(148,163,184,0.7)',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Limpiar
          </button>
        )}
      </label>

      {filtered.length === 0 ? (
        <div
          role="status"
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'rgba(148,163,184,0.8)',
            fontSize: 'var(--aguila-fs-body, 13px)',
          }}
        >
          Sin resultados para &ldquo;{query}&rdquo;
        </div>
      ) : isMobile ? (
        <MobileList skus={filtered} />
      ) : (
        <DesktopTable skus={filtered} />
      )}
    </div>
  )
}

function MobileList({ skus }: { skus: AnexoSku[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {skus.map((sku) => (
        <Link
          key={sku.id}
          href={sku.cve_producto ? `/anexo-24/${encodeURIComponent(sku.cve_producto)}` : '#'}
          style={{
            display: 'block',
            padding: '14px 16px',
            borderRadius: 14,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(192,197,206,0.12)',
            textDecoration: 'none',
            color: 'inherit',
            minHeight: 60,
            transition: 'border-color var(--dur-fast, 150ms) ease, transform var(--dur-fast, 150ms) ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 'var(--aguila-fs-section, 15px)',
                fontWeight: 700,
                color: 'var(--portal-fg-1)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}
            >
              {sku.cve_producto ?? renderNull()}
            </span>
            {sku.fraccion && (
              <span
                style={{
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  fontFamily: 'var(--font-mono)',
                  color: 'rgba(192,197,206,0.82)',
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {formatFraccion(sku.fraccion) ?? sku.fraccion}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: 'rgba(205,214,224,0.92)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 6,
            }}
          >
            {sku.descripcion || renderEmpty('Sin descripción')}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'rgba(148,163,184,0.7)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {sku.proveedor_nombre && <span>{sku.proveedor_nombre}</span>}
            {sku.pais_origen && <span>{sku.pais_origen}</span>}
            {sku.veces_importado > 0 && <span>{sku.veces_importado}× importado</span>}
            {sku.valor_ytd_usd != null && sku.valor_ytd_usd > 0 && (
              <span style={{ color: 'rgba(230,237,243,0.85)' }}>
                {fmtUSDCompact(sku.valor_ytd_usd)} YTD
              </span>
            )}
            {sku.tmec_eligible_heuristic && (
              <span style={{ color: 'rgba(34,197,94,0.85)' }}>T-MEC</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function DesktopTable({ skus }: { skus: AnexoSku[] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(192,197,206,0.08)' }}>
      <table className="aguila-table" aria-label="Anexo 24 · inventario" style={{ minWidth: 960, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: 140, textAlign: 'left' }}>Número de parte</th>
            <th style={{ textAlign: 'left' }}>Descripción</th>
            <th style={{ width: 120, textAlign: 'left' }}>Fracción</th>
            <th style={{ width: 80, textAlign: 'left' }}>País</th>
            <th style={{ width: 110, textAlign: 'right' }}>Veces</th>
            <th style={{ width: 120, textAlign: 'right' }}>YTD USD</th>
            <th style={{ width: 80, textAlign: 'center' }}>T-MEC</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((sku) => (
            <tr
              key={sku.id}
              onClick={() => {
                if (sku.cve_producto && typeof window !== 'undefined') {
                  window.location.href = `/anexo-24/${encodeURIComponent(sku.cve_producto)}`
                }
              }}
              style={{ cursor: sku.cve_producto ? 'pointer' : 'default' }}
            >
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--portal-fg-1)' }}>
                {sku.cve_producto ?? renderNull()}
              </td>
              <td
                className="desc-text"
                style={{
                  color: 'rgba(205,214,224,0.92)',
                  maxWidth: 380,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={sku.descripcion}
              >
                {sku.descripcion || <span style={{ color: 'rgba(148,163,184,0.5)' }}>Sin descripción</span>}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)', color: 'rgba(192,197,206,0.9)' }}>
                {sku.fraccion ? (formatFraccion(sku.fraccion) ?? sku.fraccion) : <span style={{ color: 'rgba(148,163,184,0.5)' }}>—</span>}
              </td>
              <td style={{ color: 'rgba(148,163,184,0.9)', fontFamily: 'var(--font-mono)' }}>
                {sku.pais_origen ?? <span style={{ color: 'rgba(148,163,184,0.5)' }}>—</span>}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(205,214,224,0.85)' }}>
                {sku.veces_importado > 0 ? sku.veces_importado.toLocaleString('es-MX') : <span style={{ color: 'rgba(148,163,184,0.5)' }}>—</span>}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-1)', fontWeight: 600 }}>
                {sku.valor_ytd_usd != null && sku.valor_ytd_usd > 0 ? fmtUSDCompact(sku.valor_ytd_usd) : <span style={{ color: 'rgba(148,163,184,0.5)' }}>—</span>}
              </td>
              <td style={{ textAlign: 'center' }}>
                {sku.tmec_eligible_heuristic ? (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--portal-status-green-bg)',
                      border: '1px solid var(--portal-status-green-ring)',
                      fontSize: 'var(--aguila-fs-meta, 11px)',
                      color: 'rgba(134,239,172,0.95)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    T-MEC
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
