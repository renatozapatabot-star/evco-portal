/**
 * PORTAL · /admin/trade-index — read-only Trade Index dashboard.
 *
 * Admin/broker only. Surfaces three reads:
 *   1. Fleet snapshot (weighted avg, p10/p90, TMEC, shipments across
 *      90-day window — from mv_trade_index_lane_90d aggregates).
 *   2. Lane leaderboard — top-N lanes by shipment count, pulled through
 *      v_trade_index_public so k-anonymity (≥3 distinct companies per
 *      lane) is view-level enforced.
 *   3. Client ranking — per-company rollup from client_benchmarks
 *      (latest period) joined to companies.name, ordered by percentile.
 *
 * Not in UNIFIED_NAV_TILES (rule 29 is SOFT but we ship V1 without a
 * nav card — reachable via direct URL + CruzCommand).
 *
 * Read-only V1. No manual refresh button; cron owns the MV refresh
 * (refresh-trade-index at 02:45 CST via PM2).
 *
 * Server component · revalidates every 60s (the MV refreshes nightly,
 * but a per-request freshness window surfaces drift quickly).
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  readFleetSnapshot,
  readLaneLeaderboard,
  readClientRanking,
  type LaneRow,
  type ClientRankingRow,
} from '@/lib/trade-index/query'
import { PageShell, GlassCard, AguilaDataTable } from '@/components/aguila'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const ADMIN_ROLES = new Set(['admin', 'broker'])

export default async function TradeIndexAdminPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!ADMIN_ROLES.has(session.role)) redirect('/')

  const supabase = createServerClient()

  const [snapshot, lanes, ranking] = await Promise.all([
    readFleetSnapshot(supabase),
    readLaneLeaderboard(supabase, { limit: 25, sortBy: 'shipments_desc' }),
    readClientRanking(supabase, { limit: 50 }),
  ])

  return (
    <PageShell
      title="Trade Index"
      subtitle="Ventana rodante 90 días · refresh nightly a las 02:45 CT · k-anon ≥3 clientes por corredor"
      maxWidth={1200}
    >
      <FleetSnapshotCard snapshot={snapshot} />
      <LaneLeaderboardCard lanes={lanes} />
      <ClientRankingCard ranking={ranking} />
    </PageShell>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Fleet snapshot — 6 KPI tiles of weighted-across-lanes numbers.
// ──────────────────────────────────────────────────────────────────────

function FleetSnapshotCard({ snapshot }: { snapshot: Awaited<ReturnType<typeof readFleetSnapshot>> }) {
  const tiles = [
    {
      label: 'Cruces · 90 días',
      value: snapshot.has_data ? fmtInt(snapshot.shipment_count) : '—',
      sub: snapshot.has_data ? `${fmtInt(snapshot.distinct_lanes)} corredores` : 'Sin datos aún',
    },
    {
      label: 'Promedio (días)',
      value: fmtDays(snapshot.avg_clearance_days),
      sub: snapshot.median_clearance_days != null
        ? `Mediana ${fmtDays(snapshot.median_clearance_days)}`
        : '',
    },
    {
      label: 'p10 (rápidos)',
      value: fmtDays(snapshot.p10_clearance_days),
      sub: '10% más rápidos',
    },
    {
      label: 'p90 (lentos)',
      value: fmtDays(snapshot.p90_clearance_days),
      sub: '10% más lentos',
    },
    {
      label: 'T-MEC',
      value: fmtPct(snapshot.tmec_rate),
      sub: 'Elegibles T-MEC',
    },
    {
      label: 'Valor USD',
      value: fmtCompactUSD(snapshot.total_value_usd),
      sub: '90 días',
    },
  ]

  return (
    <GlassCard tier="hero" style={{ marginBottom: 16 }}>
      <h2 className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)', marginBottom: 12 }}>
        Flota · últimos 90 días
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ padding: 10 }}>
            <div className="portal-eyebrow" style={{ color: 'var(--portal-fg-4)' }}>{t.label}</div>
            <div className="portal-num" style={{ fontSize: 'var(--portal-fs-lg)', fontWeight: 500 }}>
              {t.value}
            </div>
            {t.sub && (
              <div style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--portal-fs-xs)', marginTop: 2 }}>
                {t.sub}
              </div>
            )}
          </div>
        ))}
      </div>
      {snapshot.period && (
        <div style={{ marginTop: 8, color: 'var(--portal-fg-4)', fontSize: 'var(--portal-fs-xs)' }}>
          Último refresh: {formatComputed(snapshot.period)}
        </div>
      )}
    </GlassCard>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Lane leaderboard — top-N lanes from the k-anon public view.
// ──────────────────────────────────────────────────────────────────────

function LaneLeaderboardCard({ lanes }: { lanes: LaneRow[] }) {
  return (
    <GlassCard tier="hero" style={{ marginBottom: 16 }}>
      <h2 className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)', marginBottom: 12 }}>
        Corredores · top {lanes.length} por volumen
      </h2>
      <p style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--portal-fs-sm)', margin: '0 0 12px' }}>
        Solo corredores con <b>≥3 clientes distintos</b> aparecen aquí (k-anonimato).
      </p>
      <AguilaDataTable
        ariaLabel="Lane leaderboard — top corridors by shipment count"
        columns={[
          {
            key: 'aduana',
            label: 'Aduana',
            render: (r) => (
              <span style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-2)' }}>
                {r.aduana}
              </span>
            ),
          },
          {
            key: 'oficina',
            label: 'Oficina',
            render: (r) => (
              <span style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-3)' }}>
                {r.oficina}
              </span>
            ),
          },
          { key: 'shipment_count', label: 'Cruces', type: 'number' },
          { key: 'distinct_company_count', label: 'Clientes', type: 'number' },
          {
            key: 'avg_clearance_days',
            label: 'Prom. días',
            render: (r) => <MonoNumber value={r.avg_clearance_days} decimals={2} />,
          },
          {
            key: 'p10_clearance_days',
            label: 'p10',
            render: (r) => <MonoNumber value={r.p10_clearance_days} decimals={2} />,
          },
          {
            key: 'p90_clearance_days',
            label: 'p90',
            render: (r) => <MonoNumber value={r.p90_clearance_days} decimals={2} />,
          },
          {
            key: 'tmec_rate',
            label: 'T-MEC',
            render: (r) => <MonoNumber value={r.tmec_rate != null ? r.tmec_rate * 100 : null} decimals={1} suffix="%" />,
          },
        ]}
        rows={lanes}
        keyFor={(r) => `${r.aduana}-${r.oficina}`}
      />
    </GlassCard>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Client ranking — per-company rollup, latest period.
// ──────────────────────────────────────────────────────────────────────

function ClientRankingCard({ ranking }: { ranking: ClientRankingRow[] }) {
  return (
    <GlassCard tier="hero">
      <h2 className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)', marginBottom: 12 }}>
        Ranking de clientes · por percentil
      </h2>
      <p style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--portal-fs-sm)', margin: '0 0 12px' }}>
        Percentil 100 = cliente más rápido de la flota · período último disponible.
      </p>
      <AguilaDataTable
        ariaLabel="Ranking de clientes por percentil de cruce"
        columns={[
          {
            key: 'company_id',
            label: 'company_id',
            render: (r) => (
              <span style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-2)' }}>
                {r.company_id}
              </span>
            ),
          },
          {
            key: 'company_name',
            label: 'Cliente',
            render: (r) => (
              <span style={{ color: 'var(--portal-fg-2)' }}>
                {r.company_name ?? '—'}
              </span>
            ),
          },
          { key: 'shipment_count', label: 'Cruces', type: 'number' },
          {
            key: 'avg_clearance_days',
            label: 'Prom. días',
            render: (r) => <MonoNumber value={r.avg_clearance_days} decimals={2} />,
          },
          {
            key: 'percentile',
            label: 'Percentil',
            render: (r) => <MonoNumber value={r.percentile} decimals={0} />,
          },
          {
            key: 'tmec_rate',
            label: 'T-MEC',
            render: (r) => <MonoNumber value={r.tmec_rate != null ? r.tmec_rate * 100 : null} decimals={1} suffix="%" />,
          },
        ]}
        rows={ranking}
        keyFor={(r) => r.company_id}
      />
    </GlassCard>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Presentation helpers
// ──────────────────────────────────────────────────────────────────────

function MonoNumber({
  value,
  decimals,
  suffix,
}: {
  value: number | null | undefined
  decimals: number
  suffix?: string
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span style={{ color: 'var(--portal-fg-5)' }}>—</span>
  }
  return (
    <span
      className="portal-num"
      style={{ fontFamily: 'var(--portal-font-mono)', color: 'var(--portal-fg-2)' }}
    >
      {value.toFixed(decimals)}
      {suffix ?? ''}
    </span>
  )
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-MX')
}

function fmtDays(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(2)} d`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function fmtCompactUSD(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatComputed(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}
