/**
 * PORTAL · OCA — generate a draft classification opinion via Opus.
 *
 * Server-only. Opus is reserved for complex regulatory reasoning per
 * CLAUDE.md model routing. Never call this from the browser.
 *
 * Two generators:
 *   - generateOcaOpinion         (legacy · minimal JSON shape · unchanged)
 *   - generateOcaClassifierDraft (Classifier · full I/II/III/IV template
 *     + NICO + T-MEC discrepancy flags + GRI citations)
 *
 * Plus a batch helper generateOcaBatch() that runs the Classifier on an
 * array of unknowns with a concurrency cap of 2 (cost + rate-limit
 * protection).
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OcaGenerateInput,
  OcaOpinionDraft,
  OcaClassifierDraft,
  OcaClassifierInput,
  OcaTmecDiscrepancy,
} from './types'

const OCA_MODEL = 'claude-opus-4-6'

const SYSTEM_PROMPT = `Eres un clasificador aduanal mexicano que trabaja bajo la
Patente 3596. Generas opiniones formales de clasificación arancelaria siguiendo
LIGIE, TIGIE, GRI 1-6 y las Reglas Generales de Comercio Exterior. Responde
EXCLUSIVAMENTE con JSON válido del siguiente shape:

{
  "fraccion_recomendada": "XXXX.XX.XX",
  "fundamento_legal": "texto citando LIGIE capítulo, partida y regla general aplicada",
  "nom_aplicable": "NOM-XXX-YYYY-ZZZZ o null si no aplica",
  "tmec_elegibilidad": true | false,
  "vigencia_hasta": "YYYY-MM-DD (un año a partir de hoy)",
  "razonamiento": "párrafo explicando la decisión técnica"
}

Sin texto fuera del JSON. Sin markdown. Sin backticks.`

function buildUserPrompt(input: OcaGenerateInput): string {
  const today = new Date().toISOString().slice(0, 10)
  return [
    `Fecha: ${today}`,
    `Producto: ${input.product_description}`,
    `País de origen: ${input.pais_origen}`,
    input.uso_final ? `Uso final: ${input.uso_final}` : '',
    input.fraccion_sugerida ? `Fracción sugerida por el cliente: ${input.fraccion_sugerida} (validar o corregir)` : '',
    '',
    'Genera la opinión de clasificación en el JSON especificado.',
  ].filter(Boolean).join('\n')
}

export interface OcaGenerateResult {
  draft: OcaOpinionDraft
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// Opus 4 pricing per CLAUDE.md routing: complex/rare. Numbers match Anthropic
// public pricing at time of writing; if pricing changes update here.
const OPUS_INPUT_PER_1K = 15 / 1000
const OPUS_OUTPUT_PER_1K = 75 / 1000

export async function generateOcaOpinion(
  input: OcaGenerateInput,
  opts: { apiKey?: string } = {},
): Promise<OcaGenerateResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — cannot generate OCA opinion')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: OCA_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  let parsed: OcaOpinionDraft
  try {
    parsed = JSON.parse(text) as OcaOpinionDraft
  } catch {
    throw new Error(`Opus devolvió JSON inválido para OCA: ${text.slice(0, 200)}`)
  }

  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(parsed.fraccion_recomendada)) {
    throw new Error(`Fracción inválida en respuesta OCA: ${parsed.fraccion_recomendada}`)
  }

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const costUsd = (inputTokens * OPUS_INPUT_PER_1K + outputTokens * OPUS_OUTPUT_PER_1K) / 1000

  return {
    draft: parsed,
    model: OCA_MODEL,
    inputTokens,
    outputTokens,
    costUsd,
  }
}

// ── Classifier path — full OCA template ───────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `Eres un clasificador aduanal mexicano que trabaja bajo la
Patente 3596 (Renato Zapata & Company, Laredo, TX · Aduana 240). Generas
opiniones formales de clasificación arancelaria siguiendo LIGIE, TIGIE,
GRI 1-6, las Reglas Generales de Comercio Exterior (RGCE) y las Notas
Explicativas del SA.

Responde EXCLUSIVAMENTE con JSON válido del siguiente shape — sin prosa,
sin markdown, sin backticks:

{
  "fraccion_recomendada": "XXXX.XX.XX",
  "nico": "NN",
  "clasificacion_descripcion_tigie": "descripción oficial TIGIE de la fracción",
  "arancel_general": "NN% o exento",
  "tmec_elegibilidad": true | false,
  "nom_aplicable": "NOM-XXX-SCFI-YYYY o null si no aplica",
  "vigencia_hasta": "YYYY-MM-DD (un año a partir de hoy)",
  "antecedentes": "párrafo describiendo el producto, documentación revisada, y contexto comercial",
  "analisis": "párrafo aplicando GRI 1-6 paso a paso: material, función, partida candidata, elección de subpartida, determinación NICO",
  "fundamento_legal": "citas específicas: LIGIE capítulo/partida, RGCE regla aplicada, Notas Explicativas relevantes, NOM si aplica",
  "razonamiento": "resumen ejecutivo de una a dos frases para la plana de primera página",
  "gri_applied": ["1","3a","6"],
  "tmec_discrepancies": []
}

Reglas estrictas:
- fraccion_recomendada DEBE cumplir el regex /^\\d{4}\\.\\d{2}\\.\\d{2}$/ (dots preserved).
- nico DEBE cumplir /^\\d{2}$/ (exactamente dos dígitos, zero-padded).
- gri_applied es un array con los incisos de GRI que aplicaste (ej ["1"], ["1","6"], ["3a","6"]).
- tmec_discrepancies se llena solo si el usuario proporcionó un certificate_fraccion_hint y tu clasificación recomendada la contradice. Formato:
  [{ "certificate_line": N, "certificate_shows": "XXXX.XX", "correct_fraccion": "XXXX.XX", "message_es": "explicación breve" }]
- antecedentes, analisis, fundamento_legal, razonamiento deben ser texto plano en español, sin saltos de línea raros.
- No inventes NOMs — si no identificas una NOM aplicable, null.
- Preserva puntos en fracciones siempre (invariante 8).`

function buildClassifierUserPrompt(input: OcaClassifierInput): string {
  const today = new Date().toISOString().slice(0, 10)
  const origen = input.pais_origen_iso
    ? `${input.pais_origen} (${input.pais_origen_iso})`
    : input.pais_origen
  return [
    `Fecha: ${today}`,
    input.item_no ? `Número de parte: ${input.item_no}` : '',
    input.invoice_ref ? `Factura: ${input.invoice_ref}` : '',
    `Producto: ${input.product_description}`,
    `País de origen: ${origen}`,
    input.uso_final ? `Uso final: ${input.uso_final}` : '',
    input.uom ? `Unidad de medida: ${input.uom}` : '',
    typeof input.extended_price_usd === 'number'
      ? `Valor extendido en factura: USD ${input.extended_price_usd.toFixed(2)}`
      : '',
    input.fraccion_sugerida
      ? `Fracción sugerida por el cliente: ${input.fraccion_sugerida} (validar o corregir)`
      : '',
    input.certificate_fraccion_hint
      ? `Certificado T-MEC / factura muestra la sub-partida: ${input.certificate_fraccion_hint} (si tu clasificación correcta difiere, llena tmec_discrepancies)`
      : '',
    '',
    'Genera la opinión de clasificación formal en el JSON especificado.',
  ].filter(Boolean).join('\n')
}

export interface OcaClassifierResult {
  draft: OcaClassifierDraft
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

function coerceDiscrepancies(raw: unknown): OcaTmecDiscrepancy[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): OcaTmecDiscrepancy | null => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const line = typeof r.certificate_line === 'number' ? r.certificate_line : null
      const shows = typeof r.certificate_shows === 'string' ? r.certificate_shows : null
      const correct = typeof r.correct_fraccion === 'string' ? r.correct_fraccion : null
      const message = typeof r.message_es === 'string' ? r.message_es : null
      if (line === null || !shows || !correct || !message) return null
      return { certificate_line: line, certificate_shows: shows, correct_fraccion: correct, message_es: message }
    })
    .filter((d): d is OcaTmecDiscrepancy => d !== null)
}

function parseClassifierResponse(text: string): OcaClassifierDraft {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Opus devolvió JSON inválido para OCA: ${text.slice(0, 200)}`)
  }

  const fraccion = String(parsed.fraccion_recomendada ?? '')
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(fraccion)) {
    throw new Error(`Fracción inválida en respuesta OCA: ${fraccion}`)
  }
  const nico = String(parsed.nico ?? '')
  if (!/^\d{2}$/.test(nico)) {
    throw new Error(`NICO inválido en respuesta OCA: ${nico}`)
  }

  const griApplied = Array.isArray(parsed.gri_applied)
    ? (parsed.gri_applied as unknown[]).filter((v): v is string => typeof v === 'string')
    : []

  return {
    fraccion_recomendada: fraccion,
    nico,
    clasificacion_descripcion_tigie: String(parsed.clasificacion_descripcion_tigie ?? ''),
    arancel_general: String(parsed.arancel_general ?? ''),
    tmec_elegibilidad: Boolean(parsed.tmec_elegibilidad),
    nom_aplicable: typeof parsed.nom_aplicable === 'string' && parsed.nom_aplicable.length > 0
      ? parsed.nom_aplicable
      : null,
    vigencia_hasta: String(parsed.vigencia_hasta ?? ''),
    antecedentes: String(parsed.antecedentes ?? ''),
    analisis: String(parsed.analisis ?? ''),
    fundamento_legal: String(parsed.fundamento_legal ?? ''),
    razonamiento: String(parsed.razonamiento ?? ''),
    gri_applied: griApplied,
    tmec_discrepancies: coerceDiscrepancies(parsed.tmec_discrepancies),
  }
}

/** Expose parser for unit tests — no network required. */
export function parseOcaClassifierText(text: string): OcaClassifierDraft {
  return parseClassifierResponse(text)
}

/**
 * Generate a single Classifier-grade OCA draft via Opus.
 * Server-only. Throws on missing API key, malformed JSON, or invalid
 * fracción/NICO. Rate-limit + cost-log envelope owned by caller.
 */
export async function generateOcaClassifierDraft(
  input: OcaClassifierInput,
  opts: { apiKey?: string } = {},
): Promise<OcaClassifierResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — cannot generate OCA opinion')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: OCA_MODEL,
    max_tokens: 2500,
    temperature: 0,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildClassifierUserPrompt(input) }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  const draft = parseClassifierResponse(text)
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const costUsd = (inputTokens * OPUS_INPUT_PER_1K + outputTokens * OPUS_OUTPUT_PER_1K) / 1000

  return { draft, model: OCA_MODEL, inputTokens, outputTokens, costUsd }
}

export interface OcaBatchItemResult {
  item_no: string | null
  draft: OcaClassifierDraft | null
  error: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface OcaBatchResult {
  items: OcaBatchItemResult[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  model: string
}

/**
 * Batch-generate Classifier OCA drafts with a concurrency cap of 2.
 *
 * Opus costs $15/M input + $75/M output — running 4 unknowns in parallel
 * without a cap risks a rate-limit burst. Cap = 2 spreads the load while
 * keeping perceived latency under 20s for a typical 4-part invoice.
 *
 * Each item is independently processed: a bad fracción from Opus fails
 * ONE draft; the rest continue. Caller sees per-item error strings and
 * a roll-up total for the cost badge on Tito's surface.
 */
export async function generateOcaBatch(
  inputs: OcaClassifierInput[],
  opts: { apiKey?: string; concurrency?: number } = {},
): Promise<OcaBatchResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — cannot generate OCA batch')
  const cap = Math.max(1, Math.min(opts.concurrency ?? 2, 4))

  const results: OcaBatchItemResult[] = new Array(inputs.length).fill(null).map(() => ({
    item_no: null, draft: null, error: null,
    inputTokens: 0, outputTokens: 0, costUsd: 0,
  }))

  // Simple worker pool: spin up `cap` workers that pull from a shared index.
  let cursor = 0
  const workers = Array.from({ length: cap }, async () => {
    while (cursor < inputs.length) {
      const idx = cursor++
      if (idx >= inputs.length) break
      const input = inputs[idx]
      results[idx].item_no = input.item_no ?? null
      try {
        const out = await generateOcaClassifierDraft(input, { apiKey })
        results[idx] = {
          item_no: input.item_no ?? null,
          draft: out.draft,
          error: null,
          inputTokens: out.inputTokens,
          outputTokens: out.outputTokens,
          costUsd: out.costUsd,
        }
      } catch (err) {
        results[idx].error = err instanceof Error ? err.message : String(err)
      }
    }
  })
  await Promise.all(workers)

  const totalInputTokens = results.reduce((acc, r) => acc + r.inputTokens, 0)
  const totalOutputTokens = results.reduce((acc, r) => acc + r.outputTokens, 0)
  const totalCostUsd = results.reduce((acc, r) => acc + r.costUsd, 0)
  return { items: results, totalInputTokens, totalOutputTokens, totalCostUsd, model: OCA_MODEL }
}

/**
 * Log cost to api_cost_log if present. Never throws — cost logging
 * failures must not block OCA generation.
 */
export async function logOcaCost(
  supabase: SupabaseClient,
  args: {
    model: string
    inputTokens: number
    outputTokens: number
    costUsd: number
    companyId: string | null
    action: string
    userId: string | null
  },
): Promise<void> {
  try {
    await supabase.from('api_cost_log').insert({
      model: args.model,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cost_usd: args.costUsd,
      action: args.action,
      company_id: args.companyId,
      user_id: args.userId,
    })
  } catch {
    // Swallow — audit_log already captures the OCA row itself.
  }
}
