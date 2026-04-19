import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  getCatalogo,
  groupCatalogoByFraccion,
  type CatalogoRow,
  type CatalogoFraccionGroup,
} from '@/lib/catalogo/products'
import { GlassCard } from '@/components/aguila/GlassCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: Promise<{ code: string }>
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

export default async function FraccionDetailPage({ params }: Props) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { code } = await params
  const fraccion = decodeURIComponent(code)
  const supabase = createServerClient()
  // Pull all classified products for this tenant, then narrow to this fracción.
  // Cap is high enough to catch the full history — if we ever outgrow it
  // we'll move this to a targeted query.
  const rows = await getCatalogo(supabase, session.companyId, { limit: 500 })
  const groups = groupCatalogoByFraccion(rows)
  const group: CatalogoFraccionGroup | undefined = groups.find((g) => g.fraccion === fraccion)

  if (!group) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <Link href="/catalogo" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 'var(--aguila-fs-body)' }}>
          ← Catálogo
        </Link>
        <h1 style={{ margin: '16px 0 0', fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
          {fraccion}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.6)' }}>
          No hay productos clasificados bajo esta fracción en tu catálogo.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <Link href="/catalogo" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 'var(--aguila-fs-body)' }}>
        ← Catálogo
      </Link>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <h1 className="font-mono" style={{ margin: 0, fontSize: 'var(--aguila-fs-kpi-compact)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--portal-fg-1)' }}>
          {group.fraccion}
        </h1>
        <span style={{ fontSize: 'var(--aguila-fs-compact)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)' }}>
          {group.variant_count} variante{group.variant_count === 1 ? '' : 's'} · {group.total_imports.toLocaleString('es-MX')} importación{group.total_imports === 1 ? '' : 'es'}
        </span>
      </div>
      <p style={{ margin: '10px 0 24px', fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.8)', maxWidth: 720, lineHeight: 1.5 }}>
        {group.primary_descripcion}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <Stat label="Proveedores" value={group.supplier_names.length.toLocaleString('es-MX')} />
        <Stat label="Valor histórico" value={`${fmtUsd(group.valor_ytd_usd)} USD`} />
        <Stat label="Último embarque" value={group.last_trafico ? `${group.last_trafico} · ${fmtDate(group.last_fecha)}` : '—'} mono />
      </div>

      {group.supplier_names.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 'var(--aguila-fs-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
            Proveedores
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {group.supplier_names.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 'var(--aguila-fs-compact)',
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'rgba(192,197,206,0.08)',
                  border: '1px solid rgba(192,197,206,0.2)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ margin: '0 0 10px', fontSize: 'var(--aguila-fs-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
          Variantes en esta fracción
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {group.variants.map((v) => <VariantRow key={v.id} row={v} />)}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <GlassCard padding="14px 18px" size="compact">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          {label}
        </span>
        <span className={mono ? 'font-mono' : undefined} style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--portal-fg-1)' }}>
          {value}
        </span>
      </div>
    </GlassCard>
  )
}

function VariantRow({ row }: { row: CatalogoRow }) {
  // Each variant drills down to the parte-detail page (4 tabs: Resumen,
  // Historia, Proveedores, Observaciones). Without this link the row
  // looked interactive but nothing happened on tap — the Sunday build
  // that shipped ParteDetailClient had no entry point wired.
  const hasDetail = Boolean(row.cve_producto)
  const inner = (
    <div style={{ display: 'flex', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--aguila-fs-body)',
            color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.4,
          }}
        >
          {row.descripcion}
        </p>
        <p className="font-mono" style={{ margin: '3px 0 0', fontSize: 'var(--aguila-fs-meta)', color: 'rgba(255,255,255,0.45)' }}>
          {row.cve_producto || '—'}
          {row.proveedor_nombre ? ` · ${row.proveedor_nombre}` : ''}
          {row.pais_origen ? ` · ${row.pais_origen}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {row.veces_importado > 0 && (
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.85)' }}>
            {row.veces_importado}×
          </span>
        )}
        {row.valor_ytd_usd != null && row.valor_ytd_usd > 0 && (
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.85)' }}>
            {fmtUsd(row.valor_ytd_usd)}
          </span>
        )}
        {hasDetail && (
          <span className="font-mono" aria-hidden style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-3)' }}>→</span>
        )}
      </div>
    </div>
  )

  return (
    <GlassCard
      padding="12px 16px"
      size="compact"
      href={hasDetail ? `/catalogo/partes/${encodeURIComponent(row.cve_producto!)}` : undefined}
      ariaLabel={hasDetail ? `Ver ficha de ${row.descripcion ?? row.cve_producto}` : undefined}
    >
      {inner}
    </GlassCard>
  )
}
