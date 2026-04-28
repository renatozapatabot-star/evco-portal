/**
 * anomaly-report.ts — structured anomaly scan for a tenant.
 *
 * Why this exists:
 *   `getCrossingInsights` already surfaces an `anomalies[]` array on the
 *   full payload, but every consumer (morning email, /admin cockpit,
 *   CRUZ AI tool, Mensajería heads-up draft) groups + paraphrases it
 *   the same way. This module centralizes that synthesis so the copy
 *   stays consistent across surfaces and future anomaly kinds only
 *   need to be labeled in one place.
 *
 * Design:
 *   - Thin wrapper around `getCrossingInsights`. No new DB logic.
 *   - Groups anomalies by kind, attaches recommendations, and emits a
 *     Spanish `summary_es` suitable for a Telegram headline or
 *     Mensajería subject line.
 *   - Deterministic ordering: high-priority kinds first, then lexical.
 *   - Returns the report even when there are zero anomalies — a calm
 *     "todo en orden" report is useful (daily briefings expect something).
 *
 * Usage:
 *   const report = await generateAnomalyReport(sb, 'evco', { windowDays: 30 })
 *   // report.summary_es       — single-line Spanish takeaway
 *   // report.groups[n].kind   — anomaly kind (see KIND_LABEL_ES)
 *   // report.groups[n].anomalies.length  — count per group
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCrossingInsights,
  type Anomaly,
  type InsightsPayload,
} from './crossing-insights'
import { recommendNextAction, type Recommendation } from './recommend'

const KIND_LABEL_ES: Record<Anomaly['kind'], string> = {
  semaforo_rate_drop: 'Bajada en tasa verde',
  proveedor_slip: 'Deterioro de proveedor',
  streak_break: 'Racha rota',
  volume_spike: 'Salto de volumen',
  new_proveedor: 'Proveedor nuevo',
}

const KIND_PRIORITY: Record<Anomaly['kind'], number> = {
  semaforo_rate_drop: 5,
  proveedor_slip: 4,
  new_proveedor: 3,
  volume_spike: 2,
  streak_break: 1,
}

export interface AnomalyGroup {
  kind: Anomaly['kind']
  label_es: string
  anomalies: Anomaly[]
  /** Max score across the group (0..1). */
  max_score: number
}

export interface AnomalyReportOptions {
  /** Lookback window forwarded to `getCrossingInsights`. Default 90. */
  windowDays?: number
  /** Override current-time anchor (for tests). */
  now?: number
}

export interface AnomalyReport {
  generated_at: string
  company_id: string
  window_days: number
  /** Every anomaly, grouped by kind. Empty array when calm. */
  groups: AnomalyGroup[]
  /** Total anomaly count (sum over groups). */
  total_count: number
  /** Recommendations derived from the tenant-wide signals + anomalies. */
  recommendations: Recommendation[]
  /** Spanish one-sentence summary. */
  summary_es: string
  /** Snapshot of the underlying insights payload (for deeper drill-in). */
  insights: InsightsPayload
}

/**
 * Generate a structured anomaly report for a tenant. Always returns a
 * report — even the zero-anomaly case is a useful "calm" signal.
 */
export async function generateAnomalyReport(
  supabase: SupabaseClient,
  companyId: string,
  opts: AnomalyReportOptions = {},
): Promise<AnomalyReport> {
  const windowDays = opts.windowDays ?? 90
  const now = opts.now ?? Date.now()

  const insights = await getCrossingInsights(supabase, companyId, {
    windowDays,
    now,
  })

  const groups = groupAnomalies(insights.anomalies)
  const recommendations = recommendNextAction({
    anomalies: insights.anomalies,
    volume: insights.volume,
  })

  return {
    generated_at: new Date(now).toISOString(),
    company_id: companyId,
    window_days: windowDays,
    groups,
    total_count: insights.anomalies.length,
    recommendations,
    summary_es: buildSummary(groups, insights.anomalies.length, companyId),
    insights,
  }
}

// ── Internals ─────────────────────────────────────────────────────

function groupAnomalies(anomalies: Anomaly[]): AnomalyGroup[] {
  const buckets = new Map<Anomaly['kind'], Anomaly[]>()
  for (const a of anomalies) {
    const list = buckets.get(a.kind) ?? []
    list.push(a)
    buckets.set(a.kind, list)
  }

  const groups: AnomalyGroup[] = []
  for (const [kind, list] of buckets) {
    groups.push({
      kind,
      label_es: KIND_LABEL_ES[kind] ?? kind,
      anomalies: [...list].sort((a, b) => b.score - a.score),
      max_score: list.reduce((m, a) => Math.max(m, a.score), 0),
    })
  }

  return groups.sort((a, b) => {
    const prio = KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]
    if (prio !== 0) return prio
    return a.label_es.localeCompare(b.label_es)
  })
}

function buildSummary(
  groups: AnomalyGroup[],
  total: number,
  companyId: string,
): string {
  if (total === 0) {
    return `${companyId}: operación en calma · sin anomalías detectadas en la ventana.`
  }

  const topLabels = groups
    .slice(0, 3)
    .map((g) => `${g.label_es} (${g.anomalies.length})`)
    .join(', ')

  const plural = total === 1 ? 'anomalía' : 'anomalías'
  return `${companyId}: ${total} ${plural} · ${topLabels}.`
}
