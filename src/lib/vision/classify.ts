/**
 * AGUILA V1.5 · F14 — Document auto-classification via Claude Vision.
 *
 * Given a file in Supabase Storage, this module:
 *  1. Downloads the bytes (tries storage API first, then public URL).
 *  2. Calls Anthropic with the document content (PDF as `document`,
 *     image as `image`) and a structured-JSON extraction prompt.
 *  3. Parses the response into { doc_type, supplier, invoice_number,
 *     invoice_date, currency, amount, line_items }.
 *  4. Inserts one row into `document_classifications` regardless of
 *     outcome (error column carries the failure reason).
 *  5. Fires a `usage_events` telemetry row with event 'document_classified'.
 *
 * Server-only. Do not import from client components. The caller is
 * responsible for passing a fileUrl that points to a blob reachable
 * by the service role (i.e. the `expedientes` bucket).
 *
 * Graceful degradation: if ANTHROPIC_API_KEY is missing we short-
 * circuit with `vision_not_configured` — the caller decides how to
 * surface that (usually a silver info banner).
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const VISION_MODEL = 'claude-sonnet-4-6'

export type VisionDocType =
  | 'invoice'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'bol'
  | 'other'

export interface VisionLineItem {
  description: string | null
  quantity: number | null
  unit_price: number | null
  total: number | null
  fraccion: string | null
}

export interface VisionExtraction {
  doc_type: VisionDocType | null
  supplier: string | null
  invoice_number: string | null
  invoice_date: string | null
  currency: string | null
  amount: number | null
  line_items: VisionLineItem[]
}

export interface VisionClassifyResult {
  id: string | null
  extraction: VisionExtraction | null
  error: string | null
  notConfigured: boolean
}

export interface ClassifyParams {
  fileUrl: string
  companyId: string
  linkToExpedienteDocId?: string | null
  linkToInvoiceBankId?: string | null
  actor?: string | null
}

const SYSTEM_PROMPT = `Eres un extractor de documentos aduanales para la Patente 3596 de Laredo, TX.
Tu única salida es un objeto JSON con la forma exacta siguiente — sin prosa, sin markdown:

{
  "doc_type": "invoice|packing_list|certificate_of_origin|bol|other",
  "supplier": "<razón social del emisor o null>",
  "invoice_number": "<folio/número de factura o null>",
  "invoice_date": "YYYY-MM-DD o null",
  "currency": "MXN|USD|... o null",
  "amount": <número total sin comas ni símbolos o null>,
  "line_items": [
    {
      "description": "<string o null>",
      "quantity": <número o null>,
      "unit_price": <número o null>,
      "total": <número o null>,
      "fraccion": "<XXXX.XX.XX o null>"
    }
  ]
}

Reglas:
- Preserva la fracción arancelaria EXACTA con puntos (formato XXXX.XX.XX).
- No inventes datos — usa null cuando no sea claro.
- Máximo 40 line_items. Si hay más, trunca a los primeros 40.
- Devuelve [] si no hay partidas detectables, nunca null, para line_items.`

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

function coerceDocType(v: unknown): VisionDocType | null {
  const s = coerceString(v)?.toLowerCase() ?? null
  if (
    s === 'invoice' ||
    s === 'packing_list' ||
    s === 'certificate_of_origin' ||
    s === 'bol' ||
    s === 'other'
  ) {
    return s
  }
  return null
}

function coerceDate(v: unknown): string | null {
  const s = coerceString(v)
  if (!s) return null
  // Accept YYYY-MM-DD; anything else → attempt Date parse.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const parsed = new Date(s)
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Parse the Claude JSON response into our VisionExtraction shape.
 * Exposed so tests can exercise the parser without hitting the API.
 */
export function parseVisionResponse(raw: string): VisionExtraction {
  const cleaned = sanitizeJsonText(raw)
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Vision classifier returned non-object JSON')
  }
  const obj = parsed as Record<string, unknown>

  let lineItems: VisionLineItem[] = []
  if (Array.isArray(obj.line_items)) {
    lineItems = obj.line_items.slice(0, 40).map((row): VisionLineItem => {
      if (!row || typeof row !== 'object') {
        return {
          description: null,
          quantity: null,
          unit_price: null,
          total: null,
          fraccion: null,
        }
      }
      const r = row as Record<string, unknown>
      return {
        description: coerceString(r.description),
        quantity: coerceNumber(r.quantity),
        unit_price: coerceNumber(r.unit_price),
        total: coerceNumber(r.total),
        fraccion: coerceString(r.fraccion),
      }
    })
  }

  return {
    doc_type: coerceDocType(obj.doc_type),
    supplier: coerceString(obj.supplier),
    invoice_number: coerceString(obj.invoice_number),
    invoice_date: coerceDate(obj.invoice_date),
    currency: coerceString(obj.currency)?.toUpperCase() ?? null,
    amount: coerceNumber(obj.amount),
    line_items: lineItems,
  }
}

type SupportedImageMedia = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function mediaTypeFromUrl(url: string): {
  kind: 'pdf' | 'image' | 'unknown'
  mime: SupportedImageMedia | 'application/pdf' | null
} {
  const lower = url.split('?')[0].toLowerCase()
  if (lower.endsWith('.pdf')) return { kind: 'pdf', mime: 'application/pdf' }
  if (lower.endsWith('.png')) return { kind: 'image', mime: 'image/png' }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { kind: 'image', mime: 'image/jpeg' }
  if (lower.endsWith('.webp')) return { kind: 'image', mime: 'image/webp' }
  if (lower.endsWith('.gif')) return { kind: 'image', mime: 'image/gif' }
  return { kind: 'unknown', mime: null }
}

function derivePathFromPublicUrl(url: string): string | null {
  const idx = url.indexOf('/expedientes/')
  if (idx < 0) return null
  return url.slice(idx + '/expedientes/'.length).split('?')[0]
}

async function downloadBytes(
  supabase: SupabaseClient,
  fileUrl: string,
): Promise<Uint8Array | null> {
  const path = derivePathFromPublicUrl(fileUrl)
  if (path) {
    const { data: blob, error } = await supabase.storage.from('expedientes').download(path)
    if (!error && blob) return new Uint8Array(await blob.arrayBuffer())
  }
  try {
    const res = await fetch(fileUrl)
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
  } catch {
    // fall through
  }
  return null
}

async function callVision(
  client: Anthropic,
  bytes: Uint8Array,
  media: { kind: 'pdf' | 'image'; mime: SupportedImageMedia | 'application/pdf' },
): Promise<{ rawText: string; raw: unknown }> {
  const base64 = Buffer.from(bytes).toString('base64')
  const contentBlock =
    media.kind === 'pdf'
      ? ({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        } as const)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: media.mime as SupportedImageMedia,
            data: base64,
          },
        } as const)

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extrae los campos del documento. Responde solo JSON.' },
        ],
      },
    ],
  })

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return { rawText, raw: response }
}

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function insertClassificationRow(
  supabase: SupabaseClient,
  params: ClassifyParams,
  extraction: VisionExtraction | null,
  raw: unknown,
  errorMsg: string | null,
): Promise<string | null> {
  const row = {
    company_id: params.companyId,
    expediente_document_id: params.linkToExpedienteDocId ?? null,
    invoice_bank_id: params.linkToInvoiceBankId ?? null,
    file_url: params.fileUrl,
    doc_type: extraction?.doc_type ?? null,
    supplier: extraction?.supplier ?? null,
    invoice_number: extraction?.invoice_number ?? null,
    invoice_date: extraction?.invoice_date ?? null,
    currency: extraction?.currency ?? null,
    amount: extraction?.amount ?? null,
    line_items: extraction?.line_items ?? null,
    raw_response: raw ? (raw as Record<string, unknown>) : null,
    model: VISION_MODEL,
    confidence: null,
    error: errorMsg,
  }
  const { data, error } = await supabase
    .from('document_classifications')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) return null
  return (data.id as string) ?? null
}

async function emitUsageEvent(
  supabase: SupabaseClient,
  params: ClassifyParams,
  classificationId: string | null,
  ok: boolean,
): Promise<void> {
  try {
    // interaction_events is the backing store for the usage_events view.
    await supabase.from('interaction_events').insert({
      event_type: 'document_classified',
      company_id: params.companyId,
      entity_type: params.linkToInvoiceBankId ? 'invoice_bank' : 'expediente_document',
      entity_id: params.linkToInvoiceBankId ?? params.linkToExpedienteDocId ?? null,
      payload: {
        event: 'document_classified',
        classification_id: classificationId,
        ok,
        actor: params.actor ?? null,
      },
    })
  } catch {
    // Telemetry is never allowed to break the flow.
  }
}

/**
 * Run Claude Vision over a document in Storage and persist the extraction.
 *
 * Always resolves — never throws. The caller inspects `extraction`
 * for fields (prefill) and `error` / `notConfigured` for failure modes.
 */
export async function classifyDocumentWithVision(
  params: ClassifyParams,
): Promise<VisionClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { id: null, extraction: null, error: 'vision_not_configured', notConfigured: true }
  }

  const supabase = getSupabase()
  const media = mediaTypeFromUrl(params.fileUrl)
  if (media.kind === 'unknown' || !media.mime) {
    const id = await insertClassificationRow(
      supabase,
      params,
      null,
      null,
      `unsupported_media:${params.fileUrl.split('.').pop() ?? 'unknown'}`,
    )
    await emitUsageEvent(supabase, params, id, false)
    return { id, extraction: null, error: 'unsupported_media', notConfigured: false }
  }

  const bytes = await downloadBytes(supabase, params.fileUrl)
  if (!bytes) {
    const id = await insertClassificationRow(supabase, params, null, null, 'download_failed')
    await emitUsageEvent(supabase, params, id, false)
    return { id, extraction: null, error: 'download_failed', notConfigured: false }
  }

  const client = new Anthropic({ apiKey })
  try {
    const { rawText, raw } = await callVision(client, bytes, {
      kind: media.kind,
      mime: media.mime,
    })
    let extraction: VisionExtraction | null = null
    let parseError: string | null = null
    try {
      extraction = parseVisionResponse(rawText)
    } catch (err) {
      parseError = err instanceof Error ? err.message : 'parse_error'
    }
    const id = await insertClassificationRow(
      supabase,
      params,
      extraction,
      { text: rawText, sdk_response: raw },
      parseError,
    )
    await emitUsageEvent(supabase, params, id, !parseError)
    return { id, extraction, error: parseError, notConfigured: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'vision_error'
    const id = await insertClassificationRow(supabase, params, null, null, message)
    await emitUsageEvent(supabase, params, id, false)
    return { id, extraction: null, error: message, notConfigured: false }
  }
}
