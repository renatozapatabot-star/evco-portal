'use client'

import { TrendingUp } from 'lucide-react'
import type { ModelType } from '@/lib/intelligence'

/* ── Light tokens (DESIGN_SYSTEM.md v6) ──────────────── */

export const D = {
  bg: 'var(--bg-main)',
  surface: 'var(--bg-card)',
  surfaceHover: '#F5F4F0',
  border: 'var(--border)',
  gold: 'var(--gold)',
  goldSubtle: 'rgba(196,150,60,0.08)',
  goldBorder: 'rgba(196,150,60,0.25)',
  text: 'var(--text-primary)',
  textSec: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  green: 'var(--success)',
  greenBg: 'var(--portal-status-green-bg)',
  amber: 'var(--warning-500, #D97706)',
  amberBg: 'rgba(192,197,206,0.08)',
  red: 'var(--danger-500)',
  redBg: 'var(--portal-status-red-bg)',
  teal: '#0D9488',
  tealBg: 'rgba(13,148,136,0.08)',
} as const

/* ── Types ────────────────────────────────────────────────── */

export interface SandboxRow {
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

export interface ShadowRow {
  id: string
  context_summary: string | null
  score_overall: number | null
  accepted_without_revision: boolean | null
  corrections_count: number | null
  created_at: string
}

export interface Stats {
  totalHistorical: number
  trainingSamples: number
  bestAccuracy: number | null
  avgShadowAccuracy: number | null
  lastTrainingRun: string | null
}

export interface TierCounts {
  portal: number
  operational: number
  analytical: number
  historical: number
}

/* ── Small shared components ─────────────────────────────── */

export function AccuracyBadge({ value }: { value: number | null }) {
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

export function DeltaBadge({ value }: { value: number | null }) {
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

export function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-${align}`}
      style={{ color: D.textMuted, textAlign: align }}
    >
      {children}
    </th>
  )
}

export function EmptyState({
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
