/**
 * briefing.ts — pure Spanish formatter for the morning intelligence briefing.
 *
 * Why this exists:
 *   The Phase 3 #2 cron script (`scripts/morning-briefing.js`) needs to
 *   produce a consistent, tested Spanish Telegram message from the Phase
 *   3 #1 tool responses. Keeping the formatter here (instead of inline
 *   in the JS cron) lets us:
 *     - Unit-test the output shape with fixtures
 *     - Re-use the same formatter for future surfaces (email, /admin
 *       preview card, Mensajería internal digest)
 *     - Keep the cron script as a pure I/O orchestrator
 *
 * Contract:
 *   - Pure. Zero I/O. Input = two tool responses, output = structured
 *     briefing with both HTML (for Telegram parse_mode=HTML) and plain-
 *     text renderings plus a decision-log entry ready for insert.
 *   - Spanish-first. Copy is calm, professional, actionable — not alarmist.
 *   - Internal-only by design. No client-facing copy. No client names
 *     leaked to external surfaces.
 *   - Top-3 caps everywhere the message fits in one Telegram message
 *     (4096 char limit).
 */

import type {
  AnomalyOnlyResponseEs,
  TenantScanResponseEs,
  AgentToolResponse,
} from './tools'

export interface MorningBriefingInput {
  companyId: string
  /** Response from `getFullIntelligence(..., 'tenant_scan')`. */
  intelligence: AgentToolResponse<TenantScanResponseEs | AnomalyOnlyResponseEs>
  /** Response from `getTenantAnomalies(...)`. */
  anomalies: AgentToolResponse<AnomalyOnlyResponseEs>
  /** ISO timestamp for the briefing (overridable for tests). */
  generatedAt?: string
}

export interface MorningBriefingOutput {
  /** Telegram-safe HTML body (< 4096 chars). parse_mode='HTML'. */
  text_html: string
  /** Plain-text equivalent for email / logs. */
  text_plain: string
  /** One-line headline suitable for a push notification subject. */
  headline_es: string
  /** Structured payload ready to insert into agent_decisions. */
  decision_log_entry: DecisionLogEntry
  /** Non-zero when the briefing could not render a normal scan — we
   *  still send something calm + the operator can investigate. */
  degraded: boolean
}

export interface DecisionLogEntry {
  workflow: 'morning_briefing'
  trigger_type: 'cron'
  trigger_id: string
  company_id: string
  decision: string
  reasoning: string
  /** 1.0 — formatter is deterministic from inputs. */
  confidence: number
  /** 0 — autonomy level 0 means propose-only. */
  autonomy_level: number
  /** action_taken is set by the cron after I/O completes. */
  action_taken: string | null
}

const MAX_TOP_N = 3

/**
 * Compose the morning briefing.
 *
 * Scenarios handled:
 *   - Both responses successful with data → normal rich briefing.
 *   - Intelligence failed but anomalies OK → degraded (anomalies only).
 *   - Both failed or both empty → calm "revisión sin datos" briefing.
 */
export function composeMorningBriefing(
  input: MorningBriefingInput,
): MorningBriefingOutput {
  const { companyId } = input
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  const intelOk =
    input.intelligence.success && input.intelligence.data != null
  const anomaliesOk =
    input.anomalies.success && input.anomalies.data != null
  const degraded = !intelOk && !anomaliesOk

  const lines: HtmlPlain[] = []

  // ── Header ───────────────────────────────────────────────────────
  const dateLabel = formatDateEs(generatedAt)
  lines.push({
    html: `<b>☀️ Briefing matutino · ${escapeHtml(dateLabel)}</b>`,
    plain: `☀️ Briefing matutino · ${dateLabel}`,
  })
  lines.push({
    html: `<i>Cliente: ${escapeHtml(companyId)} · modo interno</i>`,
    plain: `Cliente: ${companyId} · modo interno`,
  })
  lines.push(BLANK)

  // ── Headline ─────────────────────────────────────────────────────
  const headline = pickHeadline(input, companyId, degraded)
  lines.push({
    html: `<b>📊 Panorama</b>`,
    plain: `📊 Panorama`,
  })
  lines.push({
    html: escapeHtml(headline),
    plain: headline,
  })
  lines.push(BLANK)

  // ── Anomalies ───────────────────────────────────────────────────
  const anomalyLines = buildAnomalyLines(input)
  if (anomalyLines.length > 0) {
    lines.push({ html: `<b>⚠️ Anomalías (top ${MAX_TOP_N})</b>`, plain: `⚠️ Anomalías (top ${MAX_TOP_N})` })
    for (const l of anomalyLines) lines.push(l)
    lines.push(BLANK)
  } else if (!degraded) {
    lines.push({
      html: `<b>⚠️ Anomalías</b>`,
      plain: `⚠️ Anomalías`,
    })
    lines.push({
      html: `<i>Sin anomalías detectadas en la ventana.</i>`,
      plain: `Sin anomalías detectadas en la ventana.`,
    })
    lines.push(BLANK)
  }

  // ── Recommendations ─────────────────────────────────────────────
  const recLines = buildRecommendationLines(input)
  if (recLines.length > 0) {
    lines.push({ html: `<b>✅ Recomendaciones (top ${MAX_TOP_N})</b>`, plain: `✅ Recomendaciones (top ${MAX_TOP_N})` })
    for (const l of recLines) lines.push(l)
    lines.push(BLANK)
  }

  // ── Focus areas (tenant_scan only) ──────────────────────────────
  const focusLines = buildFocusLines(input)
  if (focusLines.length > 0) {
    lines.push({ html: `<b>🎯 SKUs a revisar</b>`, plain: `🎯 SKUs a revisar` })
    for (const l of focusLines) lines.push(l)
    lines.push(BLANK)
  }

  // ── Footer ──────────────────────────────────────────────────────
  lines.push({
    html: `<i>Reporte automático · solo interno · no enviar a clientes.</i>`,
    plain: `Reporte automático · solo interno · no enviar a clientes.`,
  })

  // Join + truncate to Telegram limits (4096 chars).
  const text_html = truncate(lines.map((l) => l.html).join('\n'), 4000)
  const text_plain = truncate(lines.map((l) => l.plain).join('\n'), 4000)

  const decision_log_entry: DecisionLogEntry = {
    workflow: 'morning_briefing',
    trigger_type: 'cron',
    trigger_id: `morning_briefing:${generatedAt.slice(0, 10)}`,
    company_id: companyId,
    decision: headline,
    reasoning: text_plain,
    confidence: 1.0,
    autonomy_level: 0,
    action_taken: null,
  }

  return {
    text_html,
    text_plain,
    headline_es: headline,
    decision_log_entry,
    degraded,
  }
}

// ── Builders ──────────────────────────────────────────────────────

interface HtmlPlain {
  html: string
  plain: string
}

const BLANK: HtmlPlain = { html: '', plain: '' }

function pickHeadline(
  input: MorningBriefingInput,
  companyId: string,
  degraded: boolean,
): string {
  if (input.intelligence.success && input.intelligence.data) {
    return input.intelligence.data.headline_es
  }
  if (input.anomalies.success && input.anomalies.data) {
    return input.anomalies.data.headline_es
  }
  if (degraded) {
    return `${companyId}: no se pudo generar el panorama — revisa el pipeline.`
  }
  return `${companyId}: operación en calma.`
}

function buildAnomalyLines(input: MorningBriefingInput): HtmlPlain[] {
  const out: HtmlPlain[] = []
  const groups =
    input.anomalies.data?.anomaly_groups_es ??
    (input.intelligence.data?.type === 'tenant_scan'
      ? input.intelligence.data.anomaly_groups_es.map((g) => ({
          label_es: g.label_es,
          count: g.count,
          top_subjects: [] as string[],
        }))
      : input.intelligence.data?.type === 'anomaly_only'
        ? input.intelligence.data.anomaly_groups_es
        : [])

  for (const g of (groups ?? []).slice(0, MAX_TOP_N)) {
    const subjects =
      g.top_subjects && g.top_subjects.length > 0
        ? ` — ${g.top_subjects.slice(0, 3).join(', ')}`
        : ''
    const plural = g.count === 1 ? '' : 's'
    const label = `• ${g.label_es} · ${g.count} caso${plural}${subjects}`
    out.push({ html: escapeHtml(label), plain: label })
  }
  return out
}

function buildRecommendationLines(input: MorningBriefingInput): HtmlPlain[] {
  const out: HtmlPlain[] = []
  const recs =
    (input.intelligence.data?.recommendations ??
      input.anomalies.data?.recommendations ??
      []) as Array<{
      priority_es: 'alta' | 'media' | 'baja'
      action_es: string
      rationale_es: string
    }>

  const sorted = [...recs].sort(byPriority)
  for (const r of sorted.slice(0, MAX_TOP_N)) {
    const marker = r.priority_es === 'alta' ? '🚨' : r.priority_es === 'media' ? '📝' : '📎'
    const line = `${marker} [${r.priority_es}] ${r.action_es}`
    out.push({ html: escapeHtml(line), plain: line })
  }
  return out
}

function buildFocusLines(input: MorningBriefingInput): HtmlPlain[] {
  if (input.intelligence.data?.type !== 'tenant_scan') return []
  const out: HtmlPlain[] = []
  for (const f of input.intelligence.data.top_focus_es.slice(0, MAX_TOP_N)) {
    const line = `• ${f.cve_producto} · ${f.probability_pct}% verde · confianza ${f.band_es}`
    out.push({ html: escapeHtml(line), plain: line })
  }
  return out
}

function byPriority(
  a: { priority_es: 'alta' | 'media' | 'baja' },
  b: { priority_es: 'alta' | 'media' | 'baja' },
): number {
  const w: Record<'alta' | 'media' | 'baja', number> = { alta: 3, media: 2, baja: 1 }
  return w[b.priority_es] - w[a.priority_es]
}

// ── Pure helpers ──────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Truncate at a safe boundary (try last newline first, fall back to hard cut). */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  const slice = text.slice(0, limit)
  const lastNl = slice.lastIndexOf('\n')
  const cut = lastNl > limit - 500 ? lastNl : limit
  return `${text.slice(0, cut)}\n…`
}

/** Format an ISO date as "Mié 22 abr 2026" for the briefing header. */
function formatDateEs(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
    const fmt = new Intl.DateTimeFormat('es-MX', {
      weekday: 'short',
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
