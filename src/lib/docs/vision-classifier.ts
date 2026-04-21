/**
 * V1 Polish Pack · Block 3 — Claude vision document classifier.
 *
 * Sends a base64-encoded document image to Anthropic and constrains
 * the output to a single JSON object picking one of 8 customs doc
 * types. Mirrors the `vision` model class in scripts/lib/llm.js
 * (claude-sonnet-4-6) so TS/JS callers converge on the same model.
 *
 * Fail-fast: any Anthropic error bubbles up. The /api/docs/classify
 * route catches it and flags the row as `pending_manual`. NEVER
 * silently fall back here — silent success is the bug we're fixing.
 */

import Anthropic from '@anthropic-ai/sdk'

// Mirrors MODEL_MAP.vision in scripts/lib/llm.js. Bumping the model
// in ONE place (there) is intentional; TS keeps its own constant so
// the Next.js build doesn't import from scripts/.
const VISION_MODEL = 'claude-sonnet-4-6'

export const DOC_TYPES = [
  'factura',
  'bill_of_lading',
  'packing_list',
  'certificado_origen',
  'carta_porte',
  'pedimento',
  'rfc_constancia',
  'other',
] as const

export type DocType = (typeof DOC_TYPES)[number]

export interface ClassificationResult {
  type: DocType
  confidence: number
  rawText: string
  model: string
  tokensIn: number
  tokensOut: number
}

const SYSTEM_PROMPT = `Eres un clasificador de documentos aduanales mexicanos para la Patente 3596.
Tu única tarea es identificar qué tipo de documento es la imagen y devolver JSON.

Tipos válidos (elige EXACTAMENTE uno):
- factura: factura comercial (invoice)
- bill_of_lading: conocimiento de embarque
- packing_list: lista de empaque
- certificado_origen: certificado de origen (T-MEC/USMCA, CO)
- carta_porte: carta porte o complemento SAT
- pedimento: pedimento consolidado o detallado (SAT)
- rfc_constancia: constancia de situación fiscal (RFC)
- other: cualquier otro documento

Responde ÚNICAMENTE con JSON válido, sin prosa, sin markdown, con la forma:
{"type":"<uno de los anteriores>","confidence":0.00-1.00}

confidence es tu certeza, 0 a 1. Usa 0.6 si no estás seguro. No inventes tipos.`

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function normalizeMediaType(mime: string): SupportedMediaType {
  const lower = mime.toLowerCase()
  if (lower.includes('png')) return 'image/png'
  if (lower.includes('gif')) return 'image/gif'
  if (lower.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

function parseJsonStrict(text: string): { type: string; confidence: number } {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Vision classifier returned non-object JSON')
  }
  const obj = parsed as Record<string, unknown>
  const type = typeof obj.type === 'string' ? obj.type : ''
  const confidenceRaw = obj.confidence
  const confidence =
    typeof confidenceRaw === 'number'
      ? confidenceRaw
      : typeof confidenceRaw === 'string'
        ? Number.parseFloat(confidenceRaw)
        : NaN
  if (!type) throw new Error('Vision classifier returned no type')
  if (!Number.isFinite(confidence)) throw new Error('Vision classifier returned no confidence')
  return { type, confidence }
}

/**
 * Classify a document image. Throws on any API or parse error — the
 * caller is expected to mark the row 'pending_manual' and surface a
 * red toast. Never swallow here.
 */
export async function classifyDocumentImage(params: {
  base64Image: string
  mediaType: string
  callerName?: string
}): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY missing — vision classifier cannot run')
  }
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 256,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: normalizeMediaType(params.mediaType),
              data: params.base64Image,
            },
          },
          {
            type: 'text',
            text: 'Clasifica este documento. Responde solo JSON.',
          },
        ],
      },
    ],
  })

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const { type, confidence } = parseJsonStrict(rawText)

  const safeType: DocType = (DOC_TYPES as readonly string[]).includes(type)
    ? (type as DocType)
    : 'other'

  // Clamp 0..1 defensively — the model occasionally returns 0-100.
  const clamped =
    confidence > 1 && confidence <= 100
      ? confidence / 100
      : Math.max(0, Math.min(1, confidence))

  return {
    type: safeType,
    confidence: clamped,
    rawText,
    model: VISION_MODEL,
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
  }
}
