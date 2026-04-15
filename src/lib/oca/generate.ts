/**
 * ZAPATA AI · OCA — generate a draft classification opinion via Opus.
 *
 * Server-only. Opus is reserved for complex regulatory reasoning per
 * CLAUDE.md model routing. Never call this from the browser.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OcaGenerateInput, OcaOpinionDraft } from './types'

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
