/**
 * /admin/tenants/[company_id] — per-tenant detail dashboard.
 *
 * Admin/broker only. Complements /admin/monitor/tenants (aggregate)
 * with a drill-down: tenant config (branding, features, identity),
 * per-table row counts, and deep links to the intelligence dashboard,
 * catalogo, and monitor surfaces for this specific tenant.
 *
 * Built M11 as the first consumer of the M10 white-label foundation.
 * Demonstrates readTenantConfig + branding.accent_token routing + the
 * feature flag system all at once — the template for future
 * tenant-aware admin surfaces.
 */

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  PageShell,
  GlassCard,
  AguilaMetric,
} from '@/components/aguila'
import { readTenantConfig, type TenantConfig } from '@/lib/tenant/config'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface RouteParams {
  params: Promise<{ company_id: string }>
}

export default async function TenantDetailPage({ params }: RouteParams) {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const { company_id: raw } = await params
  const companyId = decodeURIComponent(raw).trim()
  if (!companyId || companyId.length > 60) notFound()

  const supabase = createServerClient()
  const config = await readTenantConfig(supabase, companyId)

  // If the tenant doesn't exist (stub returned), still render so the
  // operator can see the shape. But flag it clearly.
  const isStub = !config.active && !config.name.includes('·')

  // Per-table row counts (head:true = count-only, no data transfer).
  // Wrapped in try/catch so a single bad table doesn't crash the page.
  async function countRows(table: string): Promise<number | null> {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
      return count ?? 0
    } catch {
      return null
    }
  }

  const [
    traficosCount,
    entradasCount,
    expedientesCount,
    productosCount,
    partidasCount,
    leadsCount,
  ] = await Promise.all([
    countRows('traficos'),
    countRows('entradas'),
    countRows('expediente_documentos'),
    countRows('globalpc_productos'),
    countRows('globalpc_partidas'),
    // leads is broker-scoped (not tenant-scoped); query differently.
    (async () => {
      try {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('client_code_assigned', companyId)
        return count ?? 0
      } catch {
        return null
      }
    })(),
  ])

  const totalRowsAcrossTables =
    (traficosCount ?? 0) +
    (entradasCount ?? 0) +
    (expedientesCount ?? 0) +
    (productosCount ?? 0) +
    (partidasCount ?? 0)

  const accentVar = config.branding.accent_token ?? '--portal-gold-500'

  return (
    <PageShell
      title={config.branding.wordmark ?? config.name}
      subtitle={`Tenant · ${config.company_id} · ${config.active ? 'activo' : 'inactivo'}${isStub ? ' · sin fila en companies (stub)' : ''}`}
      maxWidth={1100}
    >
      {/* ── Identity + status row ───────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <AguilaMetric
          label="Estado"
          value={config.active ? 'Activo' : 'Inactivo'}
          tone={config.active ? 'positive' : 'attention'}
          sub={config.created_at ? fmtDate(config.created_at) : 'fecha desconocida'}
          mono={false}
        />
        <AguilaMetric
          label="Clave GlobalPC"
          value={config.clave_cliente ?? '—'}
          sub={config.clave_cliente ? 'wired to MySQL' : 'pendiente'}
          tone={config.clave_cliente ? 'neutral' : 'attention'}
        />
        <AguilaMetric
          label="RFC"
          value={config.rfc ?? '—'}
          sub={config.rfc ? 'SAT-issued' : 'pendiente'}
          tone={config.rfc ? 'neutral' : 'attention'}
        />
        <AguilaMetric
          label="Idioma"
          value={config.language === 'en' ? 'English' : 'Español'}
          mono={false}
        />
        <AguilaMetric
          label="Filas totales"
          value={totalRowsAcrossTables.toLocaleString('es-MX')}
          sub="entre 5 tablas · excluye leads"
        />
      </div>

      {/* ── Branding preview ────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionTitle>Branding</SectionTitle>
        <GlassCard tier="hero" padding={20} style={{ borderColor: `var(${accentVar})` }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 'var(--portal-r-3)',
                background: `var(${accentVar})`,
                opacity: 0.2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div
                style={{
                  fontSize: 'var(--portal-fs-lg)',
                  fontWeight: 600,
                  color: `var(${accentVar})`,
                  marginBottom: 4,
                }}
              >
                {config.branding.wordmark ?? config.name}
              </div>
              <div
                style={{
                  fontSize: 'var(--portal-fs-tiny)',
                  color: 'var(--portal-fg-4)',
                  fontFamily: 'var(--portal-font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                accent · {accentVar}
                {config.branding.logo_url && ` · logo · ${config.branding.logo_url}`}
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ── Feature flags ───────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionTitle>Feature flags</SectionTitle>
        <GlassCard tier="hero" padding={18}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            <FeatureChip label="cruz_ai" on={config.features.cruz_ai} />
            <FeatureChip label="mi_cuenta" on={config.features.mi_cuenta} />
            <FeatureChip
              label="mensajeria_client"
              on={config.features.mensajeria_client}
            />
            <FeatureChip
              label="white_label_surfaces"
              on={config.features.white_label_surfaces}
            />
          </div>
        </GlassCard>
      </section>

      {/* ── Row counts per table ────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionTitle>Row counts (tenant-scoped)</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 10,
          }}
        >
          <TableCount table="traficos" count={traficosCount} />
          <TableCount table="entradas" count={entradasCount} />
          <TableCount table="expediente_documentos" count={expedientesCount} />
          <TableCount table="globalpc_productos" count={productosCount} />
          <TableCount table="globalpc_partidas" count={partidasCount} />
          <TableCount table="leads (convertidos)" count={leadsCount} />
        </div>
      </section>

      {/* ── Deep links ──────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionTitle>Surfaces</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          <DeepLinkCard
            href={`/admin/intelligence?company_id=${encodeURIComponent(companyId)}`}
            label="Intelligence"
            sub="Señales · rachas · anomalías"
          />
          <DeepLinkCard
            href={`/catalogo?company_id=${encodeURIComponent(companyId)}`}
            label="Catálogo"
            sub="Partes activas · Anexo 24 overlay"
          />
          <DeepLinkCard
            href="/admin/monitor/tenants"
            label="Monitor (aggregate)"
            sub="Todos los tenants · 60s refresh"
          />
        </div>
      </section>

      {totalRowsAcrossTables === 0 && (
        <GlassCard tier="secondary" padding={20}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--portal-fs-sm)',
              color: 'var(--portal-fg-3)',
              lineHeight: 1.5,
            }}
          >
            Sin datos aún para este tenant. Para probar la capa de
            intelligence con datos demo, ejecuta el script operador:{' '}
            <code
              style={{
                fontFamily: 'var(--portal-font-mono)',
                fontSize: 'var(--portal-fs-tiny)',
                color: 'var(--portal-fg-2)',
              }}
            >
              node scripts/mafesa-seed-demo-data.mjs
            </code>
          </p>
        </GlassCard>
      )}

      <p
        style={{
          marginTop: 32,
          fontSize: 'var(--portal-fs-tiny)',
          color: 'var(--portal-fg-5)',
          fontFamily: 'var(--portal-font-mono)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        V2 white-label foundation · readTenantConfig ·{' '}
        <Link
          href="/admin/monitor/tenants"
          style={{ color: 'var(--portal-fg-3)' }}
        >
          ← ver monitor agregado
        </Link>
      </p>
    </PageShell>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="portal-eyebrow"
      style={{
        fontSize: 'var(--portal-fs-label)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--portal-fg-4)',
        margin: '0 0 12px',
      }}
    >
      {children}
    </h2>
  )
}

function FeatureChip({ label, on }: { label: string; on: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: on
          ? 'var(--portal-status-green-bg)'
          : 'var(--portal-ink-3)',
        border: `1px solid ${on ? 'var(--portal-status-green-ring)' : 'var(--portal-line-2)'}`,
        borderRadius: 'var(--portal-r-3)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: on
            ? 'var(--portal-status-green-fg)'
            : 'var(--portal-fg-5)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--portal-font-mono)',
          fontSize: 'var(--portal-fs-tiny)',
          color: on ? 'var(--portal-fg-1)' : 'var(--portal-fg-4)',
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function TableCount({ table, count }: { table: string; count: number | null }) {
  return (
    <GlassCard padding="12px 14px">
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--portal-fs-tiny)',
            color: 'var(--portal-fg-4)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'var(--portal-font-mono)',
          }}
        >
          {table}
        </p>
        <p
          className="portal-num"
          style={{
            margin: '4px 0 0',
            fontSize: 'var(--portal-fs-lg)',
            fontWeight: 700,
            color: count === null ? 'var(--portal-fg-5)' : 'var(--portal-fg-1)',
          }}
        >
          {count === null
            ? '—'
            : count.toLocaleString('es-MX')}
        </p>
      </div>
    </GlassCard>
  )
}

function DeepLinkCard({
  href,
  label,
  sub,
}: {
  href: string
  label: string
  sub: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
      }}
    >
      <GlassCard tier="secondary" padding={16}>
        <div
          style={{
            fontSize: 'var(--portal-fs-md)',
            fontWeight: 600,
            color: 'var(--portal-fg-1)',
            marginBottom: 4,
          }}
        >
          {label} →
        </div>
        <div
          style={{
            fontSize: 'var(--portal-fs-tiny)',
            color: 'var(--portal-fg-4)',
          }}
        >
          {sub}
        </div>
      </GlassCard>
    </Link>
  )
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}
