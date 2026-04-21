/**
 * /admin/intelligence — V2 intelligence dashboard (operator-only).
 *
 * First surface of the V2 intelligence layer. Reads rule-based
 * signals computed by lib/intelligence/crossing-insights and
 * renders them as AguilaInsightCard + AguilaStreakBar compositions.
 *
 * Admin/broker only. When admin passes ?company_id= it inspects
 * another tenant's insights (oversight path — same as catalogo
 * parte-detail).
 *
 * NOT client-facing. EVCO + other client-role sessions never reach
 * this route (redirect in the admin layout / this check).
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  PageShell,
  GlassCard,
  AguilaMetric,
  AguilaInsightCard,
  AguilaStreakBar,
} from '@/components/aguila'
import {
  getCrossingInsights,
  type InsightsPayload,
} from '@/lib/intelligence/crossing-insights'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface SearchParams {
  company_id?: string
  window?: string
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const params = await searchParams
  const paramCompany = params.company_id?.trim()
  const windowDays = Math.max(
    7,
    Math.min(365, Number.parseInt(params.window ?? '90', 10) || 90),
  )
  const companyId = paramCompany || session.companyId

  const supabase = createServerClient()
  let insights: InsightsPayload
  try {
    insights = await getCrossingInsights(supabase, companyId, { windowDays })
  } catch {
    insights = {
      generated_at: new Date().toISOString(),
      company_id: companyId,
      green_streaks: [],
      broken_streaks: [],
      top_proveedores: [],
      watch_proveedores: [],
      anomalies: [],
    }
  }

  const totalSignals =
    insights.green_streaks.length +
    insights.broken_streaks.length +
    insights.watch_proveedores.length +
    insights.anomalies.length

  return (
    <PageShell
      title="Intelligence · Cruzó Verde"
      subtitle={`Señales automáticas sobre ${insights.company_id} · ventana ${windowDays} días · generado ${fmtWhen(insights.generated_at)}`}
      maxWidth={1100}
    >
      {/* Hero metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <AguilaMetric
          label="Rachas verdes"
          value={String(insights.green_streaks.length)}
          tone={insights.green_streaks.length > 0 ? 'positive' : 'neutral'}
          sub="SKUs con ≥ 3 cruces verdes seguidos"
        />
        <AguilaMetric
          label="Rachas rotas"
          value={String(insights.broken_streaks.length)}
          tone={insights.broken_streaks.length > 0 ? 'attention' : 'neutral'}
          sub="últimos 30 días"
        />
        <AguilaMetric
          label="Proveedores top"
          value={String(insights.top_proveedores.length)}
          tone={insights.top_proveedores.length > 0 ? 'positive' : 'neutral'}
          sub="≥ 90% verde · 5+ cruces"
        />
        <AguilaMetric
          label="Anomalías"
          value={String(insights.anomalies.length)}
          tone={insights.anomalies.length > 0 ? 'attention' : 'neutral'}
          sub="semana vs. semana anterior"
        />
      </div>

      {totalSignals === 0 && (
        <GlassCard tier="hero" padding={24}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--portal-fs-sm)',
              color: 'var(--portal-fg-3)',
            }}
          >
            Sin señales en este período. El motor necesita al menos 3 cruces
            verdes por SKU para detectar una racha, y 3 cruces por proveedor
            por semana para comparar semáforos. Amplía la ventana para ver
            señales históricas.
          </p>
        </GlassCard>
      )}

      {/* Green streak opportunities */}
      {insights.green_streaks.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionTitle>Oportunidades · SKUs en racha verde</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {insights.green_streaks.map((s) => (
              <AguilaInsightCard
                key={`streak-${s.cve_producto}`}
                tone="opportunity"
                eyebrow={`${s.current_verde_streak} verdes seguidos`}
                headline={s.cve_producto}
                body={`${s.total_crossings} cruces en los últimos ${windowDays} días · record ${s.longest_verde_streak} verdes.`}
                meta={
                  s.last_fecha_cruce
                    ? `Último · ${fmtDateShort(s.last_fecha_cruce)}`
                    : undefined
                }
                action={{
                  label: 'Ver parte',
                  href: `/catalogo/partes/${encodeURIComponent(s.cve_producto)}`,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Broken streaks — watch */}
      {insights.broken_streaks.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionTitle>Atención · Rachas rotas últimos 30 días</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {insights.broken_streaks.map((s) => (
              <AguilaInsightCard
                key={`broken-${s.cve_producto}`}
                tone="watch"
                eyebrow={`Racha de ${s.longest_verde_streak} rota`}
                headline={s.cve_producto}
                body={`Último cruce ${labelSemaforo(s.last_semaforo)} · worth investigating.`}
                visual={
                  <AguilaStreakBar
                    values={[]}
                    label={`Racha rota en ${s.cve_producto}`}
                  />
                }
                meta={
                  s.last_fecha_cruce
                    ? `Último · ${fmtDateShort(s.last_fecha_cruce)}`
                    : undefined
                }
                action={{
                  label: 'Ver parte',
                  href: `/catalogo/partes/${encodeURIComponent(s.cve_producto)}`,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Proveedor health */}
      {(insights.top_proveedores.length > 0 || insights.watch_proveedores.length > 0) && (
        <section style={{ marginBottom: 24 }}>
          <SectionTitle>Salud de proveedores</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {insights.top_proveedores.map((p) => (
              <AguilaInsightCard
                key={`top-${p.cve_proveedor}`}
                tone="opportunity"
                eyebrow="Proveedor estrella"
                headline={p.cve_proveedor}
                body={`${p.pct_verde}% verde en ${p.total_crossings} cruces (${p.verde_count}/${p.total_crossings}).`}
                meta={
                  p.last_fecha_cruce
                    ? `Último · ${fmtDateShort(p.last_fecha_cruce)}`
                    : undefined
                }
              />
            ))}
            {insights.watch_proveedores.map((p) => (
              <AguilaInsightCard
                key={`watch-${p.cve_proveedor}`}
                tone="watch"
                eyebrow="Proveedor en watch"
                headline={p.cve_proveedor}
                body={`${p.pct_verde}% verde en ${p.total_crossings} cruces · considera revisar su flujo con él.`}
                meta={
                  p.last_fecha_cruce
                    ? `Último · ${fmtDateShort(p.last_fecha_cruce)}`
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Rule-based anomalies */}
      {insights.anomalies.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionTitle>Anomalías · reglas aplicadas automáticamente</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {insights.anomalies.slice(0, 8).map((a, i) => (
              <AguilaInsightCard
                key={`anomaly-${i}`}
                tone={a.score >= 0.6 ? 'anomaly' : 'watch'}
                eyebrow={a.kind.replace(/_/g, ' ')}
                headline={a.subject}
                body={a.detail}
                meta={`Score · ${(a.score * 100).toFixed(0)}%`}
                action={
                  a.kind === 'streak_break'
                    ? {
                        label: 'Ver parte',
                        href: `/catalogo/partes/${encodeURIComponent(a.subject)}`,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </section>
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
        V2 intelligence · rule-based signals · no ML · refresco cada 60s ·{' '}
        <Link
          href="/admin/intelligence?window=30"
          style={{ color: 'var(--portal-fg-3)' }}
        >
          30d
        </Link>{' '}
        ·{' '}
        <Link
          href="/admin/intelligence?window=90"
          style={{ color: 'var(--portal-fg-3)' }}
        >
          90d
        </Link>{' '}
        ·{' '}
        <Link
          href="/admin/intelligence?window=180"
          style={{ color: 'var(--portal-fg-3)' }}
        >
          180d
        </Link>
      </p>
    </PageShell>
  )
}

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

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

function labelSemaforo(v: number | null): string {
  if (v === 0) return 'verde'
  if (v === 1) return 'amarillo'
  if (v === 2) return 'rojo'
  return 'sin clasificar'
}
