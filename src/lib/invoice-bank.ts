/**
 * Block 8 · Invoice Bank — pure logic.
 *
 * Field extraction from Claude Sonnet Vision output, status transition
 * validation, and server-side helpers for assignment. Route handlers
 * call these — business logic never lives inline in /api/**.
 *
 * The vision-classifier in src/lib/docs/vision-classifier.ts only
 * returns { type, confidence }. Block 8 needs invoice-specific fields
 * (invoice_number, supplier_name, amount, currency). This file owns
 * the invoice-shaped vision prompt + response parser.
 */

import Anthropic from '@anthropic-ai/sdk'

const VISION_MODEL = 'claude-sonnet-4-6'

export type InvoiceBankStatus = 'unassigned' | 'assigned' | 'archived'

export interface InvoiceExtractedFields {
  invoice_number: string | null
  supplier_name: string | null
  amount: number | null
  currency: 'MXN' | 'USD' | null
  confidence: number
}

export interface InvoiceBankRow {
  id: string
  invoice_number: string | null
  supplier_name: string | null
  amount: number | null
  currency: string | null
  status: InvoiceBankStatus
  file_url: string | null
  received_at: string | null
  assigned_to_trafico_id: string | null
  assigned_at: string | null
  company_id: string | null
}

export const INVOICE_BANK_EVENTS = [
  'invoice_bank_opened',
  'invoice_uploaded',
  'invoice_classified',
  'invoice_assigned',
  'invoice_archived',
  'invoice_deleted',
] as const

export type InvoiceBankEvent = (typeof INVOICE_BANK_EVENTS)[number]

const INVOICE_VISION_PROMPT = `Eres un extractor de datos de facturas comerciales aduanales mexicanas.
Extrae los campos de la factura y devuelve ÚNICAMENTE JSON válido con esta forma:

{"invoice_number":"<string o null>","supplier_name":"<string o null>","amount":<número o null>,"currency":"MXN"|"USD"|null,"confidence":0.00-1.00}

Reglas:
- invoice_number: el folio, número o referencia de la factura. No inventes.
- supplier_name: nombre del emisor/proveedor. Si es razón social, úsala completa.
- amount: total de la factura como número (sin comas, sin símbolos). Si no es claro, null.
- currency: "MXN" o "USD" (mayúsculas). Si no hay indicador explícito, null.
- confidence: tu certeza 0 a 1. Usa 0.5 cuando dudes.

No prosa, no markdown, solo el JSON.`

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function normalizeMediaType(mime: string): SupportedMediaType {
  const lower = mime.toLowerCase()
  if (lower.includes('png')) return 'image/png'
  if (lower.includes('gif')) return 'image/gif'
  if (lower.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

/**
 * Parse the JSON string returned by Claude into structured invoice
 * fields. Exposed so tests can run without hitting the API.
 */
export function parseInvoiceExtraction(rawText: string): InvoiceExtractedFields {
  let cleaned = rawText.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Extractor devolvió JSON que no es un objeto')
  }
  const obj = parsed as Record<string, unknown>

  const invoice_number =
    typeof obj.invoice_number === 'string' && obj.invoice_number.trim().length > 0
      ? obj.invoice_number.trim()
      : null
  const supplier_name =
    typeof obj.supplier_name === 'string' && obj.supplier_name.trim().length > 0
      ? obj.supplier_name.trim()
      : null

  let amount: number | null = null
  if (typeof obj.amount === 'number' && Number.isFinite(obj.amount)) amount = obj.amount
  else if (typeof obj.amount === 'string') {
    const parsedAmount = Number.parseFloat(obj.amount.replace(/[^0-9.]/g, ''))
    amount = Number.isFinite(parsedAmount) ? parsedAmount : null
  }

  let currency: 'MXN' | 'USD' | null = null
  if (typeof obj.currency === 'string') {
    const cu = obj.currency.toUpperCase().trim()
    if (cu === 'MXN' || cu === 'USD') currency = cu
  }

  const confidenceRaw = obj.confidence
  let confidence =
    typeof confidenceRaw === 'number'
      ? confidenceRaw
      : typeof confidenceRaw === 'string'
        ? Number.parseFloat(confidenceRaw)
        : 0.5
  if (!Number.isFinite(confidence)) confidence = 0.5
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100
  confidence = Math.max(0, Math.min(1, confidence))

  return { invoice_number, supplier_name, amount, currency, confidence }
}

/**
 * Call Claude Sonnet Vision to extract invoice fields. Throws on any
 * API/parse error so the caller marks the row for manual review.
 */
export async function extractInvoiceFields(params: {
  base64Image: string
  mediaType: string
}): Promise<InvoiceExtractedFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — invoice extractor cannot run')
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 400,
    temperature: 0,
    system: INVOICE_VISION_PROMPT,
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
          { type: 'text', text: 'Extrae los campos. Responde solo JSON.' },
        ],
      },
    ],
  })

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return parseInvoiceExtraction(rawText)
}

/**
 * Validate a status transition. Returns true if the move is allowed.
 *
 * unassigned → assigned | archived
 * assigned   → archived (unassigning not supported in v1 — a new
 *              assignment replaces the old one)
 * archived   → (terminal for now; re-opening is a follow-up)
 */
export function isValidStatusTransition(
  from: InvoiceBankStatus,
  to: InvoiceBankStatus,
): boolean {
  if (from === to) return false
  if (from === 'unassigned') return to === 'assigned' || to === 'archived'
  if (from === 'assigned') return to === 'archived'
  return false
}

/**
 * Shape the payload for the workflow_events emission fired when an
 * invoice is assigned. Kept pure so tests can assert the shape without
 * hitting Supabase.
 */
export function buildInvoiceAssignedPayload(args: {
  invoiceId: string
  traficoId: string
  invoiceNumber: string | null
  supplierName: string | null
  amount: number | null
  currency: string | null
  actor: string
}): {
  workflow: 'invoice'
  event_type: 'invoice_assigned'
  trigger_id: string
  payload: Record<string, unknown>
} {
  return {
    workflow: 'invoice',
    event_type: 'invoice_assigned',
    trigger_id: args.traficoId,
    payload: {
      invoice_id: args.invoiceId,
      invoice_number: args.invoiceNumber,
      supplier_name: args.supplierName,
      amount: args.amount,
      currency: args.currency,
      actor: args.actor,
    },
  }
}
