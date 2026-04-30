/**
 * Proactive follow-up suggestions for CRUZ AI.
 *
 * After a successful ask + synthesis pass, we derive 1-3 suggested
 * next questions based on what tools fired and the classifier topic.
 * The UI renders them as clickable pills — one Enter away from the
 * natural follow-up.
 *
 * Deterministic, template-based — no Anthropic call. Cheaper than a
 * second LLM pass and keeps the suggestions grounded in the broker
 * workflow. Ordered by operator value (most common first).
 */

import type { ToolName } from './tools'

const MAX_SUGGESTIONS = 3

export interface DeriveInput {
  toolsCalled: ReadonlyArray<ToolName>
  topicClass: string | null
  hasFallback: boolean
}

/**
 * Maps each tool to the follow-up most likely to compound on what it
 * just returned. Iteration order is the priority order — first match
 * per call sequence wins.
 */
const TOOL_SUGGESTIONS: ReadonlyArray<{ tool: ToolName; suggestion_es: string }> = [
  { tool: 'analyze_trafico', suggestion_es: '¿Revisamos los documentos faltantes?' },
  { tool: 'analyze_pedimento', suggestion_es: '¿Comparamos con el último pedimento?' },
  { tool: 'validate_pedimento', suggestion_es: '¿Revisamos la cadena factura → entrada?' },
  { tool: 'check_tmec_eligibility', suggestion_es: '¿Calculamos el ahorro acumulado YTD?' },
  { tool: 'suggest_clasificacion', suggestion_es: '¿Generamos una OCA para confirmar la fracción?' },
  { tool: 'search_supplier_history', suggestion_es: '¿Ves el último cruce de este proveedor?' },
  { tool: 'find_missing_documents', suggestion_es: '¿Preparamos un borrador para solicitarlos?' },
  { tool: 'tenant_anomalies', suggestion_es: '¿Escalamos a una alerta interna?' },
  { tool: 'intelligence_scan', suggestion_es: '¿Profundizamos en el SKU de mayor riesgo?' },
  { tool: 'query_financiero', suggestion_es: '¿Revisamos la CxC por cliente?' },
  { tool: 'query_expedientes', suggestion_es: '¿Identificamos los expedientes en riesgo?' },
  { tool: 'query_traficos', suggestion_es: '¿Te muestro los próximos cruces?' },
  { tool: 'query_pedimentos', suggestion_es: '¿Te muestro el detalle del último pedimento?' },
  { tool: 'query_catalogo', suggestion_es: '¿Revisamos las fracciones T-MEC candidatas?' },
  { tool: 'draft_mensajeria', suggestion_es: '¿Agregamos esta solicitud al borrador?' },
  { tool: 'learning_report', suggestion_es: '¿Aplicamos las sugerencias más altas?' },
]

/** Topic-class fallbacks when no tool suggestion fires. */
const TOPIC_FALLBACK_ES: Record<string, string> = {
  estatus_trafico: '¿Te muestro los próximos cruces?',
  pregunta_pedimento: '¿Te muestro el resumen del mes?',
  duda_documento: '¿Revisamos los documentos pendientes?',
  pregunta_financiera: '¿Revisamos la CxC del mes?',
  escalacion: '¿Preparamos el borrador de la alerta?',
  otro: '¿Te muestro el panorama de la operación?',
}

/** Default catch-all — exported so callers can detect "no better fallback". */
export const DEFAULT_SUGGESTION_ES = '¿Te muestro el panorama de la operación?'

/**
 * Derive up to 3 proactive follow-up suggestions.
 *
 * Empty array on fallback (no real answer → don't prompt the user to
 * keep asking a broken system). Empty array on pure saludo (no tools
 * called, no topic signal) — returning "¿Te muestro el panorama?" for
 * "hola" feels robotic.
 */
export function deriveSuggestions(input: DeriveInput): string[] {
  if (input.hasFallback) return []
  if (input.toolsCalled.length === 0 && input.topicClass === 'saludo') return []

  const calledSet = new Set<ToolName>(input.toolsCalled)
  const out: string[] = []
  const seen = new Set<string>()

  for (const entry of TOOL_SUGGESTIONS) {
    if (out.length >= MAX_SUGGESTIONS) break
    if (!calledSet.has(entry.tool)) continue
    if (seen.has(entry.suggestion_es)) continue
    out.push(entry.suggestion_es)
    seen.add(entry.suggestion_es)
  }

  if (out.length === 0) {
    const topic = input.topicClass ?? ''
    const fallback = TOPIC_FALLBACK_ES[topic] ?? DEFAULT_SUGGESTION_ES
    out.push(fallback)
  }

  return out.slice(0, MAX_SUGGESTIONS)
}

export const SUGGESTION_CONSTANTS = {
  MAX_SUGGESTIONS,
} as const
