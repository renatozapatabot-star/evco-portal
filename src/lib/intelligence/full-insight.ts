/**
 * full-insight.ts — unified composer that turns an identifier
 * (SKU, trafico) into every downstream signal a caller needs:
 *
 *   prediction + explanation + streak + proveedor + fraccion
 *   + recommendations + Spanish one-line summary
 *
 * Why this exists:
 *   Every consumer (admin cockpit card, Mensajería draft, CRUZ AI tool,
 *   briefing email, PDF export) was rebuilding the same bundle —
 *   "call predict, then call explain, then maybe fire off recommend."
 *   This module centralizes that contract so a Grok agent (or a hand-
 *   rolled route handler) can say one sentence: "give me the full
 *   insight for this target."
 *
 * Design:
 *   - Single DB-facing entry point: `buildFullCrossingInsight`.
 *   - Returns `null` if there is not enough signal to compose anything
 *     meaningful (tenant empty, target never crossed, etc.). The UI
 *     degrades gracefully to the pre-activation empty state.
 *   - Deterministic — same inputs produce same outputs. Useful for
 *     tests + idempotent audit trails.
 *   - No writes. No notifications. Proposes; never acts. See the
 *     approval-gate rule in CLAUDE.md.
 *
 * Usage:
 *   const insight = await buildFullCrossingInsight(sb, 'evco', {
 *     type: 'sku', cveProducto: '6600-1108'
 *   })
 *   // insight.prediction · insight.explanation · insight.recommendations
 *
 *   const shipment = await buildFullCrossingInsight(sb, 'evco', {
 *     type: 'trafico', traficoId: '9254-X3435'
 *   })
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeSkuSignals,
  type PredictByIdOptions,
  type SkuSignals,
} from './predict-by-id'
import {
  explainVerdePrediction,
  explainVerdePredictionOneLine,
  explainVerdePredictionPlainText,
  type ExplainOptions,
  type ExplainOutput,
} from './explain'
import { recommendNextAction, type Recommendation } from './recommend'

/** Discriminated union of supported targets. Expand as new surfaces land. */
export type InsightTarget =
  | { type: 'sku'; cveProducto: string }
  | { type: 'trafico'; traficoId: string }

export interface BuildFullInsightOptions extends PredictByIdOptions {
  /** Options forwarded to `explainVerdePrediction` (bullet count, date fmt). */
  explain?: ExplainOptions
}

export interface FullCrossingInsight {
  /** The original target this insight was built for. */
  target: InsightTarget
  /** Resolved SKU that the insight is ultimately about. For a trafico
   * target, this is the dominant SKU picked from its partidas. */
  cve_producto: string
  /** When the insight was assembled. */
  generated_at: string
  /** The tenant slug. */
  company_id: string
  /** Structured signals — each one can be re-rendered independently. */
  signals: SkuSignals
  /** The explainer output ready for UI consumption. */
  explanation: ExplainOutput
  /** Short-format explanations for narrow surfaces. */
  one_line: string
  /** Multi-line plain-text rendering for email / Mensajería / PDF. */
  plain_text: string
  /** Actionable recommendations derived from the signals. */
  recommendations: Recommendation[]
  /** Spanish single-sentence takeaway suitable for Telegram/headline use. */
  summary_es: string
}

/**
 * Build a full-fidelity insight for the given target. Returns null when
 * the target has no signal (never crossed, tenant empty, etc).
 */
export async function buildFullCrossingInsight(
  supabase: SupabaseClient,
  companyId: string,
  target: InsightTarget,
  opts: BuildFullInsightOptions = {},
): Promise<FullCrossingInsight | null> {
  if (!companyId) return null

  const cveProducto = await resolveTargetSku(supabase, companyId, target)
  if (!cveProducto) return null

  const signals = await computeSkuSignals(supabase, companyId, cveProducto, opts)
  if (!signals) return null

  const explanation = explainVerdePrediction(signals.prediction, opts.explain)
  const one_line = explainVerdePredictionOneLine(signals.prediction)
  const plain_text = explainVerdePredictionPlainText(signals.prediction, opts.explain)

  const recommendations = recommendNextAction({
    prediction: signals.prediction,
    streak: signals.streak,
    proveedor: signals.proveedor,
    fraccionHealth: signals.fraccionHealth,
  })

  return {
    target,
    cve_producto: cveProducto,
    generated_at: new Date(opts.now ?? Date.now()).toISOString(),
    company_id: companyId,
    signals,
    explanation,
    one_line,
    plain_text,
    recommendations,
    summary_es: buildSummary(cveProducto, signals, recommendations, target),
  }
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Resolve an InsightTarget to the SKU this insight is really about.
 *   - For 'sku' targets, that's trivially `cveProducto`.
 *   - For 'trafico' targets, look up the trafico's partidas and pick
 *     the SKU with the most partidas (the shipment's "dominant" SKU).
 */
async function resolveTargetSku(
  supabase: SupabaseClient,
  companyId: string,
  target: InsightTarget,
): Promise<string | null> {
  if (target.type === 'sku') {
    return target.cveProducto?.trim() || null
  }

  if (target.type === 'trafico') {
    if (!target.traficoId) return null

    const { data: facturas } = await supabase
      .from('globalpc_facturas')
      .select('folio')
      .eq('company_id', companyId)
      .eq('cve_trafico', target.traficoId)
    const folios = ((facturas ?? []) as Array<{ folio: number | null }>)
      .map((f) => f.folio)
      .filter((x): x is number => x != null)
    if (folios.length === 0) return null

    const { data: partidas } = await supabase
      .from('globalpc_partidas')
      .select('cve_producto')
      .eq('company_id', companyId)
      .in('folio', folios)
      .limit(1000)

    const counts = new Map<string, number>()
    for (const p of (partidas ?? []) as Array<{ cve_producto: string | null }>) {
      if (!p.cve_producto) continue
      counts.set(p.cve_producto, (counts.get(p.cve_producto) ?? 0) + 1)
    }
    return pickTop(counts)
  }

  return null
}

function pickTop(counts: Map<string, number>): string | null {
  let top: string | null = null
  let topN = 0
  for (const [key, n] of counts) {
    if (n > topN) {
      topN = n
      top = key
    }
  }
  return top
}

function buildSummary(
  cveProducto: string,
  signals: SkuSignals,
  recs: Recommendation[],
  target: InsightTarget,
): string {
  const pct = Math.round(signals.prediction.probability * 100)
  const band = signals.prediction.band
  const bandEs = band === 'high' ? 'alta' : band === 'medium' ? 'media' : 'baja'

  const primaryRec = recs.find((r) => r.priority === 'high') ?? recs[0]
  const lead =
    target.type === 'trafico'
      ? `Tráfico ${target.traficoId} (SKU dominante ${cveProducto})`
      : `SKU ${cveProducto}`

  if (primaryRec && primaryRec.kind !== 'no_action') {
    return `${lead}: ${pct}% verde · confianza ${bandEs} · ${primaryRec.action_es}`
  }
  return `${lead}: ${pct}% verde · confianza ${bandEs} · operación en calma.`
}
