/**
 * draft-composer.ts — Phase 3 #4 Mensajería Draft Composer.
 *
 * Orchestrates: signal fetch → template selection → personalization →
 * tone guard → decision-log persistence. Produces a structured Spanish
 * draft message ready for human review. Does NOT send anything.
 *
 * Design:
 *   - Proposes only. Every draft is a decision logged to
 *     `agent_decisions` (Phase 3 #3) with `autonomy_level=0`.
 *     Humans — specifically Tito / Renato IV for client-facing drafts
 *     per the CLAUDE.md approval gate — authorize before any send.
 *   - Tenant-isolated. `companyId` is required on every entry point.
 *     Signals come from `buildFullCrossingInsight` which is already
 *     tenant-scoped at the SQL layer.
 *   - No external side effects. No Telegram, no Mensajería send, no
 *     email. The tool only composes + logs.
 *   - Rule-based. No LLM calls — templates render deterministically
 *     from bindings. Sonnet polish is an explicit future phase, not
 *     Phase 3 #4.
 *
 * Integration:
 *   - Input shape: either a concrete `TemplateBindings` object (pure,
 *     for tests + scripts that already have the data), OR a
 *     high-level `DraftRequest` (trafico + hint about what the user
 *     wants) that the composer expands via Phase 2/3 #1 primitives.
 *   - Output: `AgentToolResponse<DraftMensajeriaResponse>` — same
 *     envelope as the other CRUZ AI tools.
 *   - Logging: `withDecisionLog` wraps the compose step so every draft
 *     row carries tool_name, tool_input, tool_output, tenant, timing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildFullCrossingInsight } from '@/lib/intelligence/full-insight'
import type { Recommendation } from '@/lib/intelligence/recommend'
import { withDecisionLog } from '@/lib/intelligence/decision-log'
import type { AgentToolResponse } from '@/lib/aguila/tools'
import {
  personalizeDraft,
  toneGuard,
  MESSAGE_TYPE_LABEL_ES,
  type Audience,
  type MessageType,
  type RenderedMessage,
  type TemplateBindings,
  type PreventiveAlertBindings,
  type DocumentRequestBindings,
  type StatusUpdateBindings,
  type AnomalyEscalationBindings,
  type DriverDispatchBindings,
} from './templates'

// ── Public types ──────────────────────────────────────────────────

/** A pre-resolved set of signals + optional type hint the composer
 *  expands into a draft. Primary use cases:
 *    - `{ kind: 'trafico', traficoId: 'T-1' }`
 *        → composer runs `buildFullCrossingInsight` and picks a type
 *          via `suggestMessageType`.
 *    - `{ kind: 'sku', cveProducto: '6600-1108' }`
 *        → same, but for an SKU-level insight.
 *    - `{ kind: 'anomaly', anomaly: { kind, subject, ... } }`
 *        → short-circuits to anomaly_escalation.
 *    - `{ kind: 'bindings', bindings: { type: 'driver_dispatch', ... } }`
 *        → caller already has exact bindings; skip the fetch.
 */
export type DraftRequest =
  | {
      kind: 'trafico'
      traficoId: string
      /** When set, overrides `suggestMessageType`. */
      messageType?: MessageType
      /** Override for `product_name` on client-facing templates. */
      productName?: string
    }
  | {
      kind: 'sku'
      cveProducto: string
      messageType?: MessageType
      productName?: string
    }
  | {
      kind: 'anomaly'
      anomaly: AnomalyInput
    }
  | {
      kind: 'status'
      pedimento_number: string
      status_es: string
      trafico_id?: string | null
      fecha_programada?: string | null
    }
  | {
      kind: 'driver'
      dispatch: DriverDispatchBindings
    }
  | {
      /** Escape hatch: caller already built bindings in full. */
      kind: 'bindings'
      bindings: TemplateBindings
    }

export interface AnomalyInput {
  kind: string
  subject: string
  detail_es: string
  /** 0..1 severity (aligned with Phase 2 Anomaly shape). */
  score: number
  action_es?: string
}

export interface DraftMensajeriaResponse {
  draft: RenderedMessage
  /** Final message type picked (same as `draft.type`). */
  message_type: MessageType
  /** Final audience picked (same as `draft.audience`). */
  audience: Audience
  /** Issues surfaced by `toneGuard`. Empty = clean. */
  tone_issues: string[]
  /** Human-readable Spanish label for the chosen type. */
  message_type_label_es: string
  /** The signals / recommendation the suggestor used, when applicable. */
  suggestion_rationale_es: string | null
  /** When the composer logged the decision, returns the row id. `null`
   *  when the log insert failed (never throws). */
  decision_log_id: string | null
}

// ── suggestMessageType ────────────────────────────────────────────

/** Signals the suggestor looks at. All optional — the composer fills
 *  as many fields as it can from the request shape. */
export interface SuggestSignals {
  /** Verde-probability band from the predictor. */
  band_es?: 'alta' | 'media' | 'baja'
  /** Whether a recent predictor factor points to missing documentation. */
  missing_docs?: boolean
  /** Whether a streak just broke (short-term adverse signal). */
  just_broke_streak?: boolean
  /** An anomaly signal (used to short-circuit to anomaly_escalation). */
  anomaly_kind?: string
  /** Whether the caller already narrowed to a status-transition context. */
  has_status_transition?: boolean
  /** Whether the caller already narrowed to a driver-dispatch context. */
  has_driver_context?: boolean
  /** Top recommendation from the agent — its kind informs routing. */
  top_recommendation_kind?: Recommendation['kind']
}

export interface MessageTypeSuggestion {
  type: MessageType
  audience: Audience
  rationale_es: string
}

/** Pure: pick the highest-fit message type given signals. Returns null
 *  when no rule fires (the composer falls back to `preventive_alert`
 *  on client-audience requests, or throws on pure-bindings paths). */
export function suggestMessageType(
  signals: SuggestSignals,
): MessageTypeSuggestion | null {
  if (signals.has_driver_context) {
    return {
      type: 'driver_dispatch',
      audience: 'driver',
      rationale_es: 'Contexto de despacho de conductor reconocido.',
    }
  }

  if (signals.has_status_transition) {
    return {
      type: 'status_update',
      audience: 'client',
      rationale_es: 'Transición de estatus de pedimento reconocida.',
    }
  }

  if (signals.anomaly_kind) {
    return {
      type: 'anomaly_escalation',
      audience: 'internal',
      rationale_es: `Anomalía ${signals.anomaly_kind} detectada — se enruta a inbox interno.`,
    }
  }

  // Prefer a document request when docs appear to be the blocker.
  if (signals.missing_docs) {
    return {
      type: 'document_request',
      audience: 'client',
      rationale_es: 'Señal de documentación faltante — se sugiere solicitud al cliente.',
    }
  }

  // Low band or broken streak → preventive heads-up (calm tone).
  if (signals.band_es === 'baja' || signals.just_broke_streak) {
    return {
      type: 'preventive_alert',
      audience: 'client',
      rationale_es:
        signals.band_es === 'baja'
          ? 'Probabilidad verde baja — se sugiere preparación preventiva al cliente.'
          : 'Racha verde reciente rota — se sugiere heads-up preventivo.',
    }
  }

  // Defensible default when the agent wants to reach the client
  // proactively (e.g. top rec is `prioritize_rojo_review` / `validate_new_proveedor`):
  if (
    signals.top_recommendation_kind === 'prioritize_rojo_review' ||
    signals.top_recommendation_kind === 'validate_new_proveedor'
  ) {
    return {
      type: 'preventive_alert',
      audience: 'client',
      rationale_es: 'Recomendación de alta prioridad sobre un SKU o proveedor — se sugiere heads-up preventivo.',
    }
  }

  return null
}

// ── draftMensajeria — main orchestrator ──────────────────────────

export interface DraftMensajeriaOptions {
  /** Forwarded to `buildFullCrossingInsight` when the composer needs
   *  to fetch signals (trafico / sku requests). */
  windowDays?: number
  /** Override current-time anchor (tests). */
  now?: number
  /** When true, the composer still inserts the decision-log row even
   *  if the tone guard fires. When false (default), tone-issue drafts
   *  are still returned but the insert is skipped so reviewers don't
   *  see malformed drafts in the queue. */
  logToneIssues?: boolean
}

/**
 * Produce a Spanish draft message for the given request. Never sends;
 * always logs (modulo the tone-issue gate) via the Phase 3 #3 logger.
 */
export async function draftMensajeria(
  supabase: SupabaseClient,
  companyId: string,
  request: DraftRequest,
  opts: DraftMensajeriaOptions = {},
): Promise<AgentToolResponse<DraftMensajeriaResponse>> {
  if (!companyId) {
    return { success: false, data: null, error: 'invalid_companyId' }
  }

  try {
    const built = await buildDraft(supabase, companyId, request, opts)
    if (!built) {
      return {
        success: true,
        data: null,
        error: 'No se pudo componer un borrador para este contexto (señal insuficiente).',
      }
    }

    // Log through the decision logger. The envelope itself is the
    // tool_output — the agent_decisions row captures the full draft
    // body, tone issues, and rationale in one place.
    const toolInput = normalizeRequestForLog(request)
    const skipLog = !opts.logToneIssues && built.tone_issues.length > 0

    let decision_log_id: string | null = null

    if (skipLog) {
      // Still record a minimal "tone_issues_blocked" row so the
      // learning loop can see what kind of inputs produce bad copy.
      decision_log_id = await logMinimalIssue(
        supabase,
        companyId,
        toolInput,
        built,
      )
    } else {
      // Happy path — log with the full tool_output.
      const resp: AgentToolResponse<DraftMensajeriaResponse> = {
        success: true,
        data: built,
        error: null,
      }
      // withDecisionLog wraps an async fn; we already have the result,
      // so we wrap a trivial `return resp` inside a sync-as-async fn.
      await withDecisionLog(
        supabase,
        {
          companyId,
          toolName: 'draft_mensajeria',
          workflow: 'mensajeria_draft',
          triggerType: 'script',
          triggerId: primaryTriggerId(request) ?? undefined,
          toolInput,
          decisionOverride: `draft_mensajeria: ${built.message_type_label_es} · ${built.audience}`,
        },
        async () => resp,
      )
      // We don't have the row id from `withDecisionLog` (by design —
      // it fire-and-forgets the insert on finally); null here is
      // correct and documented in the response type.
    }

    return {
      success: true,
      data: { ...built, decision_log_id },
      error: null,
    }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Internals ────────────────────────────────────────────────────

async function buildDraft(
  supabase: SupabaseClient,
  companyId: string,
  request: DraftRequest,
  opts: DraftMensajeriaOptions,
): Promise<DraftMensajeriaResponse | null> {
  // Escape hatch — caller already has exact bindings. Render + return.
  if (request.kind === 'bindings') {
    const draft = personalizeDraft(request.bindings)
    return buildResponse(draft, null)
  }

  // Status-transition: no fetch needed; render from the request.
  if (request.kind === 'status') {
    const draft = personalizeDraft({
      type: 'status_update',
      pedimento_number: request.pedimento_number,
      status_es: request.status_es,
      trafico_id: request.trafico_id ?? null,
      fecha_programada: request.fecha_programada ?? null,
    })
    return buildResponse(draft, 'Transición de pedimento observada.')
  }

  // Driver dispatch: caller provides the full bindings.
  if (request.kind === 'driver') {
    const draft = personalizeDraft({
      type: 'driver_dispatch',
      ...request.dispatch,
    })
    return buildResponse(draft, 'Contexto de despacho de conductor.')
  }

  // Anomaly: short-circuit to escalation.
  if (request.kind === 'anomaly') {
    const a = request.anomaly
    const bindings: AnomalyEscalationBindings = {
      anomaly_kind: a.kind,
      anomaly_label_es: labelFromAnomalyKind(a.kind),
      subject: a.subject,
      detail_es: a.detail_es,
      score: a.score,
      action_es: a.action_es,
    }
    const draft = personalizeDraft({ type: 'anomaly_escalation', ...bindings })
    return buildResponse(draft, 'Anomalía — se escaló a inbox interno.')
  }

  // Trafico / SKU: fetch a full insight and route by suggest.
  const insight = await buildFullCrossingInsight(
    supabase,
    companyId,
    request.kind === 'trafico'
      ? { type: 'trafico', traficoId: request.traficoId }
      : { type: 'sku', cveProducto: request.cveProducto },
    {
      windowDays: opts.windowDays,
      now: opts.now,
    },
  )
  if (!insight) return null

  const missingDocs = insightMentionsMissingDocs(insight.signals.prediction.factors)
  const topRec = insight.recommendations[0]
  const signals: SuggestSignals = {
    band_es: insight.explanation.confidence_band_label,
    missing_docs: missingDocs,
    just_broke_streak: insight.signals.streak.just_broke_streak,
    top_recommendation_kind: topRec?.kind,
  }

  const suggestion = suggestMessageType(signals)
  const chosenType =
    (request.kind === 'trafico' || request.kind === 'sku') && request.messageType
      ? request.messageType
      : suggestion?.type ?? 'preventive_alert'

  const productName =
    (request.kind === 'trafico' || request.kind === 'sku'
      ? request.productName
      : undefined) ?? undefined

  const bindings = buildBindingsFromInsight(
    chosenType,
    insight,
    productName,
    request.kind === 'trafico' ? request.traficoId : insight.target.type === 'trafico' ? insight.target.traficoId : null,
  )

  if (!bindings) return null

  const draft = personalizeDraft(bindings)
  return buildResponse(draft, suggestion?.rationale_es ?? null)
}

function buildResponse(
  draft: RenderedMessage,
  rationale: string | null,
): DraftMensajeriaResponse {
  const tone_issues = toneGuard(draft)
  return {
    draft,
    message_type: draft.type,
    audience: draft.audience,
    tone_issues,
    message_type_label_es: MESSAGE_TYPE_LABEL_ES[draft.type],
    suggestion_rationale_es: rationale,
    decision_log_id: null,
  }
}

/** Extract a useful `trigger_id` from the request for the decision
 *  log (helps the review UI group drafts per subject). */
function primaryTriggerId(request: DraftRequest): string | null {
  switch (request.kind) {
    case 'trafico':
      return request.traficoId || null
    case 'sku':
      return request.cveProducto || null
    case 'anomaly':
      return request.anomaly.subject || null
    case 'status':
      return request.pedimento_number || null
    case 'driver':
      return request.dispatch.trafico_id || null
    case 'bindings':
      // Best-effort — many bindings shapes include a cve_producto or id.
      return (
        (request.bindings as { cve_producto?: string; trafico_id?: string; pedimento_number?: string })
          .cve_producto ??
        (request.bindings as { trafico_id?: string }).trafico_id ??
        (request.bindings as { pedimento_number?: string }).pedimento_number ??
        null
      )
    default:
      return null
  }
}

function normalizeRequestForLog(request: DraftRequest): unknown {
  // Shallow-copy so downstream truncation doesn't mutate the caller's
  // input. Removes nothing (the request shape itself carries only the
  // data the operator would want to see in the log).
  return { ...request }
}

async function logMinimalIssue(
  supabase: SupabaseClient,
  companyId: string,
  toolInput: unknown,
  built: DraftMensajeriaResponse,
): Promise<string | null> {
  try {
    // Inline import to avoid circular-dep risk at module load time.
    const { logDecision } = await import('@/lib/intelligence/decision-log')
    return await logDecision(supabase, {
      trigger_type: 'script',
      company_id: companyId,
      workflow: 'mensajeria_draft',
      tool_name: 'draft_mensajeria',
      tool_input: toolInput,
      tool_output: {
        blocked: true,
        tone_issues: built.tone_issues,
        message_type: built.message_type,
      },
      decision: `draft_mensajeria: blocked by tone_guard (${built.tone_issues.length} issue${
        built.tone_issues.length === 1 ? '' : 's'
      })`,
      reasoning: built.tone_issues.join(', '),
      confidence: 1.0,
      autonomy_level: 0,
      action_taken: 'blocked:tone_guard',
    })
  } catch {
    return null
  }
}

// ── Signal helpers ───────────────────────────────────────────────

/** Scan a prediction's factor list for evidence that "missing docs"
 *  is the primary blocker. Rule-based and deterministic: any factor
 *  whose detail mentions fraccion_risk / document / docu / factura
 *  counts. Keeps the signal honest (no LLM guessing). */
function insightMentionsMissingDocs(
  factors: ReadonlyArray<{ factor: string; detail: string }>,
): boolean {
  for (const f of factors) {
    const needle = `${f.factor} ${f.detail}`.toLowerCase()
    if (
      needle.includes('documento') ||
      needle.includes('document') ||
      needle.includes('factura') ||
      needle.includes('certifi')
    ) {
      return true
    }
  }
  return false
}

function labelFromAnomalyKind(kind: string): string {
  switch (kind) {
    case 'new_proveedor':
      return 'Proveedor nuevo'
    case 'volume_spike':
      return 'Salto de volumen'
    case 'streak_break':
      return 'Racha rota'
    case 'proveedor_slip':
      return 'Deterioro de proveedor'
    case 'semaforo_rate_drop':
      return 'Bajada en tasa verde'
    default:
      return 'Anomalía'
  }
}

/** Build template bindings from a full insight + desired type. */
function buildBindingsFromInsight(
  type: MessageType,
  insight: NonNullable<Awaited<ReturnType<typeof buildFullCrossingInsight>>>,
  productName: string | undefined,
  traficoId: string | null,
): TemplateBindings | null {
  switch (type) {
    case 'preventive_alert': {
      const b: PreventiveAlertBindings = {
        cve_producto: insight.cve_producto,
        product_name: productName,
        trafico_id: traficoId,
        probability_pct: insight.explanation.probability_pct,
        short_reason_es:
          insight.explanation.bullets[0]?.label ??
          insight.signals.prediction.summary,
      }
      return { type: 'preventive_alert', ...b }
    }
    case 'document_request': {
      // Rule-based doc list — we cannot fabricate specific doc names,
      // so we use a calm generic. Operator can edit before send.
      const b: DocumentRequestBindings = {
        cve_producto: insight.cve_producto,
        product_name: productName,
        trafico_id: traficoId,
        requested_docs_es: [
          'factura comercial firmada',
          'lista de empaque (packing list)',
          'certificado de origen (si aplica T-MEC)',
        ],
        reason_es:
          `La probabilidad estimada de cruce verde es ${insight.explanation.probability_pct}%` +
          ` — con estos documentos al día reducimos el tiempo en frontera`,
      }
      return { type: 'document_request', ...b }
    }
    case 'anomaly_escalation': {
      // An anomaly kind is expected; without it we synthesize a
      // generic escalation from the prediction's top negative factor.
      const topNeg = insight.signals.prediction.factors.find(
        (f) => f.delta_pp < 0,
      )
      const b: AnomalyEscalationBindings = {
        anomaly_kind: topNeg?.factor ?? 'signal_drift',
        anomaly_label_es: labelFromAnomalyKind(topNeg?.factor ?? 'signal_drift'),
        subject: insight.cve_producto,
        detail_es:
          topNeg?.detail ??
          `Probabilidad baja (${insight.explanation.probability_pct}%)`,
        score: Math.max(
          0,
          Math.min(
            1,
            (100 - insight.explanation.probability_pct) / 100,
          ),
        ),
        action_es: insight.recommendations[0]?.action_es,
      }
      return { type: 'anomaly_escalation', ...b }
    }
    case 'status_update':
    case 'driver_dispatch':
      // These types need context the insight alone doesn't carry
      // (pedimento number / driver + lane). Caller must use the
      // dedicated DraftRequest kind ('status' / 'driver').
      return null
  }
}
