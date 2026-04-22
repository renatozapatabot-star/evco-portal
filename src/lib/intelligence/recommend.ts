/**
 * recommend.ts — pure, rule-based next-action recommender.
 *
 * Why this exists:
 *   Phase 1 shipped signals: streaks, proveedor health, fracción health,
 *   volume summaries, predictions, anomalies. Every consumer (admin
 *   cockpit, CRUZ AI, Mensajería drafts, email briefings) has to answer
 *   the same question from those signals:
 *
 *     "Given these signals, what should the operator DO?"
 *
 *   Today each consumer writes ad-hoc logic. This module centralizes the
 *   rules so every surface makes the same call from the same inputs.
 *
 * Design:
 *   - Pure function. Zero I/O. Input = structured signals, output =
 *     Recommendation[]. Tested with fixtures.
 *   - Spanish-first copy. Every recommendation carries `action_es` and
 *     `rationale_es` already humanized for direct surface rendering.
 *   - Deterministic ordering — priority desc, then subject lexicographic.
 *   - Each recommendation has a `kind` tag so downstream filters can
 *     decide which kinds belong on which surface (e.g. Mensajería drafts
 *     only show `notify_client` kinds).
 *
 * What this is NOT:
 *   - Not an executor. This proposes actions; humans (or Tito via the
 *     approval gate) authorize them. See CLAUDE.md approval-gate rule.
 *   - Not an ML model. Transparent rules an operator can reason about.
 *   - Not a notifier. Consumers call `sendTelegram` / `dispatchMensajeria`
 *     separately after reviewing the recommendations.
 */

import type {
  Anomaly,
  FraccionHealth,
  PartStreak,
  ProveedorHealth,
  VerdePrediction,
  VolumeSummary,
} from './crossing-insights'

export type RecommendationKind =
  | 'celebrate_streak'
  | 'watch_broken_streak'
  | 'validate_new_proveedor'
  | 'review_supplier_slip'
  | 'prioritize_rojo_review'
  | 'escalate_fraccion_risk'
  | 'investigate_volume_spike'
  | 'monitor_volume_drop'
  | 'no_action'

export type RecommendationPriority = 'low' | 'medium' | 'high'

export interface Recommendation {
  kind: RecommendationKind
  priority: RecommendationPriority
  /** The subject this recommendation applies to — SKU, proveedor, chapter, or 'tenant'. */
  subject: string
  /** Spanish action copy (imperative, short). */
  action_es: string
  /** Spanish rationale — why this action. */
  rationale_es: string
  /** Machine-readable context for downstream consumers. */
  metadata: Record<string, unknown>
}

export interface RecommendInput {
  /** Optional — when present, drives prediction-based recs. */
  prediction?: VerdePrediction | null
  /** Optional — present for SKU-focused recs. */
  streak?: PartStreak | null
  /** Optional — present when we know the dominant proveedor. */
  proveedor?: ProveedorHealth | null
  /** Optional — used for chapter escalations. */
  fraccionHealth?: FraccionHealth | null
  /** Tenant-wide anomalies in the window. */
  anomalies?: Anomaly[]
  /** Tenant-wide volume summary. */
  volume?: VolumeSummary | null
}

/**
 * Run the rule set against the provided signals. Returns zero-to-many
 * recommendations sorted by priority desc, then subject asc.
 *
 * The rules are deliberately transparent:
 *   - streak ≥ 6 verdes + high band         → celebrate_streak (low prio)
 *   - just_broke_streak                     → watch_broken_streak (medium)
 *   - prediction band 'low' + total ≥ 3     → prioritize_rojo_review (high)
 *   - proveedor pct_verde < 75% + total ≥ 5 → review_supplier_slip (medium)
 *   - fraccion pct_verde < 75% + total ≥ 10 → escalate_fraccion_risk (medium)
 *   - Anomaly kind 'new_proveedor'          → validate_new_proveedor (medium)
 *   - Anomaly kind 'volume_spike'           → investigate_volume_spike (medium)
 *   - volume.delta_pct < -40 + prior ≥ 5    → monitor_volume_drop (low)
 *
 * If no rule fires, returns a single `no_action` recommendation so
 * consumers can render "Sin acciones prioritarias · sigue el ritmo" UX.
 */
export function recommendNextAction(input: RecommendInput): Recommendation[] {
  const recs: Recommendation[] = []

  // 1. Celebrate a strong streak.
  if (
    input.streak &&
    input.streak.current_verde_streak >= 6 &&
    input.prediction?.band === 'high'
  ) {
    recs.push({
      kind: 'celebrate_streak',
      priority: 'low',
      subject: input.streak.cve_producto,
      action_es: `Celebra la racha: ${input.streak.cve_producto} lleva ${input.streak.current_verde_streak} verdes consecutivos.`,
      rationale_es: `Es señal fuerte de control del cruce — comparte con el cliente y documenta el patrón ganador.`,
      metadata: {
        cve_producto: input.streak.cve_producto,
        streak: input.streak.current_verde_streak,
      },
    })
  }

  // 2. Watch a freshly broken streak.
  if (input.streak?.just_broke_streak) {
    recs.push({
      kind: 'watch_broken_streak',
      priority: 'medium',
      subject: input.streak.cve_producto,
      action_es: `Revisa ${input.streak.cve_producto}: racha verde rota en los últimos 30 días.`,
      rationale_es: `La racha anterior era señal fuerte; el quiebre sugiere cambio en la partida, proveedor o fracción. Vale una mirada antes del próximo cruce.`,
      metadata: {
        cve_producto: input.streak.cve_producto,
        last_semaforo: input.streak.last_semaforo,
      },
    })
  }

  // 3. Predicted low — prioritize document review.
  if (
    input.prediction &&
    input.prediction.band === 'low' &&
    input.prediction.total_crossings >= 3
  ) {
    recs.push({
      kind: 'prioritize_rojo_review',
      priority: 'high',
      subject: input.prediction.cve_producto,
      action_es: `Prepara documentación de ${input.prediction.cve_producto} antes del cruce — probabilidad verde ${Math.round(input.prediction.probability * 100)}%.`,
      rationale_es: `Confianza ${input.prediction.band}: ${input.prediction.factors
        .filter((f) => f.delta_pp < 0)
        .map((f) => f.detail)
        .slice(0, 2)
        .join(' · ')}`,
      metadata: {
        cve_producto: input.prediction.cve_producto,
        probability: input.prediction.probability,
        band: input.prediction.band,
      },
    })
  }

  // 4. Supplier slip.
  if (
    input.proveedor &&
    input.proveedor.pct_verde != null &&
    input.proveedor.pct_verde < 75 &&
    input.proveedor.total_crossings >= 5
  ) {
    recs.push({
      kind: 'review_supplier_slip',
      priority: 'medium',
      subject: input.proveedor.cve_proveedor,
      action_es: `Audita proveedor ${input.proveedor.cve_proveedor}: ${input.proveedor.pct_verde}% verde en ${input.proveedor.total_crossings} cruces.`,
      rationale_es: `Debajo del umbral de 75%. Conviene revisar facturas, clasificación y documentos antes de seguir cruzando con este proveedor.`,
      metadata: {
        cve_proveedor: input.proveedor.cve_proveedor,
        pct_verde: input.proveedor.pct_verde,
        total_crossings: input.proveedor.total_crossings,
      },
    })
  }

  // 5. Fracción chapter escalation.
  if (
    input.fraccionHealth &&
    input.fraccionHealth.pct_verde != null &&
    input.fraccionHealth.pct_verde < 75 &&
    input.fraccionHealth.total_crossings >= 10
  ) {
    recs.push({
      kind: 'escalate_fraccion_risk',
      priority: 'medium',
      subject: `capitulo-${input.fraccionHealth.chapter}`,
      action_es: `Escala capítulo ${input.fraccionHealth.chapter}: ${input.fraccionHealth.pct_verde}% verde en ${input.fraccionHealth.total_crossings} cruces.`,
      rationale_es: `Riesgo tarifario concentrado. Considera revisar criterios de clasificación con el equipo OCA antes del próximo lote.`,
      metadata: {
        chapter: input.fraccionHealth.chapter,
        pct_verde: input.fraccionHealth.pct_verde,
      },
    })
  }

  // 6. Anomaly-driven recs — one recommendation per anomaly with a
  //    known mapping. Unknown anomaly kinds pass through silently.
  for (const anomaly of input.anomalies ?? []) {
    if (anomaly.kind === 'new_proveedor') {
      recs.push({
        kind: 'validate_new_proveedor',
        priority: 'medium',
        subject: anomaly.subject,
        action_es: `Valida proveedor nuevo ${anomaly.subject} antes de escalar volumen.`,
        rationale_es: anomaly.detail,
        metadata: { ...anomaly.metadata, anomaly_score: anomaly.score },
      })
    } else if (anomaly.kind === 'volume_spike') {
      recs.push({
        kind: 'investigate_volume_spike',
        priority: 'medium',
        subject: anomaly.subject,
        action_es: `Investiga salto de volumen en ${anomaly.subject}: ${anomaly.detail}.`,
        rationale_es: `Volumen inusual puede reflejar demanda legítima o error de captura. Confírma con el shipper antes del próximo cruce.`,
        metadata: { ...anomaly.metadata, anomaly_score: anomaly.score },
      })
    }
  }

  // 7. Tenant-wide volume drop.
  if (
    input.volume &&
    input.volume.delta_pct != null &&
    input.volume.delta_pct < -40 &&
    input.volume.prior_7d >= 5
  ) {
    recs.push({
      kind: 'monitor_volume_drop',
      priority: 'low',
      subject: 'tenant',
      action_es: `Monitorea la caída de volumen: ${Math.abs(Math.round(input.volume.delta_pct))}% menos partidas vs. semana anterior.`,
      rationale_es: `Puede ser estacional o un bloqueo operativo. Revisa con el shipper si la baja persiste 48h más.`,
      metadata: {
        recent_7d: input.volume.recent_7d,
        prior_7d: input.volume.prior_7d,
        delta_pct: input.volume.delta_pct,
      },
    })
  }

  // If nothing fired, surface a calm "no action" state.
  if (recs.length === 0) {
    recs.push({
      kind: 'no_action',
      priority: 'low',
      subject: 'tenant',
      action_es: `Sin acciones prioritarias · la operación está en calma.`,
      rationale_es: `Los indicadores están dentro de umbrales normales. Continúa con el ritmo habitual.`,
      metadata: {},
    })
  }

  return sortRecommendations(recs)
}

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    if (diff !== 0) return diff
    return a.subject.localeCompare(b.subject)
  })
}
