/**
 * TradeIndexCard — client-facing "how do you compare" card for /mi-cuenta.
 *
 * Governed by .claude/rules/client-accounting-ethics.md §tone:
 *   - Silver chrome only — no red/amber, no urgency colors.
 *   - Calm possessive copy ("Tu posición", "Tu flota") — never
 *     accusatory ("overdue", "slower than peers").
 *   - Mensajería CTA paired with the number ("Anabel te explica").
 *
 * K-anonymity contract (.claude/rules/tenant-isolation.md):
 *   - Only renders a comparison when readClientPosition returns
 *     meets_k_anon=true (≥3 distinct companies on at least one of
 *     the client's lanes). Otherwise shows a "aún no hay datos
 *     suficientes" stub — zero cross-tenant inference possible.
 *   - Data primitive enforces a MIN_CLIENT_SHIPMENTS (3) +
 *     MIN_FLEET_SAMPLE (10) floor before has_data flips true, so
 *     tiny cohorts never produce a card with misleading numbers.
 *
 * Server component. Reads via the service-role client the page
 * already instantiates (passed in via prop so we don't create a
 * second client per render).
 */

import Link from 'next/link'
import { GlassCard, SectionHeader } from '@/components/aguila'
import type { ClientPosition } from '@/lib/trade-index/query'

export type TradeIndexCardProps = {
  position: ClientPosition
  isClient: boolean
}

export function TradeIndexCard({ position, isClient }: TradeIndexCardProps) {
  // Empty / insufficient data — calm placeholder, no numbers.
  if (!position.has_data) {
    return (
      <GlassCard padding={20}>
        <SectionHeader
          title={isClient ? 'Tu posición vs la flota' : 'Posición vs flota'}
        />
        <p
          style={{
            color: 'var(--aguila-text-muted)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            margin: '8px 0 0',
          }}
        >
          Aún no hay datos suficientes para comparar. Se actualizará pronto.
        </p>
      </GlassCard>
    )
  }

  // K-anon not met — don't surface comparative numbers; only the
  // client's own aggregate (no inference possible about specific peers).
  if (!position.meets_k_anon) {
    return (
      <GlassCard padding={20}>
        <SectionHeader
          title={isClient ? 'Tu posición vs la flota' : 'Posición vs flota'}
        />
        <p
          style={{
            color: 'var(--aguila-text-muted)',
            fontSize: 'var(--aguila-fs-body, 13px)',
            margin: '8px 0 12px',
          }}
        >
          Comparación próximamente. Tu corredor aún no tiene suficientes
          clientes cruzando para generar un rango de flota confiable.
        </p>
        <ClientOnlyStat position={position} />
      </GlassCard>
    )
  }

  const pctLabel = formatPercentile(position.client.percentile)

  return (
    <GlassCard padding={20}>
      <SectionHeader title={isClient ? 'Tu posición vs la flota' : 'Posición vs flota'} />

      {/* Hero line — "Tu cruce promedio" vs fleet */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--aguila-gap-card, 16px)',
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Tu promedio"
          value={formatDays(position.client.avg_clearance_days)}
          sub={`${position.client.shipment_count} cruces`}
        />
        <Stat
          label="Flota promedio"
          value={formatDays(position.fleet.avg_clearance_days)}
          sub={`${fmtSample(position.fleet.sample_size)} muestras`}
        />
        <Stat label="Tu percentil" value={pctLabel} sub={percentileSub(position.client.percentile)} />
      </div>

      {/* Percentile bar — silver-on-silver, no severity colors */}
      <PercentileBar
        percentile={position.client.percentile}
        p10={position.fleet.p10_clearance_days}
        p90={position.fleet.p90_clearance_days}
      />

      {/* T-MEC row */}
      {position.client.tmec_rate != null && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderTop: '1px solid rgba(255,255,255,0.04)',
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
            Elegibilidad T-MEC
          </span>
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: 'var(--aguila-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {(position.client.tmec_rate * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Paired Anabel CTA — calm, always present */}
      {isClient && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'var(--aguila-text-muted)',
            }}
          >
            ¿Cómo se calcula? Anabel te explica.
          </span>
          <Link
            href="/mensajeria?to=anabel&topic=trade-index"
            style={{
              fontSize: 'var(--aguila-fs-meta, 11px)',
              color: 'var(--aguila-text-primary)',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(192,197,206,0.2)',
              paddingBottom: 1,
            }}
          >
            Abrir chat
          </Link>
        </div>
      )}
    </GlassCard>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          textTransform: 'uppercase',
          color: 'var(--aguila-text-muted)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
          fontSize: 'var(--aguila-fs-kpi-compact, 32px)',
          fontWeight: 600,
          color: 'var(--aguila-text-primary)',
          letterSpacing: 'var(--aguila-ls-tight, -0.03em)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'var(--aguila-text-muted)',
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function ClientOnlyStat({ position }: { position: ClientPosition }) {
  return (
    <div style={{ display: 'flex', gap: 24, marginTop: 4 }}>
      <Stat
        label="Tu promedio"
        value={formatDays(position.client.avg_clearance_days)}
        sub={`${position.client.shipment_count} cruces · 90 días`}
      />
      {position.client.tmec_rate != null && (
        <Stat
          label="T-MEC"
          value={`${(position.client.tmec_rate * 100).toFixed(1)}%`}
        />
      )}
    </div>
  )
}

/**
 * PercentileBar — horizontal silver rail with:
 *   - two dashed markers at p10 (left) and p90 (right) fleet bands
 *   - a dot positioned at the client's percentile
 * No red/amber; the bar itself is calm silver. Direction is conveyed
 * by position on the bar — "right" = better (higher percentile, faster).
 */
function PercentileBar({
  percentile,
  p10,
  p90,
}: {
  percentile: number | null
  p10: number | null
  p90: number | null
}) {
  if (percentile == null) return null
  const pct = Math.max(0, Math.min(100, percentile))

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          position: 'relative',
          height: 10,
          borderRadius: 5,
          background: 'rgba(192,197,206,0.08)',
          overflow: 'visible',
        }}
      >
        {/* Gradient fill up to the client's percentile */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(192,197,206,0.2), rgba(192,197,206,0.5))',
            borderRadius: 5,
          }}
        />
        {/* Client's position dot */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 6px)`,
            top: -3,
            width: 16,
            height: 16,
            borderRadius: 8,
            background: 'var(--aguila-text-primary, #e6edf3)', // design-token: CSS var fallback for SSR / missing-token contexts
            boxShadow: '0 0 0 2px rgba(10,10,12,0.9)',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: 'var(--aguila-text-muted)',
          fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>Flota p10 · {formatDays(p10)}</span>
        <span>Flota p90 · {formatDays(p90)}</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Presentation helpers
// ──────────────────────────────────────────────────────────────────────

function formatDays(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)} d`
}

function formatPercentile(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const v = Math.round(n)
  return `${v}º`
}

// Calm copy — descriptive, not comparative. "Más rápido que el 72%
// de la flota" is still calm (factual) but avoids rank language.
function percentileSub(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  const v = Math.round(n)
  return `Más rápido que el ${v}% de la flota`
}

function fmtSample(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-MX')
}
