'use client'

import { Database, Layers, Target, Clock } from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import { INTELLIGENCE_TIERS } from '@/lib/intelligence'
import { D } from './IntelShared'
import type { Stats, TierCounts } from './IntelShared'

/* ── KPI Stats Section ───────────────────────────────────── */

export function IntelKPISection({
  stats,
  loading,
}: {
  stats: Stats | null
  loading: boolean
}) {
  return (
    <section className="mb-8">
      <h2
        className="mb-4 text-sm font-medium uppercase tracking-wider"
        style={{ color: D.textMuted }}
      >
        Cobertura de Datos
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Database size={20} />}
          label="Embarques Históricos"
          value={stats?.totalHistorical ?? null}
          loading={loading}
          format="number"
        />
        <StatCard
          icon={<Layers size={20} />}
          label="Muestras de Entrenamiento"
          value={stats?.trainingSamples ?? null}
          loading={loading}
          format="number"
        />
        <StatCard
          icon={<Target size={20} />}
          label="Mejor Precision"
          value={stats?.bestAccuracy ?? null}
          loading={loading}
          format="percent"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Último Entrenamiento"
          value={stats?.lastTrainingRun ?? null}
          loading={loading}
          format="date"
        />
      </div>
    </section>
  )
}

/* ── Training Tiers Section ──────────────────────────────── */

export function IntelTiersSection({
  tiers,
  loading,
}: {
  tiers: TierCounts | null
  loading: boolean
}) {
  return (
    <section className="mb-8">
      <h2
        className="mb-4 text-sm font-medium uppercase tracking-wider"
        style={{ color: D.textMuted }}
      >
        Niveles de Datos
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(INTELLIGENCE_TIERS) as [string, { from: string; label: string; description: string }][]).map(
          ([key, tier]) => {
            const count = tiers?.[key.toLowerCase() as keyof TierCounts] ?? null
            return (
              <TierCard
                key={key}
                label={tier.label}
                description={tier.description}
                from={tier.from}
                count={count}
                loading={loading}
              />
            )
          }
        )}
      </div>
    </section>
  )
}

/* ── StatCard ─────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  loading,
  format,
}: {
  icon: React.ReactNode
  label: string
  value: number | string | null
  loading: boolean
  format: 'number' | 'percent' | 'date'
}) {
  let display = '—'
  if (value != null) {
    if (format === 'number' && typeof value === 'number') {
      display = value.toLocaleString('es-MX')
    } else if (format === 'percent' && typeof value === 'number') {
      display = `${(value * 100).toFixed(1)}%`
    } else if (format === 'date' && typeof value === 'string') {
      display = fmtDateTime(value)
    }
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: D.surface, borderColor: D.border }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span style={{ color: D.gold }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: D.textMuted }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded" style={{ background: D.surfaceHover }} />
      ) : (
        <p className="font-mono text-2xl font-semibold" style={{ color: D.text }}>
          {display}
        </p>
      )}
    </div>
  )
}

/* ── TierCard ─────────────────────────────────────────────── */

function TierCard({
  label,
  description,
  from,
  count,
  loading,
}: {
  label: string
  description: string
  from: string
  count: number | null
  loading: boolean
}) {
  const year = from.slice(0, 4)
  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: D.surface, borderColor: D.border }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: D.text }}>
          {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-mono"
          style={{ background: D.goldSubtle, color: D.gold }}
        >
          {year}+
        </span>
      </div>
      <p className="mb-3 text-xs" style={{ color: D.textMuted }}>
        {description}
      </p>
      {loading ? (
        <div className="h-6 w-16 animate-pulse rounded" style={{ background: D.surfaceHover }} />
      ) : (
        <p className="font-mono text-lg font-semibold" style={{ color: D.teal }}>
          {count != null ? count.toLocaleString('es-MX') : '—'}
          <span className="ml-1 text-xs font-normal" style={{ color: D.textMuted }}>
            traficos
          </span>
        </p>
      )}
      <button
        className="mt-3 w-full rounded px-3 py-2 text-xs font-medium transition-colors duration-150"
        style={{
          background: D.goldSubtle,
          color: D.gold,
          border: `1px solid ${D.goldBorder}`,
        }}
        disabled
        title="Proximamente"
      >
        Usar para entrenamiento
      </button>
    </div>
  )
}
