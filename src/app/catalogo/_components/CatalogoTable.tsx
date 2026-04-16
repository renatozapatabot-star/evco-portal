'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/aguila/GlassCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'
import type { CatalogoRow, CatalogoFraccionGroup, CatalogoSummary } from '@/lib/catalogo/products'

interface Props {
  rows: CatalogoRow[]
  groups: CatalogoFraccionGroup[]
  summary: CatalogoSummary
  query: string
  mode: 'partes' | 'fracciones'
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

export function CatalogoTable({ rows, groups, summary, query, mode }: Props) {
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

  function setMode(nextMode: 'partes' | 'fracciones') {
    const params = new URLSearchParams(searchParams.toString())
    if (nextMode === 'partes') params.set('view', 'partes')
    else params.delete('view')
    startTransition(() => router.push(`/catalogo?${params.toString()}`))
  }

  const showing = mode === 'fracciones' ? groups.length : rows.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pre-audit consolidation summary. */}
      <GlassCard padding="14px 18px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <SummaryStat label="Productos" value={summary.total_products.toLocaleString('es-MX')} />
          <SummaryStat label="Fracciones" value={summary.fraccion_count.toLocaleString('es-MX')} />
          <SummaryStat
            label="Sin clasificar"
            value={summary.unclassified_count.toLocaleString('es-MX')}
            tone={summary.unclassified_count > 0 ? 'amber' : undefined}
          />
          <SummaryStat
            label="A consolidar"
            value={summary.consolidation_candidates.toLocaleString('es-MX')}
            tone={summary.consolidation_candidates > 0 ? 'amber' : undefined}
            hint={summary.consolidation_candidates > 0 ? `${summary.dedup_pool.toLocaleString('es-MX')} variantes duplicadas` : undefined}
          />
        </div>
      </GlassCard>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descripción, fracción o clave..."
          aria-label="Buscar en catálogo"
          style={{
            flex: '1 1 280px', minHeight: 60, padding: '0 14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, color: 'rgba(255,255,255,0.92)', fontSize: 'var(--aguila-fs-section)', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={pending}
          style={{
            minHeight: 60, padding: '0 20px', borderRadius: 12,
            background: 'rgba(192,197,206,0.12)', color: '#E8EAED',
            border: '1px solid rgba(192,197,206,0.25)',
            fontSize: 'var(--aguila-fs-section)', fontWeight: 700,
            cursor: pending ? 'wait' : 'pointer',
          }}
        >
          {pending ? 'Buscando…' : 'Buscar'}
        </button>
        <ModeToggle mode={mode} onChange={setMode} pending={pending} />
        <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-compact)', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
          {showing.toLocaleString('es-MX')} {mode === 'fracciones' ? (showing === 1 ? 'fracción' : 'fracciones') : (showing === 1 ? 'producto' : 'productos')}
        </span>
      </form>

      {mode === 'fracciones' ? (
        groups.length === 0 ? (
          <CalmEmptyState
            icon="package"
            title={query ? 'Sin coincidencias' : 'Tu catálogo aparecerá aquí'}
            message={query
              ? 'Prueba con otra descripción, fracción o clave.'
              : 'Una vez clasifiquemos tus productos, podrás ver el historial completo.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => <FraccionGroupCard key={g.fraccion} group={g} />)}
          </div>
        )
      ) : (
        rows.length === 0 ? (
          <CalmEmptyState
            icon="package"
            title={query ? 'Sin coincidencias' : 'Tu catálogo aparecerá aquí'}
            message={query
              ? 'Prueba con otra descripción, fracción o clave.'
              : 'Los productos aparecerán conforme clasifiquemos tus embarques.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((r) => <CatalogoRowCard key={r.id} row={r} />)}
          </div>
        )
      )}
    </div>
  )
}

function ModeToggle({ mode, onChange, pending }: { mode: 'partes' | 'fracciones'; onChange: (m: 'partes' | 'fracciones') => void; pending: boolean }) {
  return (
    <div role="tablist" aria-label="Vista del catálogo" style={{
      display: 'inline-flex', padding: 4, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(192,197,206,0.15)',
    }}>
      <ModeTab label="Por fracción" active={mode === 'fracciones'} onClick={() => onChange('fracciones')} disabled={pending} />
      <ModeTab label="Partes" active={mode === 'partes'} onClick={() => onChange('partes')} disabled={pending} />
    </div>
  )
}

function ModeTab({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} disabled={disabled}
      style={{
        // 60 px minimum tap target (CLAUDE.md mobile rule). Horizontal
        // padding kept proportional so the label doesn't feel cramped.
        minHeight: 60, minWidth: 88, padding: '0 20px', border: 'none', borderRadius: 10,
        background: active ? 'rgba(192,197,206,0.14)' : 'transparent',
        color: active ? '#E8EAED' : 'rgba(255,255,255,0.5)',
        fontSize: 'var(--aguila-fs-compact)', fontWeight: 700, letterSpacing: '0.04em',
        cursor: disabled ? 'wait' : 'pointer', textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  )
}

function SummaryStat({ label, value, tone, hint }: { label: string; value: string; tone?: 'amber'; hint?: string }) {
  const color = tone === 'amber' ? '#FBBF24' : '#E8EAED'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</span>
      {hint && <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.5)' }}>{hint}</span>}
    </div>
  )
}

function FraccionGroupCard({ group }: { group: CatalogoFraccionGroup }) {
  const topSuppliers = group.supplier_names.slice(0, 4)
  const extra = Math.max(0, group.supplier_names.length - topSuppliers.length)
  return (
    <GlassCard href={`/catalogo/fraccion/${encodeURIComponent(group.fraccion)}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(160px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p style={{
              margin: 0, fontSize: 'var(--aguila-fs-section)', fontWeight: 600,
              color: 'rgba(255,255,255,0.92)', lineHeight: 1.35,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {group.primary_descripcion}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.5)' }}>
              {group.variant_count} variante{group.variant_count === 1 ? '' : 's'} · {group.total_imports.toLocaleString('es-MX')} importación{group.total_imports === 1 ? '' : 'es'}
            </p>
          </div>
          {topSuppliers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topSuppliers.map((s) => (
                <span key={s} title={s} style={{
                  fontSize: 'var(--aguila-fs-meta)', padding: '3px 10px', borderRadius: 999,
                  background: 'rgba(192,197,206,0.08)', border: '1px solid rgba(192,197,206,0.18)',
                  color: 'rgba(255,255,255,0.8)', maxWidth: 220,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s}</span>
              ))}
              {extra > 0 && <span style={{ fontSize: 'var(--aguila-fs-meta)', padding: '3px 10px', color: 'rgba(255,255,255,0.5)' }}>+{extra} proveedor{extra === 1 ? '' : 'es'}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 'var(--aguila-fs-label)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)' }}>Fracción</p>
          <p className="font-mono" style={{ margin: 0, fontSize: 'var(--aguila-fs-headline)', fontWeight: 800, letterSpacing: '-0.01em', color: '#E6EDF3', textAlign: 'right' }}>{group.fraccion}</p>
          {group.variant_count >= 5 && (
            <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: '0.08em', color: '#FBBF24', textTransform: 'uppercase' }}>Consolidar</span>
          )}
        </div>
      </div>
    </GlassCard>
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
