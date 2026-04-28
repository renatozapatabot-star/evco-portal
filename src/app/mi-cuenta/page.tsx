/**
 * CRUZ · /mi-cuenta — client-facing accounting surface.
 *
 * Governed by `.claude/rules/client-accounting-ethics.md`:
 *   - Client sees ONLY their own A/R with us (tenant-scoped).
 *   - Calm tone · no traffic-light dunning colors.
 *   - Mensajería CTA to Anabel paired with every A/R number.
 *   - Internal roles (admin/operator/broker/contabilidad) route through
 *     here for QA but see broker-wide aggregate — not surfaced to
 *     clients.
 *
 * Feature-gated by `NEXT_PUBLIC_MI_CUENTA_ENABLED`. Default OFF for
 * client role until Tito walks through the preview. Internal roles
 * always reach the page (no flag check for them).
 *
 * Tenant isolation: reads `session.companyId` from the HMAC session.
 * Never trusts URL params or cookies for tenancy. Cross-tenant attempt
 * would render zero rows since `computeARAging` filters via the
 * `companies.clave_cliente` join.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Receipt, ArrowLeft } from 'lucide-react'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { computeARAging, type AgingResult } from '@/lib/contabilidad/aging'
import { readFreshness } from '@/lib/cockpit/freshness'
import { computeQuickInsights } from '@/lib/mi-cuenta/quick-insights'
import { resolveMiCuentaAccess } from './access'
import { QuickInsightsCard } from './QuickInsightsCard'
import {
  PageShell,
  GlassCard,
  SectionHeader,
  CockpitErrorCard,
  FreshnessBanner,
  KPITile,
} from '@/components/aguila'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CLIENT_FEATURE_FLAG = process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED === 'true'

function fmtMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtCompactMXN(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.0', '')}M MXN`
  if (n >= 10_000) return `$${Math.round(n / 1_000)}K MXN`
  return fmtMXN(n)
}

function formatEmission(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function MiCuentaPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  // Authorization contract lives in ./access.ts — unit-tested via
  // __tests__/isolation.test.ts per client-accounting-ethics.md §7.
  const access = resolveMiCuentaAccess(session, CLIENT_FEATURE_FLAG)
  if (access.decision === 'redirect') {
    redirect(access.to)
  }
  // access.decision === 'render' implies session was non-null (resolver
  // returns redirect otherwise) — narrow for downstream uses (recordView
  // needs session.role).
  if (!session) redirect('/login')
  const { isClient, scopedCompanyId, companyId } = access

  const supabase = createServerClient()

  // Data fetch isolated from render — keep JSX out of try/catch so React
  // render-phase exceptions route to error.tsx (the error boundary)
  // rather than being swallowed here (react-hooks/error-boundaries rule).
  type FetchSuccess = {
    ok: true
    ar: Awaited<ReturnType<typeof computeARAging>>
    freshness: Awaited<ReturnType<typeof readFreshness>>
    name: string
    insights: Awaited<ReturnType<typeof computeQuickInsights>>
  }
  type FetchFailure = { ok: false; message: string }
  const fetched: FetchSuccess | FetchFailure = await (async () => {
    try {
      const [ar, freshness, name] = await Promise.all([
        computeARAging(supabase, scopedCompanyId),
        readFreshness(supabase, companyId),
        readDisplayName(supabase, companyId),
      ])
      // Quick Insights reads aging as context for the proactive copy,
      // so we sequence it after the parallel fetch. Its own queries
      // are soft-wrapped — one failing signal never blocks the card.
      const insights = await computeQuickInsights(supabase, companyId, ar)
      return { ok: true, ar, freshness, name, insights }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const digest =
        typeof err === 'object' && err !== null && 'digest' in err
          ? String((err as { digest?: unknown }).digest ?? '')
          : ''
      if (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND' || msg === 'NEXT_REDIRECT') {
        throw err
      }
      return { ok: false, message: msg }
    }
  })()

  if (!fetched.ok) {
    return <CockpitErrorCard message={`No se pudo cargar tu cuenta: ${fetched.message}`} />
  }

  const { ar, freshness, name, insights } = fetched

  // Fire-and-forget audit log — records WHO viewed, not WHAT they saw.
  // Failures swallowed to avoid blocking the render path. See
  // client-accounting-ethics.md §7 (audit contract).
  void recordView(supabase, session, isClient)

  return (
    <PageShell
      title={isClient ? 'Tu cuenta' : 'Vista broker · Tu cuenta'}
      subtitle={isClient ? name : 'Agregado · vista interna'}
    >
      {freshness.hasData && <FreshnessBanner reading={freshness} />}

      {/* Hero KPIs — silver chrome, no severity, no urgency colors.
          Aging buckets render in calm silver per ethics contract §tone. */}
      <HeroStrip ar={ar} isClient={isClient} />

      {/* Quick Insights — automation score + shipments this month + one
          proactive copy line. Client surface shows the chat deep-link;
          broker-internal view hides it (they use /operador/cruz). */}
      <QuickInsightsCard insights={insights} showChatCta={isClient} />

      {/* Aging breakdown */}
      <AgingSection ar={ar} isClient={isClient} />

      {/* Open invoices — the top debtors slice, relabeled for the
          client surface. No "overdue" language; days since emission. */}
      <OpenInvoicesSection ar={ar} isClient={isClient} />

      {/* Always-paired Mensajería CTA — Anabel is the human for anything
          the numbers don't explain. */}
      <MensajeriaCta isClient={isClient} />

      {/* Back link — calm escape hatch to /inicio. Client only. */}
      {isClient && (
        <div style={{ marginTop: 'var(--aguila-gap-section, 32px)', textAlign: 'center' }}>
          <Link
            href="/inicio"
            style={{
              color: 'var(--aguila-text-muted)',
              fontSize: 'var(--aguila-fs-meta, 11px)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowLeft size={12} />
            Volver al inicio
          </Link>
        </div>
      )}
    </PageShell>
  )
}

async function readDisplayName(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from('companies')
      .select('name')
      .eq('company_id', companyId)
      .maybeSingle()
    return (data as { name: string | null } | null)?.name ?? 'Tu cuenta'
  } catch {
    return 'Tu cuenta'
  }
}

async function recordView(
  supabase: ReturnType<typeof createServerClient>,
  session: { companyId: string; role: string },
  isClient: boolean,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      action: 'client_accounting_viewed',
      table_name: 'econta_cartera',
      record_id: session.companyId,
      company_id: session.companyId,
      metadata: { role: session.role, scoped: isClient },
    })
  } catch {
    // intentional — view logging never blocks render
  }
}

function HeroStrip({ ar, isClient }: { ar: AgingResult; isClient: boolean }) {
  const heroKPIs: Array<{ key: string; label: string; value: string; sublabel?: string }> = [
    {
      key: 'saldo',
      label: isClient ? 'Saldo pendiente' : 'Saldo agregado',
      value: fmtCompactMXN(ar.total),
      sublabel: `${ar.count} factura${ar.count === 1 ? '' : 's'}`,
    },
    {
      key: 'aging-0-30',
      label: '0-30 días',
      value: fmtCompactMXN(ar.byBucket.find((b) => b.bucket === '0-30')?.amount ?? 0),
      sublabel: `${ar.byBucket.find((b) => b.bucket === '0-30')?.count ?? 0} facturas`,
    },
    {
      key: 'aging-31-60',
      label: '31-60 días',
      value: fmtCompactMXN(ar.byBucket.find((b) => b.bucket === '31-60')?.amount ?? 0),
      sublabel: `${ar.byBucket.find((b) => b.bucket === '31-60')?.count ?? 0} facturas`,
    },
    {
      key: 'aging-61+',
      label: '61+ días',
      value: fmtCompactMXN(
        (ar.byBucket.find((b) => b.bucket === '61-90')?.amount ?? 0) +
          (ar.byBucket.find((b) => b.bucket === '90+')?.amount ?? 0),
      ),
      sublabel: `${
        (ar.byBucket.find((b) => b.bucket === '61-90')?.count ?? 0) +
        (ar.byBucket.find((b) => b.bucket === '90+')?.count ?? 0)
      } facturas`,
    },
  ]

  return (
    <>
      {/* Previous iteration set the data attribute on a `display:contents`
          span inside the grid, so the breakpoint never actually re-columned
          the grid itself. Attribute now lives on the grid container — at
          ≤1024px it falls to 2×2, at ≤480px it stacks for the 3 AM Driver
          standard. */}
      <style>{`
        [data-mi-cuenta-hero] {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--aguila-gap-card, 16px);
          margin-bottom: var(--aguila-gap-card, 16px);
        }
        @media (max-width: 1024px) {
          [data-mi-cuenta-hero] { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          [data-mi-cuenta-hero] { grid-template-columns: 1fr; }
        }
      `}</style>
      <div data-mi-cuenta-hero>
        {heroKPIs.map((k) => (
          <KPITile
            key={k.key}
            label={k.label}
            value={k.value}
            sublabel={k.sublabel}
            tone="silver"
          />
        ))}
      </div>
    </>
  )
}

function AgingSection({ ar, isClient }: { ar: AgingResult; isClient: boolean }) {
  if (ar.count === 0) {
    return (
      <GlassCard padding={20}>
        <SectionHeader title={isClient ? 'Tu cuenta está al corriente' : 'Sin saldos abiertos'} />
        <p
          style={{
            color: 'var(--aguila-text-muted)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            margin: '8px 0 0',
          }}
        >
          {isClient
            ? 'No hay facturas con saldo pendiente en este momento.'
            : 'No hay saldos agregados abiertos en este momento.'}
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding={20}>
      <SectionHeader
        title={isClient ? 'Tu saldo por rango de días' : 'Saldo por rango de días'}
        count={ar.count}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aguila-gap-stack, 12px)', marginTop: 12 }}>
        {ar.byBucket.map((b) => (
          <div
            key={b.bucket}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr auto',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 'var(--aguila-fs-label, 10px)',
                letterSpacing: 'var(--aguila-ls-label, 0.08em)',
                textTransform: 'uppercase',
                color: 'var(--aguila-text-muted)',
              }}
            >
              {b.bucket} días
            </span>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'rgba(192,197,206,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (b.amount / Math.max(1, ar.total)) * 100)}%`,
                  background: 'rgba(192,197,206,0.45)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmtMXN(b.amount)}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function OpenInvoicesSection({ ar, isClient }: { ar: AgingResult; isClient: boolean }) {
  if (ar.topDebtors.length === 0) return null

  return (
    <GlassCard padding={20}>
      <SectionHeader
        title={isClient ? 'Tus facturas abiertas principales' : 'Top 5 saldos abiertos'}
        count={ar.topDebtors.length}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aguila-gap-stack, 12px)', marginTop: 12 }}>
        {ar.topDebtors.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 12,
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}
            </span>
            <span
              style={{
                fontSize: 'var(--aguila-fs-meta, 11px)',
                color: 'var(--aguila-text-muted)',
              }}
            >
              {d.daysOverdue} día{d.daysOverdue === 1 ? '' : 's'}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                fontVariantNumeric: 'tabular-nums',
                textAlign: 'right',
                minWidth: 100,
              }}
            >
              {fmtMXN(d.amount)}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function MensajeriaCta({ isClient }: { isClient: boolean }) {
  if (!isClient) return null
  return (
    <div style={{ marginTop: 'var(--aguila-gap-section, 32px)' }}>
      <GlassCard padding={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(192,197,206,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MessageSquare size={18} color="var(--aguila-text-muted)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--aguila-fs-body, 13px)',
                color: 'var(--aguila-text-primary)',
                marginBottom: 4,
              }}
            >
              ¿Dudas sobre tu cuenta?
            </div>
            <div
              style={{
                fontSize: 'var(--aguila-fs-meta, 11px)',
                color: 'var(--aguila-text-muted)',
              }}
            >
              Anabel te responde. Escríbele por Mensajería.
            </div>
          </div>
          <Link
            href="/mensajeria?to=anabel&topic=cuenta"
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(192,197,206,0.18)',
              background: 'rgba(192,197,206,0.06)',
              color: 'var(--aguila-text-primary)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              textDecoration: 'none',
              minHeight: 60,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            <MessageSquare size={14} />
            Abrir chat
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}
