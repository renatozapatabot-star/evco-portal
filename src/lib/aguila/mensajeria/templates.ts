/**
 * templates.ts — Spanish message templates for the Mensajería draft composer.
 *
 * Each template is a PURE function: `(bindings) => RenderedMessage`. No I/O,
 * no LLM calls, no random state. Templates render deterministically so:
 *   - Unit tests can assert exact strings.
 *   - Decision-log replay is reliable (same inputs → same draft).
 *   - A reviewer can reason about what will appear before Tito sees it.
 *
 * Five templates cover the Phase 3 #4 use cases:
 *   1. preventive_alert     — client-facing heads-up (calm tone)
 *   2. document_request     — client-facing request for missing docs
 *   3. status_update        — client-facing pedimento state change
 *   4. anomaly_escalation   — internal operator heads-up
 *   5. driver_dispatch      — external driver pickup instructions
 *
 * Audience contract:
 *   - client  → sender is "Renato Zapata & Company", calm tone enforced
 *                by `toneGuard`, 5-year retention via Mensajería table
 *                when the review UI promotes an approved draft.
 *   - internal → operator inbox; operator names may appear; full palette
 *                 allowed (amber/red). Never sent to a client.
 *   - driver  → short, imperative, operational. Lane + ETA + docs.
 *
 * Nothing in this file writes to the DB. Composition + tone-guarding
 * only. Persistence lives in `draft-composer.ts` via the Phase 3 #3
 * decision logger.
 */

// ── Types ──────────────────────────────────────────────────────────

export type MessageType =
  | 'preventive_alert'
  | 'document_request'
  | 'status_update'
  | 'anomaly_escalation'
  | 'driver_dispatch'

export type Audience = 'client' | 'internal' | 'driver'

/** Brand sender line used on every client-facing draft. Hard-coded —
 *  operator names never leak to clients (core contract). */
export const CLIENT_SENDER_EN = 'Renato Zapata & Company'
export const CLIENT_SENDER_ES = 'Renato Zapata & Company'

/** Render output carries subject + body + metadata — the review UI
 *  and the decision logger both consume this shape. */
export interface RenderedMessage {
  type: MessageType
  audience: Audience
  subject_es: string
  body_es: string
  /** Short list of structured data points used in the render — kept on
   *  the draft for traceability + learning-loop replay. */
  metadata: Record<string, unknown>
}

// ── Bindings: one per template ────────────────────────────────────

export interface PreventiveAlertBindings {
  /** Internal SKU reference (not shown to client when a friendly name exists). */
  cve_producto: string
  /** Friendly product name the client uses (falls back to cve_producto). */
  product_name?: string
  trafico_id?: string | null
  probability_pct: number
  /** Short Spanish rationale — one line, NO urgency language. */
  short_reason_es?: string
}

export interface DocumentRequestBindings {
  cve_producto: string
  product_name?: string
  trafico_id?: string | null
  /** Plain-Spanish doc labels ("factura comercial firmada", "certificado de origen", …). */
  requested_docs_es: string[]
  reason_es?: string
}

export interface StatusUpdateBindings {
  pedimento_number: string
  /** Current status in Spanish ("En proceso", "Cruzado", "Liberado", etc.). */
  status_es: string
  trafico_id?: string | null
  /** Optional next-event date (ISO or humanized Spanish). */
  fecha_programada?: string | null
}

export interface AnomalyEscalationBindings {
  anomaly_kind: string
  anomaly_label_es: string
  subject: string
  detail_es: string
  score: number
  action_es?: string
}

export interface DriverDispatchBindings {
  /** Driver's name — operator-facing identifier, fine for driver context. */
  driver_name: string
  trafico_id: string
  bridge_label_es: string
  lane_label_es: string
  /** 24-hour "HH:MM" Laredo time. */
  eta_hhmm: string
  docs_status_es: 'completas' | 'pendientes' | 'en_revision'
}

export type TemplateBindings =
  | ({ type: 'preventive_alert' } & PreventiveAlertBindings)
  | ({ type: 'document_request' } & DocumentRequestBindings)
  | ({ type: 'status_update' } & StatusUpdateBindings)
  | ({ type: 'anomaly_escalation' } & AnomalyEscalationBindings)
  | ({ type: 'driver_dispatch' } & DriverDispatchBindings)

// ── Template renderers ────────────────────────────────────────────

function renderPreventiveAlert(b: PreventiveAlertBindings): RenderedMessage {
  const who = b.product_name?.trim() || b.cve_producto
  const traficoSuffix = b.trafico_id ? ` (referencia ${b.trafico_id})` : ''
  const reasonLine = b.short_reason_es
    ? ` Nota interna: ${b.short_reason_es}.`
    : ''

  return {
    type: 'preventive_alert',
    audience: 'client',
    subject_es: `Preparación preventiva · ${who}`,
    body_es: [
      `Hola,`,
      ``,
      `Estamos preparando documentación adicional para el próximo cruce de ${who}${traficoSuffix}.`,
      `Probabilidad estimada de cruce verde: ${b.probability_pct}%.`,
      `Todo marcha según lo previsto; te avisamos si necesitáramos algo de tu parte.${reasonLine}`,
      ``,
      `Gracias por tu confianza.`,
      `— ${CLIENT_SENDER_ES}`,
    ].join('\n'),
    metadata: {
      cve_producto: b.cve_producto,
      product_name: b.product_name ?? null,
      trafico_id: b.trafico_id ?? null,
      probability_pct: b.probability_pct,
    },
  }
}

function renderDocumentRequest(b: DocumentRequestBindings): RenderedMessage {
  const who = b.product_name?.trim() || b.cve_producto
  const traficoSuffix = b.trafico_id ? ` (referencia ${b.trafico_id})` : ''
  const docsList =
    b.requested_docs_es.length === 0
      ? 'documentación complementaria'
      : b.requested_docs_es.map((d) => `• ${d}`).join('\n')
  const reasonLine = b.reason_es
    ? `\nMotivo: ${b.reason_es}.`
    : ''

  return {
    type: 'document_request',
    audience: 'client',
    subject_es: `Solicitud de documentos · ${who}`,
    body_es: [
      `Hola,`,
      ``,
      `Para asegurar el cruce de ${who}${traficoSuffix}, favor de compartir:`,
      docsList,
      reasonLine ? reasonLine.trim() : '',
      ``,
      `Cuando esté listo, responde a este mensaje con los archivos adjuntos.`,
      `Gracias.`,
      `— ${CLIENT_SENDER_ES}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    metadata: {
      cve_producto: b.cve_producto,
      trafico_id: b.trafico_id ?? null,
      requested_docs: b.requested_docs_es,
    },
  }
}

function renderStatusUpdate(b: StatusUpdateBindings): RenderedMessage {
  const traficoSuffix = b.trafico_id ? ` (referencia ${b.trafico_id})` : ''
  const scheduled = b.fecha_programada
    ? `Próximo evento programado: ${b.fecha_programada}.`
    : ''

  return {
    type: 'status_update',
    audience: 'client',
    subject_es: `Estatus pedimento ${b.pedimento_number}`,
    body_es: [
      `Hola,`,
      ``,
      `Estatus del pedimento ${b.pedimento_number}${traficoSuffix}: ${b.status_es}.`,
      scheduled,
      ``,
      `Quedamos atentos a cualquier duda.`,
      `— ${CLIENT_SENDER_ES}`,
    ]
      .filter((line) => line !== '')
      .join('\n'),
    metadata: {
      pedimento_number: b.pedimento_number,
      status_es: b.status_es,
      trafico_id: b.trafico_id ?? null,
      fecha_programada: b.fecha_programada ?? null,
    },
  }
}

function renderAnomalyEscalation(
  b: AnomalyEscalationBindings,
): RenderedMessage {
  const pct = Math.round(Math.max(0, Math.min(1, b.score)) * 100)
  const action = b.action_es
    ? `Recomendación: ${b.action_es}`
    : 'Recomendación: valida la causa antes de continuar con el flujo normal.'

  return {
    type: 'anomaly_escalation',
    audience: 'internal',
    subject_es: `Anomalía detectada · ${b.anomaly_label_es} · ${b.subject}`,
    body_es: [
      `Heads-up operativo (interno):`,
      ``,
      `Tipo: ${b.anomaly_label_es} (${b.anomaly_kind})`,
      `Sujeto: ${b.subject}`,
      `Score: ${pct}/100`,
      `Detalle: ${b.detail_es}`,
      ``,
      action,
    ].join('\n'),
    metadata: {
      anomaly_kind: b.anomaly_kind,
      subject: b.subject,
      score: b.score,
    },
  }
}

function renderDriverDispatch(b: DriverDispatchBindings): RenderedMessage {
  const docsLabel =
    b.docs_status_es === 'completas'
      ? 'Docs: completas'
      : b.docs_status_es === 'en_revision'
        ? 'Docs: en revisión'
        : 'Docs: pendientes · confirma antes de arrancar'

  return {
    type: 'driver_dispatch',
    audience: 'driver',
    subject_es: `Despacho · ${b.trafico_id}`,
    body_es: [
      `${b.driver_name}:`,
      `Tráfico ${b.trafico_id} listo.`,
      `${b.bridge_label_es} · ${b.lane_label_es}.`,
      `${docsLabel}.`,
      `ETA ${b.eta_hhmm}.`,
      `Confirma recepción.`,
    ].join('\n'),
    metadata: {
      trafico_id: b.trafico_id,
      driver_name: b.driver_name,
      bridge: b.bridge_label_es,
      lane: b.lane_label_es,
      eta_hhmm: b.eta_hhmm,
      docs_status_es: b.docs_status_es,
    },
  }
}

// ── personalizeDraft — public entry to the template layer ────────

/**
 * Render the draft for a given bindings shape. Dispatches on `type`.
 * After rendering, applies the tone guard for client-facing audiences.
 *
 * Throws on unknown type (programmer error, caught in tests).
 */
export function personalizeDraft(bindings: TemplateBindings): RenderedMessage {
  let rendered: RenderedMessage
  switch (bindings.type) {
    case 'preventive_alert':
      rendered = renderPreventiveAlert(bindings)
      break
    case 'document_request':
      rendered = renderDocumentRequest(bindings)
      break
    case 'status_update':
      rendered = renderStatusUpdate(bindings)
      break
    case 'anomaly_escalation':
      rendered = renderAnomalyEscalation(bindings)
      break
    case 'driver_dispatch':
      rendered = renderDriverDispatch(bindings)
      break
    default: {
      // Exhaustive — TS will complain if we miss a type.
      const _exhaustive: never = bindings
      throw new Error(`personalizeDraft: unknown type ${JSON.stringify(_exhaustive)}`)
    }
  }

  const toneIssues = toneGuard(rendered)
  if (toneIssues.length > 0) {
    // Don't throw — the composer decides what to do. We surface the
    // issues as metadata so the caller / reviewer can see them.
    rendered.metadata = {
      ...rendered.metadata,
      tone_issues: toneIssues,
    }
  }
  return rendered
}

// ── toneGuard — belt + suspenders check for client-facing drafts ─

/**
 * Denylist of Spanish/English strings that don't belong on a
 * client-facing draft. The templates above are hand-written to not
 * contain these, but if a future bindings payload slips one in through
 * a free-text field (e.g. `reason_es`, `product_name`) the tone guard
 * catches it.
 *
 * Internal + driver audiences are free to use the full palette — the
 * check only runs on `audience === 'client'`.
 */
const CLIENT_TONE_DENYLIST: ReadonlyArray<string> = [
  'urgente',
  'urgent',
  'vencido',
  'overdue',
  'past due',
  'critical',
  'crítico',
  'riesgo alto',
  'red alert',
  '!!',
  '⚠️',
  '🚨',
]

/** Run the tone check. Returns an array of issues (empty = clean). */
export function toneGuard(msg: RenderedMessage): string[] {
  if (msg.audience !== 'client') return []
  const issues: string[] = []
  const haystack = `${msg.subject_es}\n${msg.body_es}`.toLowerCase()
  for (const banned of CLIENT_TONE_DENYLIST) {
    if (haystack.includes(banned.toLowerCase())) {
      issues.push(`tone_denylist_hit:${banned}`)
    }
  }
  // Reject two+ consecutive ALL-CAPS words of 4+ letters — SHOUTING.
  // A single ALL-CAPS word slips (SKU codes like "SKU-DIRECT" are fine);
  // the pattern catches real shouting like "ATENCIÓN INMEDIATA" or
  // "URGENTE REVIEW" which should never land on a client.
  if (
    /\b[A-ZÁÉÍÓÚÑ]{4,}(?:[\s\-][A-ZÁÉÍÓÚÑ]{4,})+\b/.test(
      `${msg.subject_es} ${msg.body_es}`,
    )
  ) {
    issues.push('tone_allcaps_detected')
  }
  return issues
}

// ── Labels used by the composer ──────────────────────────────────

export const MESSAGE_TYPE_LABEL_ES: Record<MessageType, string> = {
  preventive_alert: 'Heads-up preventivo',
  document_request: 'Solicitud de documentos',
  status_update: 'Actualización de estatus',
  anomaly_escalation: 'Escalación de anomalía',
  driver_dispatch: 'Despacho de conductor',
}

export const AUDIENCE_LABEL_ES: Record<Audience, string> = {
  client: 'Cliente',
  internal: 'Interno',
  driver: 'Conductor',
}
