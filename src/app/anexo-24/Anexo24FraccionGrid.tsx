'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Truck, Users, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { fmtUSDCompact } from '@/lib/format-utils'
import type { AnexoFraccionGroup } from '@/lib/anexo24/by-fraccion'
import { renderNull, renderEmpty } from '@/lib/ui/cell-renderers'

interface Props {
  groups: AnexoFraccionGroup[]
  initialQuery?: string
}

/**
 * Anexo 24 fracción grid — the consolidated view.
 *
 * Collapses the flat 148K-SKU catalog into ~500 tariff-code cards.
 * Each card surfaces:
 *   · Fracción code (mono, gold pill)
 *   · Primary description (highest-usage SKU's text)
 *   · SKU count + total YTD value
 *   · Top 3 proveedores + recent traficos (deep-linkable)
 *   · Expand to preview top 5 SKUs inside
 *
 * Every fracción card links to the existing /catalogo/fraccion/[code]
 * page for full variant drill-down (already shipped in v1). That page
 * now serves as the "all SKUs under this fraction" detail view.
 */
export function Anexo24FraccionGrid({ groups, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => {
      if ((g.fraccion_formatted ?? g.fraccion).toLowerCase().includes(q)) return true
      if (g.primary_description.toLowerCase().includes(q)) return true
      if (g.proveedor_names.some((n) => n.toLowerCase().includes(q))) return true
      return g.top_skus.some((s) => (s.cve_producto ?? '').toLowerCase().includes(q) || s.descripcion.toLowerCase().includes(q))
    })
  }, [groups, query])

  const toggleExpand = (fraccion: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(fraccion)) next.delete(fraccion)
      else next.add(fraccion)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label
        htmlFor="anexo24-frac-search"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          minHeight: 60,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(192,197,206,0.12)',
        }}
      >
        <Search size={16} strokeWidth={1.8} color="rgba(148,163,184,0.7)" />
        <input
          id="anexo24-frac-search"
          type="search"
          placeholder="Buscar fracción, descripción, proveedor, SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar por fracción en Anexo 24"
          style={{
            flex: 1,
            minHeight: 44,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#E6EDF3',
            fontSize: 'var(--aguila-fs-section, 15px)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar"
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
          {query ? `Sin fracciones para "${query}"` : 'Ninguna fracción clasificada todavía.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((g) => (
            <FraccionCard
              key={g.fraccion}
              group={g}
              expanded={expanded.has(g.fraccion)}
              onToggle={() => toggleExpand(g.fraccion)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FraccionCard({
  group,
  expanded,
  onToggle,
}: {
  group: AnexoFraccionGroup
  expanded: boolean
  onToggle: () => void
}) {
  const pillFrac = group.fraccion_formatted ?? group.fraccion

  return (
    <article
      style={{
        padding: 0,
        borderRadius: 16,
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(192,197,206,0.12)',
        overflow: 'hidden',
        transition: 'border-color var(--dur-fast, 150ms) ease, background var(--dur-fast, 150ms) ease',
      }}
    >
      {/* Header row — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 18px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <Link
              href={`/catalogo/fraccion/${encodeURIComponent(group.fraccion)}`}
              className="font-mono"
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(201,167,74,0.12)',
                border: '1px solid rgba(201,167,74,0.32)',
                color: '#F4D47A',
                fontSize: 'var(--aguila-fs-body, 13px)',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                minHeight: 32,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {pillFrac}
            </Link>
            {group.tmec_eligible_heuristic && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#86EFAC',
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                T-MEC
              </span>
            )}
            <span
              style={{
                fontSize: 'var(--aguila-fs-meta, 11px)',
                color: 'rgba(148,163,184,0.8)',
                letterSpacing: '0.04em',
              }}
            >
              {group.sku_count.toLocaleString('es-MX')} SKU{group.sku_count === 1 ? '' : 's'}
            </span>
            {group.total_valor_ytd_usd != null && group.total_valor_ytd_usd > 0 && (
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  color: 'rgba(205,214,224,0.85)',
                  fontWeight: 600,
                }}
              >
                {fmtUSDCompact(group.total_valor_ytd_usd)} YTD
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: 'rgba(230,237,243,0.88)',
              lineHeight: 1.45,
              marginBottom: 10,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {group.primary_description}
          </div>

          {/* Proveedores + recent traficos — two pill rows */}
          {group.proveedor_names.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
              <Users size={12} strokeWidth={1.8} color="rgba(148,163,184,0.7)" aria-hidden />
              {group.proveedor_names.slice(0, 3).map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    color: 'rgba(205,214,224,0.8)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(192,197,206,0.06)',
                  }}
                >
                  {name}
                </span>
              ))}
              {group.proveedor_names.length > 3 && (
                <span style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(148,163,184,0.7)' }}>
                  +{group.proveedor_names.length - 3} más
                </span>
              )}
            </div>
          )}

          {group.recent_traficos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Truck size={12} strokeWidth={1.8} color="rgba(148,163,184,0.7)" aria-hidden />
              {group.recent_traficos.slice(0, 5).map((trafico) => (
                <Link
                  key={trafico}
                  href={`/embarques/${encodeURIComponent(trafico)}`}
                  className="font-mono"
                  style={{
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    color: 'rgba(192,197,206,0.85)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(192,197,206,0.06)',
                    border: '1px solid rgba(192,197,206,0.12)',
                    textDecoration: 'none',
                    transition: 'border-color var(--dur-fast, 150ms) ease, color var(--dur-fast, 150ms) ease',
                  }}
                >
                  {trafico}
                </Link>
              ))}
              {group.recent_traficos.length > 5 && (
                <span style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(148,163,184,0.7)' }}>
                  +{group.recent_traficos.length - 5} más
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Cerrar detalle de fracción' : 'Abrir detalle de fracción'}
            aria-expanded={expanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '0 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(192,197,206,0.18)',
              borderRadius: 10,
              color: '#E6EDF3',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {expanded ? (
              <>
                <ChevronUp size={14} strokeWidth={2} />
                Cerrar
              </>
            ) : (
              <>
                <ChevronDown size={14} strokeWidth={2} />
                Ver SKUs
              </>
            )}
          </button>
          <Link
            href={`/catalogo/fraccion/${encodeURIComponent(group.fraccion)}`}
            style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'rgba(192,197,206,0.7)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              letterSpacing: '0.04em',
            }}
          >
            Ficha de fracción →
          </Link>
        </div>
      </div>

      {/* Expanded: top 5 SKUs preview */}
      {expanded && group.top_skus.length > 0 && (
        <div
          style={{
            borderTop: '1px solid rgba(192,197,206,0.08)',
            background: 'rgba(0,0,0,0.18)',
            padding: '10px 18px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(148,163,184,0.7)',
              marginBottom: 4,
            }}
          >
            Top {group.top_skus.length} SKUs por uso
          </div>
          {group.top_skus.map((sku) => (
            <Link
              key={sku.cve_producto ?? sku.descripcion}
              href={sku.cve_producto ? `/anexo-24/${encodeURIComponent(sku.cve_producto)}` : '#'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(192,197,206,0.08)',
                textDecoration: 'none',
                color: 'inherit',
                minHeight: 44,
              }}
            >
              <Package size={14} strokeWidth={1.8} color="rgba(192,197,206,0.7)" aria-hidden />
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--aguila-fs-meta, 11px)',
                  color: 'rgba(192,197,206,0.9)',
                  width: 130,
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sku.cve_producto ?? renderNull()}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'var(--aguila-fs-body, 13px)',
                  color: 'rgba(230,237,243,0.88)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sku.descripcion || renderEmpty('Sin descripción')}
              </span>
              {sku.veces_importado > 0 && (
                <span
                  style={{
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    color: 'rgba(148,163,184,0.85)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                  }}
                >
                  {sku.veces_importado}×
                </span>
              )}
              {sku.valor_ytd_usd != null && sku.valor_ytd_usd > 0 && (
                <span
                  style={{
                    fontSize: 'var(--aguila-fs-meta, 11px)',
                    color: '#E6EDF3',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {fmtUSDCompact(sku.valor_ytd_usd)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}
