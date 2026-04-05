'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Database, Brain, Target, Clock,
  BarChart3, Layers, Activity, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { fmtDateTime } from '@/lib/format-utils'
import { INTELLIGENCE_TIERS, MODEL_TYPE_LABELS } from '@/lib/intelligence'
import type { ModelType } from '@/lib/intelligence'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ──────────────── */

const D = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceHover: '#F5F4F0',
  border: '#E8E5E0',
  gold: '#C4963C',
  goldSubtle: 'rgba(196,150,60,0.08)',
  goldBorder: 'rgba(196,150,60,0.25)',
  text: '#1A1A1A',
  textSec: '#6B6B6B',
  textMuted: '#9B9B9B',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  red: '#DC2626',
  redBg: '#FEF2F2',
  teal: '#0D9488',
  tealBg: 'rgba(13,148,136,0.08)',
} as const

/* ── Types ────────────────────────────────────────────────── */

interface SandboxRow {
  id: string
  session_id: string
  model_type: ModelType
  training_samples: number | null
  validation_samples: number | null
  accuracy_score: number | null
  baseline_accuracy: number | null
  improvement_delta: number | null
  top_features: string[] | null
  notes: string | null
  created_at: string
}

interface ShadowRow {
  id: string
  context_summary: string | null
  score_overall: number | null
  accepted_without_revision: boolean | null
  corrections_count: number | null
  created_at: string
}

interface Stats {
  totalHistorical: number
  trainingSamples: number
  bestAccuracy: number | null
  avgShadowAccuracy: number | null
  lastTrainingRun: string | null
}

interface TierCounts {
  portal: number
  operational: number
  analytical: number
  historical: number
}

/* ── Page ─────────────────────────────────────────────────── */

export default function IntelligenceSandbox() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tiers, setTiers] = useState<TierCounts | null>(null)
  const [sandbox, setSandbox] = useState<SandboxRow[]>([])
  const [shadowLog, setShadowLog] = useState<ShadowRow[]>([])

  // Auth gate — broker/admin only
  useEffect(() => {
    const match = document.cookie.match(/(^| )user_role=([^;]+)/)
    const r = match ? match[2] : null
    setRole(r)
    if (r !== 'broker' && r !== 'admin') {
      router.replace('/')
    }
  }, [router])

  // Fetch data
  useEffect(() => {
    if (role !== 'broker' && role !== 'admin') return
    fetchData()
  }, [role])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/intelligence/data')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStats(data.stats)
      setTiers(data.tiers)
      setSandbox(data.sandbox || [])
      setShadowLog(data.shadowLog || [])
    } catch {
      // Will show empty states
    } finally {
      setLoading(false)
    }
  }

  if (role !== 'broker' && role !== 'admin') return null

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-8"
      style={{ background: D.bg, color: D.text }}
    >
      {/* Header */}
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-3">
          <Brain size={28} style={{ color: D.gold }} />
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: D.text }}
            >
              Sandbox de Inteligencia
            </h1>
            <p className="text-sm" style={{ color: D.textSec }}>
              Patente 3596 · 32,299 tráficos · 2011–2026
            </p>
          </div>
          <div
            className="ml-auto rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: D.goldSubtle,
              color: D.gold,
              border: `1px solid ${D.goldBorder}`,
            }}
          >
            SANDBOX
          </div>
        </div>

        {/* SECTION 1 — Data Coverage Stats */}
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
              label="Tráficos Históricos"
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
              label="Mejor Precisión"
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

        {/* SECTION 2 — Model Performance Table */}
        <section className="mb-8">
          <h2
            className="mb-4 text-sm font-medium uppercase tracking-wider"
            style={{ color: D.textMuted }}
          >
            Rendimiento de Modelos
          </h2>
          <div
            className="overflow-hidden rounded-lg border"
            style={{ background: D.surface, borderColor: D.border }}
          >
            {sandbox.length === 0 && !loading ? (
              <EmptyState
                icon={<BarChart3 size={40} />}
                title="Sin sesiones de entrenamiento"
                subtitle="Ejecuta el primer ciclo de entrenamiento para ver resultados aquí."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                      <Th>Modelo</Th>
                      <Th align="right">Muestras</Th>
                      <Th align="right">Precisión</Th>
                      <Th align="right">vs. Base</Th>
                      <Th align="right">Fecha</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div
                                className="h-4 w-20 animate-pulse rounded"
                                style={{ background: D.surfaceHover }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      sandbox.map(row => (
                        <tr
                          key={row.id}
                          className="transition-colors duration-150"
                          style={{ borderBottom: `1px solid ${D.border}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-4 py-3 font-medium" style={{ color: D.text }}>
                            {MODEL_TYPE_LABELS[row.model_type] || row.model_type}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono"
                            style={{ color: D.textSec }}
                          >
                            {row.training_samples?.toLocaleString('es-MX') ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AccuracyBadge value={row.accuracy_score} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DeltaBadge value={row.improvement_delta} />
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono text-xs"
                            style={{ color: D.textMuted }}
                          >
                            {row.created_at ? fmtDateTime(row.created_at) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3 — Training Tiers */}
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

        {/* SECTION 4 — Shadow Predictions Log */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2
              className="text-sm font-medium uppercase tracking-wider"
              style={{ color: D.textMuted }}
            >
              Shadow Predictions
            </h2>
            {stats?.avgShadowAccuracy != null && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-mono font-medium"
                style={{
                  background: stats.avgShadowAccuracy >= 0.8 ? D.greenBg
                    : stats.avgShadowAccuracy >= 0.6 ? D.amberBg
                    : D.redBg,
                  color: stats.avgShadowAccuracy >= 0.8 ? D.green
                    : stats.avgShadowAccuracy >= 0.6 ? D.amber
                    : D.red,
                }}
              >
                {(stats.avgShadowAccuracy * 100).toFixed(1)}% promedio
              </span>
            )}
          </div>
          <div
            className="overflow-hidden rounded-lg border"
            style={{ background: D.surface, borderColor: D.border }}
          >
            {shadowLog.length === 0 && !loading ? (
              <EmptyState
                icon={<Activity size={40} />}
                title="Sin predicciones shadow"
                subtitle="El Karpathy Loop generará predicciones automáticamente."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                      <Th>Contexto</Th>
                      <Th align="center">Resultado</Th>
                      <Th align="right">Score</Th>
                      <Th align="right">Correcciones</Th>
                      <Th align="right">Fecha</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div
                                className="h-4 w-24 animate-pulse rounded"
                                style={{ background: D.surfaceHover }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      shadowLog.map(row => (
                        <tr
                          key={row.id}
                          className="transition-colors duration-150"
                          style={{ borderBottom: `1px solid ${D.border}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = D.surfaceHover)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td
                            className="max-w-xs truncate px-4 py-3"
                            style={{ color: D.textSec }}
                            title={row.context_summary || ''}
                          >
                            {row.context_summary || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.accepted_without_revision ? (
                              <CheckCircle2 size={16} style={{ color: D.green }} className="mx-auto" />
                            ) : row.score_overall != null && row.score_overall >= 0.6 ? (
                              <AlertTriangle size={16} style={{ color: D.amber }} className="mx-auto" />
                            ) : (
                              <XCircle size={16} style={{ color: D.red }} className="mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AccuracyBadge value={row.score_overall} />
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono"
                            style={{ color: D.textSec }}
                          >
                            {row.corrections_count ?? '—'}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-mono text-xs"
                            style={{ color: D.textMuted }}
                          >
                            {row.created_at ? fmtDateTime(row.created_at) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: D.textMuted }}>
          Patente 3596 · Aduana 240 · Sandbox Mode — No client-facing output
        </p>
      </div>
    </div>
  )
}

/* ── Components ───────────────────────────────────────────── */

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
            tráficos
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
        title="Próximamente"
      >
        Usar para entrenamiento
      </button>
    </div>
  )
}

function AccuracyBadge({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: D.textMuted }}>—</span>

  const pct = value * 100
  const bg = pct >= 80 ? D.greenBg : pct >= 60 ? D.amberBg : D.redBg
  const fg = pct >= 80 ? D.green : pct >= 60 ? D.amber : D.red

  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-mono text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {pct.toFixed(1)}%
    </span>
  )
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: D.textMuted }}>—</span>

  const pct = value * 100
  const isPositive = pct > 0
  const fg = isPositive ? D.green : pct < 0 ? D.red : D.textMuted

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs" style={{ color: fg }}>
      {isPositive && <TrendingUp size={12} />}
      {isPositive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-${align}`}
      style={{ color: D.textMuted, textAlign: align }}
    >
      {children}
    </th>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <span style={{ color: D.textMuted }}>{icon}</span>
      <p className="mt-3 text-sm font-medium" style={{ color: D.textSec }}>
        {title}
      </p>
      <p className="mt-1 text-xs" style={{ color: D.textMuted }}>
        {subtitle}
      </p>
    </div>
  )
}
