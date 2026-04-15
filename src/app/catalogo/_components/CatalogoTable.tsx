'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/aguila/GlassCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { CatalogoRow } from '@/lib/catalogo/products'

interface Props {
  rows: CatalogoRow[]
  query: string
  total: number
}

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago' })
  } catch { return '' }
}

export function CatalogoTable({ rows, query, total }: Props) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción, fracción o clave..."
          aria-label="Buscar en catálogo"
          style={{
            flex: '1 1 280px',
            minHeight: 60,
            padding: '0 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 'var(--aguila-fs-section)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            minHeight: 60,
            padding: '0 20px',
            borderRadius: 12,
            background: '#eab308',
            color: '#0a0a0c',
            border: 'none',
            fontSize: 'var(--aguila-fs-section)',
            fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Buscando…' : 'Buscar'}
        </button>
        <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
          {total} producto{total === 1 ? '' : 's'}
        </span>
      </form>

      {rows.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon="📦"
            title={query ? 'Sin coincidencias' : 'Sin productos en el catálogo'}
            description={query
              ? 'Prueba con otra descripción, fracción o clave de producto.'
              : 'Los productos importados aparecerán aquí conforme lleguen embarques nuevos.'}
          />
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => (
            <CatalogoRowCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function CatalogoRowCard({ row }: { row: CatalogoRow }) {
  return (
    <GlassCard>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(160px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--aguila-fs-section)',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.35,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {row.descripcion}
            </p>
            {row.cve_producto && (
              <p
                className="font-mono"
                style={{ margin: '2px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.45)' }}
              >
                {row.cve_producto}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 'var(--aguila-fs-compact)' }}>
            {row.proveedor_nombre && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: '0.08em' }}>
                  Proveedor
                </span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{row.proveedor_nombre}</span>
              </div>
            )}
            {row.pais_origen && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: '0.08em' }}>
                  Origen
                </span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{row.pais_origen}</span>
              </div>
            )}
            {row.veces_importado > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: '0.08em' }}>
                  Importado
                </span>
                <span className="font-mono" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {row.veces_importado}×
                </span>
              </div>
            )}
            {row.valor_ytd_usd != null && row.valor_ytd_usd > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: '0.08em' }}>
                  Valor
                </span>
                <span className="font-mono" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {fmtUsd(row.valor_ytd_usd)} USD
                </span>
              </div>
            )}
          </div>

          {row.ultimo_cve_trafico ? (
            <Link
              href={`/embarques/${encodeURIComponent(row.ultimo_cve_trafico)}`}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 36,
                padding: '0 12px',
                background: 'rgba(234,179,8,0.1)',
                border: '1px solid rgba(234,179,8,0.3)',
                borderRadius: 999,
                color: '#FACC15',
                fontSize: 'var(--aguila-fs-compact)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span className="font-mono">{row.ultimo_cve_trafico}</span>
              {row.ultima_fecha_llegada && (
                <span style={{ color: 'rgba(250,204,21,0.7)' }}>· {fmtDate(row.ultima_fecha_llegada)}</span>
              )}
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.4)' }}>Sin embarque reciente</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)' }}>
            Fracción
          </p>
          {row.fraccion ? (
            <p
              className="font-mono"
              style={{
                margin: 0,
                fontSize: 'var(--aguila-fs-headline)',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: '#E6EDF3',
                textAlign: 'right',
              }}
            >
              {row.fraccion}
            </p>
          ) : (
            <Link
              href={`/clasificar?q=${encodeURIComponent(row.descripcion)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                padding: '0 12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 'var(--aguila-fs-compact)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sin clasificar · Clasificar →
            </Link>
          )}
          {row.fraccion_source && (
            <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
              {row.fraccion_source.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
