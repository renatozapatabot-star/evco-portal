/**
 * Intent pre-router for CRUZ AI.
 *
 * The `/api/cruz-ai/ask` route classifies every question into a topic
 * (`classifyTopic`) and then hands Haiku the full TOOL_DEFINITIONS
 * schema — 17 tools, ~2.5K input tokens per round, × 4 rounds.
 *
 * `pickToolCandidates` narrows that list to 3–5 tools based on:
 *   1. Topic affinity — pre-mapped bundles per classifier label.
 *   2. Keyword signals — Spanish/English phrases that imply a specific
 *      tool (e.g. "fracción", "T-MEC", "RFC", pedimento format).
 *   3. Role gates — `query_financiero` is silently dropped for roles
 *      without finance access so Haiku never even sees the option.
 *
 * Savings: ~70% fewer tool-schema tokens per round (typical); the router
 * itself is ~15 lines of scoring so cost is negligible.
 *
 * No Anthropic call inside — this is pure string matching. Safe to call
 * on every turn without token cost.
 */

import type { PortalRole } from '@/lib/session'
import { canSeeFinance } from './roles'
import type { ToolName } from './tools'

/**
 * Topic labels produced by `classifyTopic` in the ask route. Anything
 * else (including a classifier hallucination) is treated as `null` →
 * the baseline list is used for padding.
 */
export type TopicClass =
  | 'estatus_trafico'
  | 'pregunta_pedimento'
  | 'duda_documento'
  | 'pregunta_financiera'
  | 'escalacion'
  | 'saludo'
  | 'otro'

const KNOWN_TOPICS: ReadonlySet<TopicClass> = new Set([
  'estatus_trafico',
  'pregunta_pedimento',
  'duda_documento',
  'pregunta_financiera',
  'escalacion',
  'saludo',
  'otro',
])

/** Topic → preferred tools. Scored +3 each. */
const TOPIC_AFFINITY: Record<TopicClass, ToolName[]> = {
  estatus_trafico: ['query_traficos', 'analyze_trafico', 'find_missing_documents'],
  pregunta_pedimento: ['query_pedimentos', 'analyze_pedimento', 'validate_pedimento'],
  duda_documento: ['query_expedientes', 'find_missing_documents'],
  pregunta_financiera: ['query_financiero', 'draft_mensajeria_to_anabel'],
  escalacion: ['flag_shipment', 'open_oca_request', 'draft_mensajeria'],
  saludo: [],
  otro: ['intelligence_scan', 'query_traficos'],
}

/**
 * Keyword rules. Each matching pattern bumps the listed tools by +3.
 * Patterns intentionally forgiving (accents optional, common
 * misspellings tolerated) — better to over-match than to miss a signal.
 */
const KEYWORD_RULES: ReadonlyArray<{ pattern: RegExp; tools: ToolName[]; keyword: string }> = [
  { pattern: /\bfracc?i[oó]n|clasif|arancel|partida\b/i, tools: ['suggest_clasificacion', 'query_catalogo'], keyword: 'clasificación' },
  { pattern: /\bt[-\s]?mec\b|usmca|tratado|certificado.*origen/i, tools: ['check_tmec_eligibility'], keyword: 't-mec' },
  { pattern: /\b(proveedor|supplier|rfc)\b/i, tools: ['search_supplier_history'], keyword: 'proveedor' },
  { pattern: /\b(documento|expediente|falt(a|an|ante)|cove|packing|bl\/awb|factura\s+comercial)\b/i, tools: ['find_missing_documents', 'query_expedientes'], keyword: 'documentos' },
  { pattern: /\b(borrador|draft|redact|prepara\s+mensaje|aviso|alerta\s+al\s+cliente)\b/i, tools: ['draft_mensajeria'], keyword: 'borrador' },
  { pattern: /\b(anomal[ií]a|alert|problema|raro|extra[nñ]o)\b/i, tools: ['tenant_anomalies'], keyword: 'anomalía' },
  { pattern: /\b(valid|verific|revisa\s+cifras|iva|base\s+iva|dta)\b/i, tools: ['validate_pedimento'], keyword: 'validación' },
  { pattern: /\b\d{2}\s\d{2}\s\d{4}\s\d{7}\b/, tools: ['analyze_pedimento', 'validate_pedimento'], keyword: 'pedimento_number' },
  { pattern: /\bY-?\d{3,6}\b/, tools: ['analyze_trafico'], keyword: 'trafico_id' },
  { pattern: /\b(marc(a|ar|alo)|flagu?ea|bandera|alerta\s+interna|escala(r)?\s+a\s+tito|revisi[oó]n\s+pendiente)\b/i, tools: ['flag_shipment'], keyword: 'marcar_embarque' },
  { pattern: /\b(anabel|preg[uú]nta(le)?\s+a\s+(contabilidad|anabel)|avis(a|ale)\s+a\s+(contabilidad|anabel)|dudas?\s+(sobre|de)\s+(saldo|factura|pago|mi\s+cuenta))\b/i, tools: ['draft_mensajeria_to_anabel'], keyword: 'anabel' },
  { pattern: /\b(abre(r)?\s+(una\s+)?oca|solicita(r)?\s+oca|necesit[oa]\s+oca|opini[oó]n\s+(de|oficial)\s+clasif|duda\s+(sobre|de)\s+fracci[oó]n)\b/i, tools: ['open_oca_request'], keyword: 'oca' },
  { pattern: /\b(panorama|c[oó]mo\s+(est[aá]|va)\s+(la\s+)?operaci[oó]n|resumen\s+general)\b/i, tools: ['intelligence_scan'], keyword: 'panorama' },
  { pattern: /\b(desempe[nñ]o|aprendizaje|reporte\s+semanal|m[eé]tricas)\b/i, tools: ['learning_report'], keyword: 'desempeño' },
  { pattern: /\b(factura(ci[oó]n)?|cxc|saldo|pago|cobro)\b/i, tools: ['query_financiero'], keyword: 'financiero' },
  { pattern: /@[a-zA-Z0-9_.-]+/, tools: ['route_mention'], keyword: '@mention' },
]

/** Fallback bundle when topic+keywords produce too few candidates. */
const DEFAULT_BASELINE: ReadonlyArray<ToolName> = [
  'query_traficos',
  'query_pedimentos',
  'intelligence_scan',
]

const MIN_TOOLS = 3
const MAX_TOOLS = 5

export interface RouterOutput {
  tools: ToolName[]
  topic: TopicClass | null
  matched_keywords: string[]
  reason_es: string
}

function normalizeTopic(raw: string | null | undefined): TopicClass | null {
  if (!raw) return null
  const t = raw.trim().toLowerCase() as TopicClass
  return KNOWN_TOPICS.has(t) ? t : null
}

/**
 * Select 3–5 candidate tools for the tool-loop. Returns `[]` only for
 * `saludo` (pure small-talk); every other path pads to MIN_TOOLS so
 * follow-up questions can still pick up something.
 */
export function pickToolCandidates(
  question: string,
  role: PortalRole,
  topicInput: string | null,
): RouterOutput {
  const topic = normalizeTopic(topicInput)
  const q = (question ?? '').trim()

  if (topic === 'saludo') {
    return {
      tools: [],
      topic,
      matched_keywords: [],
      reason_es: 'Saludo — sin herramientas necesarias.',
    }
  }

  const scores = new Map<ToolName, number>()
  const matched: string[] = []
  const bump = (tool: ToolName, delta: number) => {
    scores.set(tool, (scores.get(tool) ?? 0) + delta)
  }

  if (topic) {
    for (const tool of TOPIC_AFFINITY[topic]) bump(tool, 3)
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(q)) {
      matched.push(rule.keyword)
      for (const tool of rule.tools) bump(tool, 3)
    }
  }

  if (!canSeeFinance(role)) scores.delete('query_financiero')

  let picked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tool]) => tool)

  if (picked.length < MIN_TOOLS) {
    for (const tool of DEFAULT_BASELINE) {
      if (picked.length >= MIN_TOOLS) break
      if (tool === 'query_financiero' && !canSeeFinance(role)) continue
      if (!picked.includes(tool)) picked.push(tool)
    }
  }

  picked = picked.slice(0, MAX_TOOLS)

  const reason_es = matched.length > 0
    ? `Topic ${topic ?? 'desconocido'} + señales: ${matched.join(', ')}.`
    : `Topic ${topic ?? 'desconocido'} — sin señales de keyword; usando baseline.`

  return { tools: picked, topic, matched_keywords: matched, reason_es }
}

/**
 * Subset the full TOOL_DEFINITIONS array by a list of tool names.
 * Preserves original order — Haiku picks the first-listed matching tool
 * when tied on description, so schema ordering is a soft bias.
 */
export function filterToolsByName<T extends { name: string }>(
  definitions: readonly T[],
  names: ReadonlyArray<ToolName>,
): T[] {
  const set = new Set<string>(names)
  return definitions.filter(d => set.has(d.name))
}

/** Constants exposed for tests + future cost-audit scripts. */
export const ROUTER_CONSTANTS = {
  MIN_TOOLS,
  MAX_TOOLS,
  DEFAULT_BASELINE,
  TOPIC_AFFINITY,
} as const
