import Anthropic from '@anthropic-ai/sdk'

export const TEXT_MODEL = 'claude-haiku-4-5-20251001'
export const VISION_MODEL = 'claude-sonnet-4-6'

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export interface SelfClassifyInput {
  description: string
  imageBase64?: string
  imageMime?: ImageMime
}

export interface SelfClassifyAlternative {
  fraccion: string
  descripcion: string
  confidence: number
}

export interface SelfClassifyResult {
  fraccion: string | null
  tmec_eligible: boolean | null
  nom_required: string[]
  confidence: number
  justificacion: string | null
  alternatives: SelfClassifyAlternative[]
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
}

export interface SelfClassifyError {
  code:
    | 'NOT_CONFIGURED'
    | 'PARSE_ERROR'
    | 'API_ERROR'
    | 'INVALID_INPUT'
  message: string
  model: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
}

export type SelfClassifyOutcome =
  | { data: SelfClassifyResult; error: null }
  | { data: null; error: SelfClassifyError }

const SYSTEM_PROMPT = `Eres un clasificador arancelario mexicano experto, asistente de la Patente 3596 en Aduana 240 Nuevo Laredo.
Recibes una descripción de producto (y posiblemente una imagen) y devuelves SOLO un objeto JSON con esta forma exacta — sin prosa, sin markdown:

{
  "fraccion": "XXXX.XX.XX o null",
  "tmec_eligible": true | false | null,
  "nom_required": ["NOM-XXX-YYY", ...] o [],
  "confidence": 0-100,
  "justificacion": "1-2 oraciones en español explicando la clasificación",
  "alternatives": [
    { "fraccion": "XXXX.XX.XX", "descripcion": "<descripción breve>", "confidence": 0-100 }
  ]
}

Reglas:
- La fracción se devuelve EXACTAMENTE en formato XXXX.XX.XX (con puntos, 8 dígitos).
- Si no puedes clasificar con seguridad, devuelve confidence: 0 y fraccion: null — nunca inventes.
- Máximo 2 alternativas. Si no hay, devuelve [].
- T-MEC: true solo si el producto califica bajo reglas de origen USMCA típicas para esa fracción.
- nom_required: lista las NOMs aplicables al ingreso (ej. NOM-050-SCFI, NOM-051-SCFI, NOM-004-SE) o [] si no aplica ninguna.
- Toda la justificación debe estar en español.`

function sanitizeJsonText(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
}

function coerceString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return null
}

function coerceConfidence(v: unknown): number {
  const n = coerceNumber(v)
  if (n == null) return 0
  if (n <= 1 && n >= 0) return Math.round(n * 100)
  return Math.max(0, Math.min(100, Math.round(n)))
}

function coerceFraccion(v: unknown): string | null {
  const s = coerceString(v)
  if (!s) return null
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(s)) return s
  const digits = s.replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  return null
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(coerceString).filter((x): x is string => Boolean(x))
}

function coerceAlternatives(v: unknown): SelfClassifyAlternative[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 2)
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const fraccion = coerceFraccion(r.fraccion)
      if (!fraccion) return null
      return {
        fraccion,
        descripcion: coerceString(r.descripcion) ?? coerceString(r.description) ?? '',
        confidence: coerceConfidence(r.confidence),
      }
    })
    .filter((x): x is SelfClassifyAlternative => x != null)
}

export function parseSelfClassifyResponse(raw: string): Omit<SelfClassifyResult, 'model' | 'input_tokens' | 'output_tokens' | 'latency_ms'> {
  const cleaned = sanitizeJsonText(raw)
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Classifier returned non-object JSON')
  }
  const obj = parsed as Record<string, unknown>
  return {
    fraccion: coerceFraccion(obj.fraccion),
    tmec_eligible: coerceBool(obj.tmec_eligible),
    nom_required: coerceStringArray(obj.nom_required),
    confidence: coerceConfidence(obj.confidence),
    justificacion: coerceString(obj.justificacion),
    alternatives: coerceAlternatives(obj.alternatives),
  }
}

export function pickModel(input: SelfClassifyInput): string {
  return input.imageBase64 && input.imageMime ? VISION_MODEL : TEXT_MODEL
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  if (model === VISION_MODEL) {
    return (inputTokens * 0.003 + outputTokens * 0.015) / 1000
  }
  // Haiku 4.5 pricing
  return (inputTokens * 0.001 + outputTokens * 0.005) / 1000
}

export async function classifyProduct(
  input: SelfClassifyInput,
  deps: { client?: Anthropic } = {},
): Promise<SelfClassifyOutcome> {
  const model = pickModel(input)
  const startedAt = Date.now()

  if (!input.description || input.description.trim().length < 3) {
    return {
      data: null,
      error: {
        code: 'INVALID_INPUT',
        message: 'La descripción debe tener al menos 3 caracteres.',
        model,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: 0,
      },
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!deps.client && !apiKey) {
    return {
      data: null,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'ANTHROPIC_API_KEY no configurada.',
        model,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: Date.now() - startedAt,
      },
    }
  }

  const client = deps.client ?? new Anthropic({ apiKey: apiKey! })

  const userText = `Producto a clasificar:\n${input.description.trim()}\n\nDevuelve solo el JSON.`
  const content: Anthropic.ContentBlockParam[] =
    input.imageBase64 && input.imageMime
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: input.imageMime,
              data: input.imageBase64,
            },
          },
          { type: 'text', text: userText },
        ]
      : [{ type: 'text', text: userText }]

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'API_ERROR',
        message: err instanceof Error ? err.message : 'Anthropic API failed',
        model,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: Date.now() - startedAt,
      },
    }
  }

  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  const latencyMs = Date.now() - startedAt

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  try {
    const parsed = parseSelfClassifyResponse(rawText)
    return {
      data: { ...parsed, model, input_tokens: inputTokens, output_tokens: outputTokens, latency_ms: latencyMs },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'PARSE_ERROR',
        message: err instanceof Error ? err.message : 'parse_error',
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: latencyMs,
      },
    }
  }
}
