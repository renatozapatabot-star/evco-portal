/**
 * loop.ts — Phase 3 #5 Learning Loop core engine.
 *
 * What this module does:
 *   1. Reads recent rows from `agent_decisions` (Phase 3 #3 log).
 *   2. Computes four metric axes:
 *        - prediction accuracy (predicted band vs. real semaforo)
 *        - tool acceptance (human_feedback sentiment per tool_name)
 *        - draft approval (outcome per message_type)
 *        - tone-guard trend (block rate for draft_mensajeria)
 *   3. Applies deterministic suggestion rules.
 *   4. Composes a Spanish report (plain + HTML) ready for Telegram.
 *   5. Persists itself as an agent_decisions row so every report run
 *      is queryable + replayable.
 *
 * What this module does NOT do:
 *   - Does NOT mutate rule weights, templates, or confidence thresholds.
 *     Suggestions are proposals — humans edit code after review.
 *   - Does NOT send messages. The weekly cron (Phase 3 #5b) wires the
 *     text output to Telegram using the same pattern as morning-briefing.
 *   - Does NOT call an LLM. Every metric + rule is a pure function of
 *     the decision-log rows.
 *
 * Safety contract:
 *   - Read-only against tenant data. The ONLY write is the report row
 *     itself in `agent_decisions`, gated through withDecisionLog so
 *     failures swallow cleanly.
 *   - Tenant-isolated: companyId is required on every orchestrator.
 *   - Deterministic: same rows in → same metrics + suggestions out.
 *
 * Tests live in `__tests__/loop.test.ts` — every pure function is
 * exercised with hand-built fixtures.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getDecisionHistory,
  withDecisionLog,
  type DecisionRow,
} from '@/lib/intelligence/decision-log'
import type { AgentToolResponse } from '@/lib/aguila/tools'

// ── Public types ──────────────────────────────────────────────────

export type PredictionBand = 'alta' | 'media' | 'baja'

export interface PredictionBandStat {
  total: number
  verde_count: number
  /** verde_count / total · null when total=0 */
  verde_rate: number | null
  /** Predicted band midpoint (for gap calculation). */
  predicted_rate_mid: number
  /** Signed pp gap (actual_verde_rate_pct - predicted_mid). null when total=0. */
  gap_pp: number | null
}

export interface PredictionAccuracyMetric {
  overall: {
    total: number
    verde_count: number
    verde_rate: number | null
  }
  by_band: Record<PredictionBand, PredictionBandStat>
}

export interface ToolAcceptanceEntry {
  tool_name: string
  total: number
  positive: number
  negative: number
  neutral: number
  no_feedback: number
  /** positive / (positive + negative) — null when no feedback. */
  acceptance_rate: number | null
}

export interface ToolAcceptanceMetric {
  by_tool: ToolAcceptanceEntry[]
}

export interface DraftApprovalEntry {
  message_type: string
  total: number
  approved: number
  rejected: number
  no_outcome: number
  /** approved / (approved + rejected) — null when no outcome. */
  approval_rate: number | null
}

export interface DraftApprovalMetric {
  by_type: DraftApprovalEntry[]
  blocked_by_tone_guard: number
}

export interface ToneGuardMetric {
  total_attempts: number
  blocked: number
  /** blocked / total_attempts — null when total_attempts=0. */
  block_rate: number | null
}

export interface LearningMetrics {
  window: {
    days: number
    generated_at: string
    company_id: string
  }
  sample_size: {
    total: number
    with_outcome: number
    with_feedback: number
  }
  prediction_accuracy: PredictionAccuracyMetric
  tool_acceptance: ToolAcceptanceMetric
  draft_approval: DraftApprovalMetric
  tone_guard: ToneGuardMetric
}

export type SuggestionKind =
  | 'prediction_overconfidence'
  | 'prediction_underconfidence'
  | 'tool_low_acceptance'
  | 'draft_low_approval'
  | 'tone_guard_drift'
  | 'sample_size_low'

export type SuggestionPriority = 'alta' | 'media' | 'baja'

export interface Suggestion {
  /** Stable identifier — dedup + learning-loop replay. */
  id: string
  kind: SuggestionKind
  priority: SuggestionPriority
  /** What the suggestion refers to (tool_name, band, message_type, 'tenant'). */
  subject: string
  /** Spanish one-sentence observation. */
  finding_es: string
  /** Spanish one-sentence next step. */
  suggested_action_es: string
  /** Raw numbers that triggered the rule. */
  evidence: Record<string, unknown>
}

export interface LearningReport {
  metrics: LearningMetrics
  suggestions: Suggestion[]
  /** Single Spanish headline. */
  summary_es: string
  /** Full report body, plain text (Telegram / email / logs). */
  text_plain: string
  /** Same, HTML-escaped (Telegram parse_mode='HTML'). */
  text_html: string
}

// ── Constants ─────────────────────────────────────────────────────

/** Band midpoints used as the predictor's implied forecast. Aligned
 *  with `predictVerdeProbability` band thresholds (alta ≥ 92, media
 *  80–91, baja < 80). The midpoints below are conservative estimates
 *  of what each band "claims" the verde rate will be. */
const BAND_MID: Record<PredictionBand, number> = {
  alta: 95, // 92..99 → midpoint ~95
  media: 86, // 80..91 → midpoint ~86
  baja: 60, // 5..79 → conservative anchor
}

const DEFAULT_WINDOW_DAYS = 7
const DECISION_FETCH_LIMIT = 500

const DRAFT_APPROVED_OUTCOMES = new Set(['approved', 'sent'])
const DRAFT_REJECTED_OUTCOMES = new Set(['rejected', 'superseded', 'ignored'])
const SEMAFORO_OUTCOMES = new Set(['verde', 'amarillo', 'rojo'])

// ── Pure metric calculators ───────────────────────────────────────

/**
 * Prediction accuracy — per-band verde rate vs. predictor midpoint.
 * Only considers rows where a real semaforo outcome was recorded.
 */
export function computePredictionAccuracy(
  rows: DecisionRow[],
): PredictionAccuracyMetric {
  const emptyBand = (mid: number): PredictionBandStat => ({
    total: 0,
    verde_count: 0,
    verde_rate: null,
    predicted_rate_mid: mid,
    gap_pp: null,
  })

  const stats: Record<PredictionBand, PredictionBandStat> = {
    alta: emptyBand(BAND_MID.alta),
    media: emptyBand(BAND_MID.media),
    baja: emptyBand(BAND_MID.baja),
  }
  let overallTotal = 0
  let overallVerde = 0

  for (const row of rows) {
    if (
      row.tool_name !== 'analyze_trafico' &&
      row.tool_name !== 'analyze_pedimento'
    ) {
      continue
    }
    if (!row.outcome || !SEMAFORO_OUTCOMES.has(row.outcome)) continue

    const band = extractBand(row)
    if (!band) continue

    const isVerde = row.outcome === 'verde'
    stats[band].total += 1
    overallTotal += 1
    if (isVerde) {
      stats[band].verde_count += 1
      overallVerde += 1
    }
  }

  for (const band of ['alta', 'media', 'baja'] as const) {
    const s = stats[band]
    if (s.total > 0) {
      s.verde_rate = s.verde_count / s.total
      s.gap_pp = Math.round((s.verde_rate * 100 - s.predicted_rate_mid) * 10) / 10
    }
  }

  return {
    overall: {
      total: overallTotal,
      verde_count: overallVerde,
      verde_rate: overallTotal > 0 ? overallVerde / overallTotal : null,
    },
    by_band: stats,
  }
}

/**
 * Tool acceptance — human-feedback sentiment distribution per tool.
 * Rows missing feedback count under `no_feedback`; rows with
 * sentiment but no matching positive/negative slot count as neutral.
 */
export function computeToolAcceptance(rows: DecisionRow[]): ToolAcceptanceMetric {
  const map = new Map<string, ToolAcceptanceEntry>()

  for (const row of rows) {
    const name = row.tool_name || 'unknown'
    const entry = map.get(name) ?? {
      tool_name: name,
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      no_feedback: 0,
      acceptance_rate: null,
    }
    entry.total += 1

    const feedback = row.human_feedback
    if (!feedback || typeof feedback !== 'object') {
      entry.no_feedback += 1
    } else {
      switch ((feedback as { sentiment?: string }).sentiment) {
        case 'positive':
          entry.positive += 1
          break
        case 'negative':
          entry.negative += 1
          break
        case 'neutral':
          entry.neutral += 1
          break
        default:
          entry.no_feedback += 1
      }
    }
    map.set(name, entry)
  }

  const by_tool = [...map.values()]
    .map((e) => {
      const denom = e.positive + e.negative
      return {
        ...e,
        acceptance_rate: denom > 0 ? e.positive / denom : null,
      }
    })
    .sort((a, b) => b.total - a.total || a.tool_name.localeCompare(b.tool_name))

  return { by_tool }
}

/**
 * Draft approval rate, broken out per message_type. Also counts drafts
 * that never made it out of the composer because the tone guard fired
 * (action_taken='blocked:tone_guard').
 */
export function computeDraftApproval(rows: DecisionRow[]): DraftApprovalMetric {
  const map = new Map<string, DraftApprovalEntry>()
  let blocked = 0

  for (const row of rows) {
    if (row.tool_name !== 'draft_mensajeria') continue

    if (row.action_taken === 'blocked:tone_guard') {
      blocked += 1
      continue
    }

    const type = extractMessageType(row) || 'desconocido'
    const entry = map.get(type) ?? {
      message_type: type,
      total: 0,
      approved: 0,
      rejected: 0,
      no_outcome: 0,
      approval_rate: null,
    }
    entry.total += 1

    const outcome = row.outcome ?? null
    if (!outcome) entry.no_outcome += 1
    else if (DRAFT_APPROVED_OUTCOMES.has(outcome)) entry.approved += 1
    else if (DRAFT_REJECTED_OUTCOMES.has(outcome)) entry.rejected += 1
    else entry.no_outcome += 1

    map.set(type, entry)
  }

  const by_type = [...map.values()]
    .map((e) => {
      const denom = e.approved + e.rejected
      return {
        ...e,
        approval_rate: denom > 0 ? e.approved / denom : null,
      }
    })
    .sort((a, b) => b.total - a.total || a.message_type.localeCompare(b.message_type))

  return { by_type, blocked_by_tone_guard: blocked }
}

/** Tone-guard trend — block rate across all draft_mensajeria attempts. */
export function computeToneGuardTrend(rows: DecisionRow[]): ToneGuardMetric {
  let total = 0
  let blocked = 0
  for (const row of rows) {
    if (row.tool_name !== 'draft_mensajeria') continue
    total += 1
    if (row.action_taken === 'blocked:tone_guard') blocked += 1
  }
  return {
    total_attempts: total,
    blocked,
    block_rate: total > 0 ? blocked / total : null,
  }
}

// ── Suggestion rules ──────────────────────────────────────────────

/**
 * Apply all deterministic suggestion rules. Returns suggestions
 * sorted by priority desc, then subject asc. Always returns at least
 * one suggestion — even a clean run surfaces `sample_size_low` when
 * evidence is thin.
 */
export function suggestAdjustments(metrics: LearningMetrics): Suggestion[] {
  const out: Suggestion[] = []

  // Rule 1 — overconfidence in the alta band.
  const alta = metrics.prediction_accuracy.by_band.alta
  if (alta.total >= 10 && alta.verde_rate != null && alta.verde_rate < 0.9) {
    const pct = Math.round(alta.verde_rate * 100)
    out.push({
      id: 'prediction_overconfidence:alta',
      kind: 'prediction_overconfidence',
      priority: 'alta',
      subject: 'banda_alta',
      finding_es: `Banda alta: predicciones ${pct}% verde en ${alta.total} casos (meta ≥ 90%).`,
      suggested_action_es:
        'Revisa los pesos de `predictVerdeProbability` (especialmente streak + proveedor) — las señales sobreestiman certeza.',
      evidence: {
        total: alta.total,
        verde_rate: alta.verde_rate,
        predicted_mid_pp: alta.predicted_rate_mid,
        gap_pp: alta.gap_pp,
      },
    })
  }

  // Rule 2 — underconfidence in the baja band.
  const baja = metrics.prediction_accuracy.by_band.baja
  if (baja.total >= 10 && baja.verde_rate != null && baja.verde_rate > 0.8) {
    const pct = Math.round(baja.verde_rate * 100)
    out.push({
      id: 'prediction_underconfidence:baja',
      kind: 'prediction_underconfidence',
      priority: 'media',
      subject: 'banda_baja',
      finding_es: `Banda baja: predicciones ${pct}% verde en ${baja.total} casos (esperado < 80%).`,
      suggested_action_es:
        'Revisa los pesos negativos — la banda baja está marcando excesivamente como riesgo lo que termina cruzando verde.',
      evidence: {
        total: baja.total,
        verde_rate: baja.verde_rate,
        predicted_mid_pp: baja.predicted_rate_mid,
        gap_pp: baja.gap_pp,
      },
    })
  }

  // Rule 3 — tool acceptance per tool.
  for (const tool of metrics.tool_acceptance.by_tool) {
    const feedbackCount = tool.positive + tool.negative
    if (feedbackCount >= 5 && tool.acceptance_rate != null && tool.acceptance_rate < 0.6) {
      const pct = Math.round(tool.acceptance_rate * 100)
      out.push({
        id: `tool_low_acceptance:${tool.tool_name}`,
        kind: 'tool_low_acceptance',
        priority: 'media',
        subject: tool.tool_name,
        finding_es: `${tool.tool_name}: aprobación ${pct}% (${tool.positive}/${feedbackCount} revisiones).`,
        suggested_action_es: `Revisa el output de \`${tool.tool_name}\` — copy en español, precisión de señales, o formato.`,
        evidence: {
          total: tool.total,
          positive: tool.positive,
          negative: tool.negative,
          acceptance_rate: tool.acceptance_rate,
        },
      })
    }
  }

  // Rule 4 — draft approval per template.
  for (const draft of metrics.draft_approval.by_type) {
    const denom = draft.approved + draft.rejected
    if (denom >= 5 && draft.approval_rate != null && draft.approval_rate < 0.7) {
      const pct = Math.round(draft.approval_rate * 100)
      out.push({
        id: `draft_low_approval:${draft.message_type}`,
        kind: 'draft_low_approval',
        priority: 'media',
        subject: draft.message_type,
        finding_es: `Template ${draft.message_type}: aprobación ${pct}% (${draft.approved}/${denom}).`,
        suggested_action_es: `Edita la plantilla en \`src/lib/aguila/mensajeria/templates.ts\` — nota las correcciones del reviewer en \`human_feedback.corrected_action_es\`.`,
        evidence: {
          total: draft.total,
          approved: draft.approved,
          rejected: draft.rejected,
          approval_rate: draft.approval_rate,
        },
      })
    }
  }

  // Rule 5 — tone-guard drift.
  const tg = metrics.tone_guard
  if (tg.total_attempts >= 20 && tg.block_rate != null && tg.block_rate > 0.1) {
    const pct = Math.round(tg.block_rate * 100)
    out.push({
      id: 'tone_guard_drift:tenant',
      kind: 'tone_guard_drift',
      priority: 'baja',
      subject: 'tone_guard',
      finding_es: `Tone-guard bloqueó ${pct}% de borradores (${tg.blocked}/${tg.total_attempts}).`,
      suggested_action_es:
        'Revisa qué entradas upstream están disparando el guard — puede ser copy heredada o nombres de producto mal saneados.',
      evidence: { ...tg },
    })
  }

  // Rule 6 — sample size flag (always present when total is sparse).
  if (metrics.sample_size.total < 10) {
    out.push({
      id: 'sample_size_low:tenant',
      kind: 'sample_size_low',
      priority: 'baja',
      subject: 'ventana',
      finding_es: `Muestra pequeña: ${metrics.sample_size.total} decisiones en la ventana.`,
      suggested_action_es: 'Espera a tener más datos antes de actuar sobre estas métricas.',
      evidence: { ...metrics.sample_size, window_days: metrics.window.days },
    })
  }

  return out.sort((a, b) => {
    const w: Record<SuggestionPriority, number> = { alta: 3, media: 2, baja: 1 }
    const diff = w[b.priority] - w[a.priority]
    if (diff !== 0) return diff
    return a.subject.localeCompare(b.subject)
  })
}

// ── Report composer ───────────────────────────────────────────────

/**
 * Compose the Spanish report text (plain + HTML). Pure — takes metrics
 * + suggestions and produces two renderings suitable for Telegram,
 * email, or logs.
 */
export function composeReport(
  metrics: LearningMetrics,
  suggestions: Suggestion[],
): { summary_es: string; text_plain: string; text_html: string } {
  const summary = buildSummary(metrics, suggestions)

  const lines: Array<{ plain: string; html: string }> = []

  // Header
  lines.push({
    plain: `📊 Reporte de aprendizaje · ${metrics.window.company_id}`,
    html: `<b>📊 Reporte de aprendizaje · ${esc(metrics.window.company_id)}</b>`,
  })
  lines.push({
    plain: `Ventana: ${metrics.window.days} días · generado ${dateEs(metrics.window.generated_at)}`,
    html: `<i>Ventana: ${metrics.window.days} días · generado ${esc(dateEs(metrics.window.generated_at))}</i>`,
  })
  lines.push({ plain: '', html: '' })

  // Summary
  lines.push({
    plain: `Resumen: ${summary}`,
    html: `<b>Resumen:</b> ${esc(summary)}`,
  })
  lines.push({ plain: '', html: '' })

  // Predictions
  lines.push({
    plain: `🎯 Predicciones (predicho vs. real)`,
    html: `<b>🎯 Predicciones (predicho vs. real)</b>`,
  })
  for (const band of ['alta', 'media', 'baja'] as const) {
    const s = metrics.prediction_accuracy.by_band[band]
    const rate = s.verde_rate == null ? '—' : `${Math.round(s.verde_rate * 100)}% verde`
    const gap =
      s.gap_pp == null
        ? ''
        : ` · gap ${s.gap_pp >= 0 ? '+' : ''}${s.gap_pp.toFixed(1)} pp vs ${s.predicted_rate_mid}`
    const line = `• Banda ${band}: ${s.total} casos · ${rate}${gap}`
    lines.push({ plain: line, html: esc(line) })
  }
  lines.push({ plain: '', html: '' })

  // Tool acceptance
  if (metrics.tool_acceptance.by_tool.length > 0) {
    lines.push({
      plain: `🔧 Aceptación por herramienta`,
      html: `<b>🔧 Aceptación por herramienta</b>`,
    })
    for (const t of metrics.tool_acceptance.by_tool.slice(0, 6)) {
      const pct =
        t.acceptance_rate == null ? '—' : `${Math.round(t.acceptance_rate * 100)}%`
      const line = `• ${t.tool_name}: ${t.total} usos · aprobación ${pct} (+${t.positive}/-${t.negative})`
      lines.push({ plain: line, html: esc(line) })
    }
    lines.push({ plain: '', html: '' })
  }

  // Drafts
  if (metrics.draft_approval.by_type.length > 0 || metrics.draft_approval.blocked_by_tone_guard > 0) {
    lines.push({
      plain: `✉️  Borradores por plantilla`,
      html: `<b>✉️  Borradores por plantilla</b>`,
    })
    for (const d of metrics.draft_approval.by_type) {
      const pct =
        d.approval_rate == null ? '—' : `${Math.round(d.approval_rate * 100)}%`
      const line = `• ${d.message_type}: ${d.total} borradores · aprobación ${pct} (${d.approved}/${d.approved + d.rejected})`
      lines.push({ plain: line, html: esc(line) })
    }
    if (metrics.draft_approval.blocked_by_tone_guard > 0) {
      const line = `• Bloqueados por tone-guard: ${metrics.draft_approval.blocked_by_tone_guard}`
      lines.push({ plain: line, html: esc(line) })
    }
    lines.push({ plain: '', html: '' })
  }

  // Suggestions
  if (suggestions.length > 0) {
    lines.push({
      plain: `💡 Sugerencias`,
      html: `<b>💡 Sugerencias</b>`,
    })
    for (const sug of suggestions) {
      const marker = sug.priority === 'alta' ? '🚨' : sug.priority === 'media' ? '📝' : '📎'
      const l1 = `${marker} [${sug.priority}] ${sug.finding_es}`
      const l2 = `   → ${sug.suggested_action_es}`
      lines.push({ plain: l1, html: esc(l1) })
      lines.push({ plain: l2, html: esc(l2) })
    }
    lines.push({ plain: '', html: '' })
  }

  // Footer
  lines.push({
    plain: `Reporte automático · propone, no muta. Ratificación humana requerida.`,
    html: `<i>Reporte automático · propone, no muta. Ratificación humana requerida.</i>`,
  })

  const text_plain = truncate(lines.map((l) => l.plain).join('\n'), 4000)
  const text_html = truncate(lines.map((l) => l.html).join('\n'), 4000)

  return { summary_es: summary, text_plain, text_html }
}

// ── Orchestrators ─────────────────────────────────────────────────

export interface AnalyzeDecisionsOptions {
  windowDays?: number
  now?: number
}

/**
 * Fetch the window of decisions, compute metrics + suggestions, and
 * compose the report. Returns the full `LearningReport`.
 */
export async function analyzeDecisions(
  supabase: SupabaseClient,
  companyId: string,
  opts: AnalyzeDecisionsOptions = {},
): Promise<LearningReport> {
  const days = clampWindow(opts.windowDays ?? DEFAULT_WINDOW_DAYS)
  const now = opts.now ?? Date.now()
  const generated_at = new Date(now).toISOString()
  const after = new Date(now - days * 86_400_000).toISOString()

  const rows = await getDecisionHistory(supabase, companyId, {
    after,
    limit: DECISION_FETCH_LIMIT,
  })

  const prediction_accuracy = computePredictionAccuracy(rows)
  const tool_acceptance = computeToolAcceptance(rows)
  const draft_approval = computeDraftApproval(rows)
  const tone_guard = computeToneGuardTrend(rows)

  const withOutcome = rows.filter((r) => r.outcome != null).length
  const withFeedback = rows.filter((r) => r.human_feedback != null).length

  const metrics: LearningMetrics = {
    window: { days, generated_at, company_id: companyId },
    sample_size: { total: rows.length, with_outcome: withOutcome, with_feedback: withFeedback },
    prediction_accuracy,
    tool_acceptance,
    draft_approval,
    tone_guard,
  }

  const suggestions = suggestAdjustments(metrics)
  const composed = composeReport(metrics, suggestions)

  return {
    metrics,
    suggestions,
    summary_es: composed.summary_es,
    text_plain: composed.text_plain,
    text_html: composed.text_html,
  }
}

/**
 * The main entry point. Produces a learning report and logs the run
 * itself to `agent_decisions` so the report is queryable + replayable
 * via the standard Phase 3 #3 helpers.
 *
 * Envelope matches the other CRUZ AI tool responses so callers can
 * destructure the same `{ success, data, error }` shape.
 */
export async function generateWeeklyReport(
  supabase: SupabaseClient,
  companyId: string,
  opts: AnalyzeDecisionsOptions = {},
): Promise<AgentToolResponse<LearningReport>> {
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }

  try {
    const report = await withDecisionLog(
      supabase,
      {
        companyId,
        toolName: 'learning_loop',
        workflow: 'learning_report',
        triggerType: 'cron',
        toolInput: { windowDays: opts.windowDays ?? DEFAULT_WINDOW_DAYS },
        decisionOverride: `learning_loop: ${opts.windowDays ?? DEFAULT_WINDOW_DAYS}d report`,
      },
      () => analyzeDecisions(supabase, companyId, opts),
    )
    return { success: true, data: report, error: null }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Internals ─────────────────────────────────────────────────────

function extractBand(row: DecisionRow): PredictionBand | null {
  const out = row.tool_output as
    | { data?: { band_es?: string } }
    | { band_es?: string }
    | null
    | undefined
  const v =
    (out as { data?: { band_es?: string } } | null | undefined)?.data?.band_es ??
    (out as { band_es?: string } | null | undefined)?.band_es ??
    null
  if (v === 'alta' || v === 'media' || v === 'baja') return v
  return null
}

function extractMessageType(row: DecisionRow): string | null {
  const out = row.tool_output as
    | { data?: { message_type?: string } }
    | { message_type?: string }
    | null
    | undefined
  return (
    (out as { data?: { message_type?: string } } | null | undefined)?.data?.message_type ??
    (out as { message_type?: string } | null | undefined)?.message_type ??
    null
  )
}

function buildSummary(metrics: LearningMetrics, suggestions: Suggestion[]): string {
  const topPri = suggestions.find((s) => s.priority === 'alta')
  if (topPri) return topPri.finding_es

  const pa = metrics.prediction_accuracy.overall
  if (pa.total > 0 && pa.verde_rate != null) {
    return `${pa.total} predicciones con resultado · ${Math.round(pa.verde_rate * 100)}% verde.`
  }
  if (metrics.sample_size.total === 0) {
    return `Sin decisiones registradas en la ventana — opera con normalidad.`
  }
  return `${metrics.sample_size.total} decisiones en la ventana · sin hallazgos críticos.`
}

function clampWindow(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_DAYS
  return Math.max(1, Math.min(90, Math.floor(n)))
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  const slice = text.slice(0, limit)
  const nl = slice.lastIndexOf('\n')
  const cut = nl > limit - 500 ? nl : limit
  return `${text.slice(0, cut)}\n…`
}

function dateEs(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
    const fmt = new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })
    return fmt.format(d)
  } catch {
    return iso.slice(0, 10)
  }
}
