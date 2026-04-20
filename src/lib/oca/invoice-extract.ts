/**
 * PORTAL · OCA Classifier — invoice extraction via Claude Sonnet vision.
 *
 * Server-only. Given raw bytes of an invoice (PDF or image), Sonnet-4.6
 * returns the structured line-item table the rest of the Classifier
 * pipeline consumes: supplier + invoice metadata + an array of parts
 * with item_no, description, qty, country, extended_price.
 *
 * This module is the bytes-to-JSON primitive. It does NOT touch
 * Supabase, does NOT resolve tenants, and does NOT write cost logs.
 * Callers (API routes) own the cost log + rate-limit envelope.
 *
 * Pattern composed from src/lib/vision/classify.ts — same model, same
 * JSON-only contract, same PDF + image handling. This is the invoice-
 * specific shape tuned for customs brokers (line #, country of origin,
 * pre-classified fraccion hint, incoterm, importer of record).
 */
import Anthropic from '@anthropic-ai/sdk'

export const INVOICE_VISION_MODEL = 'claude-sonnet-4-6'

export type InvoicePartCountry =
  | 'US'
  | 'MX'
  | 'CA'
  | 'CN'
  | 'JP'
  | 'DE'
  | 'KR'
  | 'TW'
  | 'IT'
  | 'OTHER'

export interface InvoicePart {
  line: number | null
  item_no: string | null
  description: string | null
  qty: number | null
  uom: string | null
  country_raw: string | null
  country_iso: InvoicePartCountry | null
  unit_price_usd: number | null
  extended_price_usd: number | null
  pre_classified_fraccion: string | null
}

export interface InvoiceExtraction {
  invoice_number: string | null
  supplier: string | null
  supplier_account_number: string | null
  invoice_date: string | null
  po_number: string | null
  total_invoice_amount_usd: number | null
  currency: string | null
  incoterm: string | null
  importer_of_record_rfc: string | null
  importer_of_record_name: string | null
  parts: InvoicePart[]
}

export interface InvoiceExtractResult {
  extraction: InvoiceExtraction | null
  error: string | null
  notConfigured: boolean
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

const SYSTEM_PROMPT = `Eres un extractor de facturas comerciales para la Patente 3596 de Laredo, TX.
Tu única salida es un objeto JSON con la forma exacta siguiente — sin prosa, sin markdown, sin backticks:

{
  "invoice_number": "<folio/número de factura o null>",
  "supplier": "<razón social del emisor o null>",
  "supplier_account_number": "<número de cuenta del cliente con el proveedor, o null>",
  "invoice_date": "YYYY-MM-DD o null",
  "po_number": "<número de orden de compra o null>",
  "total_invoice_amount_usd": <número total sin comas ni símbolos o null>,
  "currency": "USD|MXN|... o null",
  "incoterm": "EXW|FOB|CIF|DAP|... o null",
  "importer_of_record_rfc": "<RFC del importador mexicano o null>",
  "importer_of_record_name": "<razón social del importador mexicano o null>",
  "parts": [
    {
      "line": <número entero o null>,
      "item_no": "<clave del proveedor, p.ej. 18MB, BG600E, TS66 o null>",
      "description": "<descripción completa o null>",
      "qty": <número o null>,
      "uom": "EA|PZ|KG|LB|... o null",
      "country_raw": "<país tal como aparece, p.ej. USA / MADE IN USA / CN o null>",
      "unit_price_usd": <número sin símbolos o null>,
      "extended_price_usd": <número sin símbolos o null>,
      "pre_classified_fraccion": "<fracción arancelaria XXXX.XX preimpresa en la factura o null>"
    }
  ]
}

Reglas estrictas:
- Preserva item_no EXACTAMENTE como aparece (ej. 18MB, BG600E, W-5, TS66, 231050 — guiones y mayúsculas conservadas).
- Preserva descripciones en su idioma original (inglés si la factura es en inglés).
- pre_classified_fraccion captura cualquier fracción con puntos (XXXX.XX o XXXX.XX.XX) impresa en la factura como hint — null si no hay ninguna.
- country_raw se deja como texto libre; no normalices aún.
- Máximo 100 parts. Si hay más, trunca a las primeras 100 y añade un campo "_truncated": true al JSON raíz.
- No inventes datos. Null cuando no sea claro. [] si no hay partidas.
- Si la factura tiene múltiples páginas con una tabla continua (renglón, parte, descripción, cantidad, precio), extrae todos los renglones en orden.`

function sanitizeJsonText(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function coerceString(v: unknown): string | null {
  if (typeof v === 'string') {
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function coerceDate(v: unknown): string | null {
  const s = coerceString(v)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const parsed = new Date(s)
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

function normalizeCountry(raw: string | null): InvoicePartCountry | null {
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (/\b(USA|U\.S\.A\.|US|UNITED STATES|MADE IN USA|ESTADOS UNIDOS)\b/.test(upper)) return 'US'
  if (/\b(MX|MEXICO|MÉXICO)\b/.test(upper)) return 'MX'
  if (/\b(CA|CANADA|CANADÁ)\b/.test(upper)) return 'CA'
  if (/\b(CN|CHINA)\b/.test(upper)) return 'CN'
  if (/\b(JP|JAPAN|JAPÓN)\b/.test(upper)) return 'JP'
  if (/\b(DE|GERMANY|ALEMANIA)\b/.test(upper)) return 'DE'
  if (/\b(KR|KOREA|COREA)\b/.test(upper)) return 'KR'
  if (/\b(TW|TAIWAN)\b/.test(upper)) return 'TW'
  if (/\b(IT|ITALY|ITALIA)\b/.test(upper)) return 'IT'
  return 'OTHER'
}

/**
 * Pure parser — exposed for unit tests so the Anthropic call is not required
 * to exercise the coercion layer.
 */
export function parseInvoiceResponse(raw: string): InvoiceExtraction {
  const cleaned = sanitizeJsonText(raw)
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invoice extractor returned non-object JSON')
  }
  const obj = parsed as Record<string, unknown>

  let parts: InvoicePart[] = []
  if (Array.isArray(obj.parts)) {
    parts = obj.parts.slice(0, 100).map((row): InvoicePart => {
      if (!row || typeof row !== 'object') {
        return {
          line: null, item_no: null, description: null, qty: null, uom: null,
          country_raw: null, country_iso: null,
          unit_price_usd: null, extended_price_usd: null,
          pre_classified_fraccion: null,
        }
      }
      const r = row as Record<string, unknown>
      const countryRaw = coerceString(r.country_raw)
      return {
        line: coerceNumber(r.line),
        item_no: coerceString(r.item_no),
        description: coerceString(r.description),
        qty: coerceNumber(r.qty),
        uom: coerceString(r.uom),
        country_raw: countryRaw,
        country_iso: normalizeCountry(countryRaw),
        unit_price_usd: coerceNumber(r.unit_price_usd),
        extended_price_usd: coerceNumber(r.extended_price_usd),
        pre_classified_fraccion: coerceString(r.pre_classified_fraccion),
      }
    })
  }

  return {
    invoice_number: coerceString(obj.invoice_number),
    supplier: coerceString(obj.supplier),
    supplier_account_number: coerceString(obj.supplier_account_number),
    invoice_date: coerceDate(obj.invoice_date),
    po_number: coerceString(obj.po_number),
    total_invoice_amount_usd: coerceNumber(obj.total_invoice_amount_usd),
    currency: coerceString(obj.currency)?.toUpperCase() ?? null,
    incoterm: coerceString(obj.incoterm)?.toUpperCase() ?? null,
    importer_of_record_rfc: coerceString(obj.importer_of_record_rfc),
    importer_of_record_name: coerceString(obj.importer_of_record_name),
    parts,
  }
}

type SupportedImageMedia = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ExtractInvoiceInput {
  bytes: Uint8Array
  mediaType: 'application/pdf' | SupportedImageMedia
  apiKey?: string
}

/**
 * Extract a structured invoice from raw bytes. Non-throwing: returns
 * `notConfigured` when the Anthropic key is missing, `error` for any
 * other failure mode. Callers own cost-log insertion using the
 * returned token counts.
 */
export async function extractInvoice(
  input: ExtractInvoiceInput,
): Promise<InvoiceExtractResult> {
  const started = Date.now()
  const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      extraction: null,
      error: 'vision_not_configured',
      notConfigured: true,
      model: INVOICE_VISION_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
    }
  }

  const base64 = Buffer.from(input.bytes).toString('base64')
  const contentBlock =
    input.mediaType === 'application/pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as const)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: input.mediaType, data: base64 },
        } as const)

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: INVOICE_VISION_MODEL,
      max_tokens: 4000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Extrae la factura completa. Responde solo JSON.' },
          ],
        },
      ],
    })

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const extraction = parseInvoiceResponse(rawText)
    return {
      extraction,
      error: null,
      notConfigured: false,
      model: INVOICE_VISION_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      extraction: null,
      error: message,
      notConfigured: false,
      model: INVOICE_VISION_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
    }
  }
}

// Opus + Sonnet + Haiku pricing per Anthropic public pricing (tokens per 1K USD).
// Sonnet-4.6: $3 / $15 per million tokens = $0.003 / $0.015 per 1K.
const SONNET_INPUT_PER_1K = 3 / 1000
const SONNET_OUTPUT_PER_1K = 15 / 1000

/**
 * Compute Sonnet-4.6 cost for a given token usage. Used by API routes to
 * insert api_cost_log rows. Pulling it out of inline math so the rate
 * moves in one place if Anthropic changes pricing.
 */
export function invoiceExtractCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * SONNET_INPUT_PER_1K + outputTokens * SONNET_OUTPUT_PER_1K) / 1000
}
