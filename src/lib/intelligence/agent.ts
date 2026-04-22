/**
 * agent.ts — the autonomous intelligence orchestrator.
 *
 * Phase 2 moat: given a tenant and a mode, the agent runs a complete
 * sense → think → output cycle using the Phase 1 primitives + Phase 2
 * composers (recommender, full-insight, anomaly-report). The agent is
 * intentionally proposal-only: it never writes, never notifies, never
 * triggers external side effects. Humans (or Tito via the approval
 * gate) authorize every downstream action. See CLAUDE.md approval-gate
 * rule.
 *
 * Modes:
 *   - 'tenant_scan'    → full tenant-wide report: anomalies + top
 *                         predictions + watch predictions + recs.
 *   - 'sku_focus'      → one SKU, full-insight bundle.
 *   - 'trafico_focus'  → one trafico, full-insight bundle.
 *   - 'anomaly_only'   → same report shape as tenant_scan but only the
 *                         anomaly + recommendation fields populated.
 *
 * Why one entry point:
 *   Grok Build agents work best with a single "tell me about X" call.
 *   `runIntelligenceAgent(sb, 'evco', { type: 'sku', cveProducto })`
 *   reads like a sentence and returns the whole bundle; consumers pick
 *   what they need from the structured output.
 *
 * What this is NOT:
 *   - Not an executor. Writes, emails, Mensajería drafts, Telegram
 *     alerts all happen elsewhere after human review.
 *   - Not ML. Transparent rule composition operators can reason about.
 *   - Not a cron. Callers invoke this; scheduling is PM2's job.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFullCrossingInsight,
  type FullCrossingInsight,
  type InsightTarget,
} from './full-insight'
import {
  generateAnomalyReport,
  type AnomalyReport,
} from './anomaly-report'
import { recommendNextAction, type Recommendation } from './recommend'
import {
  getCrossingInsights,
  type InsightsPayload,
  type VerdePrediction,
} from './crossing-insights'
import { computeSkuSignals } from './predict-by-id'

export type AgentMode =
  | 'tenant_scan'
  | 'anomaly_only'
  | { type: 'sku'; cveProducto: string }
  | { type: 'trafico'; traficoId: string }

export interface AgentOptions {
  /** Lookback window for signals (7..365). Default 90. */
  windowDays?: number
  /** Override current time anchor (for tests). */
  now?: number
  /** Max number of focused full-insight bundles to compose in tenant_scan.
   *  Default 3 — enough to render a headline card stack without blowing
   *  the request budget. */
  topFocusCount?: number
}

interface AgentReportBase {
  /** Which mode produced this report. */
  mode_label:
    | 'tenant_scan'
    | 'anomaly_only'
    | 'sku_focus'
    | 'trafico_focus'
  generated_at: string
  company_id: string
  window_days: number
  /** Recommended actions rolled up from the mode's signals. */
  recommendations: Recommendation[]
  /** Spanish one-line takeaway for the caller. */
  summary_es: string
}

export interface TenantScanReport extends AgentReportBase {
  mode_label: 'tenant_scan'
  insights: InsightsPayload
  anomaly_report: AnomalyReport
  /** Top-N watch predictions expanded into full insights (ordered by
   *  severity — lowest probability first). */
  focus_insights: FullCrossingInsight[]
}

export interface AnomalyOnlyReport extends AgentReportBase {
  mode_label: 'anomaly_only'
  anomaly_report: AnomalyReport
}

export interface SkuFocusReport extends AgentReportBase {
  mode_label: 'sku_focus'
  insight: FullCrossingInsight | null
}

export interface TraficoFocusReport extends AgentReportBase {
  mode_label: 'trafico_focus'
  insight: FullCrossingInsight | null
}

export type AgentReport =
  | TenantScanReport
  | AnomalyOnlyReport
  | SkuFocusReport
  | TraficoFocusReport

/**
 * Run the autonomous intelligence agent in the requested mode.
 * Always returns a well-formed report (never throws on empty tenants
 * or unknown targets — the structured output signals the empty state).
 */
export async function runIntelligenceAgent(
  supabase: SupabaseClient,
  companyId: string,
  mode: AgentMode,
  opts: AgentOptions = {},
): Promise<AgentReport> {
  const windowDays = opts.windowDays ?? 90
  const now = opts.now ?? Date.now()
  const generated_at = new Date(now).toISOString()

  // ── Focused modes ────────────────────────────────────────────────
  if (typeof mode === 'object' && mode.type === 'sku') {
    return buildSkuReport(supabase, companyId, mode, {
      windowDays,
      now,
      generated_at,
    })
  }

  if (typeof mode === 'object' && mode.type === 'trafico') {
    return buildTraficoReport(supabase, companyId, mode, {
      windowDays,
      now,
      generated_at,
    })
  }

  // ── anomaly_only ────────────────────────────────────────────────
  if (mode === 'anomaly_only') {
    const report = await generateAnomalyReport(supabase, companyId, {
      windowDays,
      now,
    })
    return {
      mode_label: 'anomaly_only',
      generated_at,
      company_id: companyId,
      window_days: windowDays,
      anomaly_report: report,
      recommendations: report.recommendations,
      summary_es: report.summary_es,
    }
  }

  // ── tenant_scan (default) ───────────────────────────────────────
  return buildTenantScanReport(supabase, companyId, {
    windowDays,
    now,
    generated_at,
    topFocusCount: opts.topFocusCount ?? 3,
  })
}

// ── Builders ───────────────────────────────────────────────────────

interface BuilderCtx {
  windowDays: number
  now: number
  generated_at: string
}

async function buildSkuReport(
  sb: SupabaseClient,
  companyId: string,
  target: InsightTarget & { type: 'sku' },
  ctx: BuilderCtx,
): Promise<SkuFocusReport> {
  const insight = await buildFullCrossingInsight(sb, companyId, target, {
    windowDays: ctx.windowDays,
    now: ctx.now,
  })
  return {
    mode_label: 'sku_focus',
    generated_at: ctx.generated_at,
    company_id: companyId,
    window_days: ctx.windowDays,
    insight,
    recommendations: insight?.recommendations ?? noSignalRec(target.cveProducto),
    summary_es:
      insight?.summary_es ??
      `SKU ${target.cveProducto}: sin señal en la ventana — aún no hay base para recomendación.`,
  }
}

async function buildTraficoReport(
  sb: SupabaseClient,
  companyId: string,
  target: InsightTarget & { type: 'trafico' },
  ctx: BuilderCtx,
): Promise<TraficoFocusReport> {
  const insight = await buildFullCrossingInsight(sb, companyId, target, {
    windowDays: ctx.windowDays,
    now: ctx.now,
  })
  return {
    mode_label: 'trafico_focus',
    generated_at: ctx.generated_at,
    company_id: companyId,
    window_days: ctx.windowDays,
    insight,
    recommendations: insight?.recommendations ?? noSignalRec(target.traficoId),
    summary_es:
      insight?.summary_es ??
      `Tráfico ${target.traficoId}: sin señal en la ventana.`,
  }
}

async function buildTenantScanReport(
  sb: SupabaseClient,
  companyId: string,
  ctx: BuilderCtx & { topFocusCount: number },
): Promise<TenantScanReport> {
  const insights = await getCrossingInsights(sb, companyId, {
    windowDays: ctx.windowDays,
    now: ctx.now,
  })

  const anomaly_report = await generateAnomalyReport(sb, companyId, {
    windowDays: ctx.windowDays,
    now: ctx.now,
  })

  // Focus on the lowest-probability watch predictions — these are the
  // ones most likely to benefit from a pre-cruce review. Limit fetch
  // to topFocusCount to keep request cost predictable.
  const focusTargets = selectWatchTargets(
    insights.watch_predictions,
    ctx.topFocusCount,
  )
  const focus_insights: FullCrossingInsight[] = []
  for (const cveProducto of focusTargets) {
    const signals = await computeSkuSignals(sb, companyId, cveProducto, {
      windowDays: ctx.windowDays,
      now: ctx.now,
    })
    if (!signals) continue
    // Reuse the same builder for consistency; it'll re-fetch but
    // the signals are already cached server-side so the pass is cheap.
    const bundle = await buildFullCrossingInsight(
      sb,
      companyId,
      { type: 'sku', cveProducto },
      { windowDays: ctx.windowDays, now: ctx.now },
    )
    if (bundle) focus_insights.push(bundle)
  }

  // Top-level recommendations: merge tenant-wide anomaly recs with
  // volume-driven recs. De-duplicate by { kind, subject }.
  const recommendations = dedupeRecommendations([
    ...anomaly_report.recommendations,
    ...recommendNextAction({
      anomalies: insights.anomalies,
      volume: insights.volume,
    }),
  ])

  return {
    mode_label: 'tenant_scan',
    generated_at: ctx.generated_at,
    company_id: companyId,
    window_days: ctx.windowDays,
    insights,
    anomaly_report,
    focus_insights,
    recommendations,
    summary_es: buildTenantScanSummary(companyId, insights, anomaly_report),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function selectWatchTargets(
  watch: VerdePrediction[],
  max: number,
): string[] {
  const byRisk = [...watch].sort((a, b) => a.probability - b.probability)
  return byRisk.slice(0, Math.max(0, max)).map((p) => p.cve_producto)
}

function dedupeRecommendations(
  recs: Recommendation[],
): Recommendation[] {
  const seen = new Set<string>()
  const out: Recommendation[] = []
  for (const r of recs) {
    const key = `${r.kind}::${r.subject}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

function noSignalRec(subject: string): Recommendation[] {
  return [
    {
      kind: 'no_action',
      priority: 'low',
      subject,
      action_es: 'Sin datos suficientes para recomendar una acción.',
      rationale_es:
        'Este objetivo no tiene suficientes cruces en la ventana. Considera ampliar el rango o revisar que el shipper esté registrando las partidas.',
      metadata: { subject },
    },
  ]
}

function buildTenantScanSummary(
  companyId: string,
  insights: InsightsPayload,
  anomalyReport: AnomalyReport,
): string {
  const anomalyCount = insights.anomalies.length
  const baseline = insights.baseline_verde_pct
  const totalPartidas = insights.volume.recent_7d + insights.volume.prior_7d

  if (totalPartidas === 0) {
    return `${companyId}: sin cruces en la ventana — operación en pausa.`
  }

  if (anomalyCount === 0) {
    return `${companyId}: verde base ${baseline}% · ${insights.volume.recent_7d} partidas recientes · sin anomalías.`
  }

  return `${companyId}: ${anomalyReport.summary_es.replace(`${companyId}: `, '')} · verde base ${baseline}%.`
}
