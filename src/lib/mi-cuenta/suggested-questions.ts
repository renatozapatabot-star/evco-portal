/**
 * PORTAL · /mi-cuenta/cruz — personalized suggestion builder.
 *
 * The starter-prompt list on the client-facing assistant is no longer
 * a static array of generic openers. It now reads cheap, already-loaded
 * client signals (A/R aging, recent tráfico id, month-to-date shipment
 * count, carrier-risk heuristic) and composes 4–5 prompts that feel
 * like a real assistant: "how is MY last shipment going", not "how
 * do shipments work".
 *
 * Contract:
 *   - Pure. No Supabase calls, no env reads. Caller hydrates ctx.
 *   - Spanish primary, calm tone (client-accounting-ethics.md §tone).
 *   - Never fewer than 3, never more than 5 prompts — so the chat
 *     surface stays readable at 375px.
 *   - Every prompt has a stable `id` for tests + telemetry. The `text`
 *     is what gets auto-sent to /api/cruz-chat when the chip is tapped.
 *   - No relative dates, no urgency language, no internal operator
 *     names. Pedimentos keep spaces, fracciones keep dots (the chat
 *     itself renders them; builder just includes ids as-is).
 */

export interface SuggestedQuestionsContext {
  /** Saldo pendiente in MXN. 0 when the client is al corriente. */
  arTotalMxn: number
  /** # of invoices aged 61+ days (61-90 + 90+). Drives aging prompt. */
  arOldCount: number
  /** The most-recent tráfico id if any — e.g. "EVCO-A0234" or a number. */
  lastTraficoId: string | null
  /** Shipments this calendar month (tenant-scoped). */
  shipmentsThisMonth: number
  /** True when at least one carrier shows an above-average inspection rate. */
  hasRiskyCarrier: boolean
  /** Short-form client display name — "EVCO Plastics" etc. Optional. */
  clientShortName?: string | null
}

export interface SuggestedQuestion {
  /** Stable key — unit tests + analytics key off this. */
  id: string
  /** What the user sees on the chip AND what gets sent to CRUZ. */
  text: string
  /**
   * Optional telemetry tag explaining why this prompt surfaced —
   * purely advisory, useful when debugging "why did I see this?".
   */
  reason?: string
}

const MIN_SUGGESTIONS = 3
const MAX_SUGGESTIONS = 5

export function buildSuggestedQuestions(
  ctx: SuggestedQuestionsContext,
): SuggestedQuestion[] {
  const picks: SuggestedQuestion[] = []

  if (ctx.lastTraficoId) {
    picks.push({
      id: 'last_trafico_status',
      text: `¿Cómo va mi último embarque ${ctx.lastTraficoId}?`,
      reason: 'recent-trafico-available',
    })
  }

  if (ctx.arOldCount > 0) {
    picks.push({
      id: 'ar_old_invoices',
      text:
        ctx.arOldCount === 1
          ? 'Tengo una factura de más de 60 días — ¿qué conviene hacer?'
          : `Tengo ${ctx.arOldCount} facturas de más de 60 días — ¿qué conviene hacer?`,
      reason: 'aging-61-plus',
    })
  }

  picks.push({
    id: 'shipments_this_month',
    text: `Muéstrame mis embarques de este mes`,
    reason: 'always-useful',
  })

  if (ctx.lastTraficoId) {
    picks.push({
      id: 'duty_delta_last',
      text: '¿Por qué cambió mi arancel en la última factura?',
      reason: 'recent-trafico-available',
    })
  }

  if (ctx.hasRiskyCarrier) {
    picks.push({
      id: 'risky_carriers',
      text: '¿Cuáles son mis rutas o carriers con más inspección?',
      reason: 'risk-carrier-flagged',
    })
  }

  if (picks.length < MIN_SUGGESTIONS && ctx.arTotalMxn > 0) {
    picks.push({
      id: 'ar_summary',
      text: '¿Cuál es el resumen de mi cuenta esta semana?',
      reason: 'fill-min-slot',
    })
  }

  if (picks.length < MIN_SUGGESTIONS) {
    picks.push({
      id: 'tmec_duties_how',
      text: '¿Cómo se calcula el DTA y el IVA en mis pedimentos?',
      reason: 'knowledge-fallback',
    })
  }
  if (picks.length < MIN_SUGGESTIONS) {
    picks.push({
      id: 'crossings_recent',
      text: '¿Cuándo fue mi último cruce por el puente?',
      reason: 'knowledge-fallback',
    })
  }

  const seen = new Set<string>()
  const unique = picks.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  return unique.slice(0, MAX_SUGGESTIONS)
}

export const SUGGESTED_QUESTION_LIMITS = {
  min: MIN_SUGGESTIONS,
  max: MAX_SUGGESTIONS,
} as const
