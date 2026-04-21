/**
 * /api/documentos/analyze-text — text-only Claude classifier.
 *
 * Given a free-form Spanish paste (email body, product list, broker
 * note) returns the same VisionExtraction + completeness verdict shape
 * as the vision path, so the client UI doesn't branch on the result.
 *
 * Auth: session required, rate-limited 30/min/IP (tighter than /api/data
 * because each call spends Anthropic tokens).
 */

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Sonnet 4.6 pricing — input $3/1M, output $15/1M (April 2026)
const SONNET_IN_PER_K = 0.003
const SONNET_OUT_PER_K = 0.015
import {
  runCompleteness,
  labelForDocType,
  findPedimentoReference,
  type DocumentoStatus,
} from '@/lib/docs/completeness'
import type { VisionExtraction } from '@/lib/vision/classify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODEL = 'claude-sonnet-4-6'

const BodySchema = z.object({
  text: z.string().min(10).max(8000),
  hint: z.string().max(120).optional(),
})

const SYSTEM_PROMPT = `Eres un extractor de documentos aduanales mexicanos para la Patente 3596 de Laredo, TX.
El usuario te pega texto libre (copia de factura, correo de proveedor, lista de productos, nota del operador).
Tu única salida es un objeto JSON con la forma EXACTA siguiente — sin prosa, sin markdown:

{
  "doc_type": "invoice|packing_list|certificate_of_origin|bol|other",
  "supplier": "<razón social del emisor o null>",
  "invoice_number": "<folio o número de factura o null>",
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
- Si el texto menciona un pedimento (formato DD AD PPPP SSSSSSS), inclúyelo en supplier o invoice_number para que el sistema lo detecte.
- No inventes datos — usa null cuando no sea claro.
- Máximo 40 line_items. Si hay más, trunca.
- Devuelve [] si no hay partidas detectables, nunca null, para line_items.`

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
    const t = v.trim()
    return t.length > 0 ? t : null
  }
  return null
}

function coerceDocType(v: unknown): VisionExtraction['doc_type'] {
  const s = coerceString(v)?.toLowerCase() ?? null
  if (s === 'invoice' || s === 'packing_list' || s === 'certificate_of_origin' || s === 'bol' || s === 'other') {
    return s
  }
  return null
}

function parseExtraction(raw: string): VisionExtraction {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')
  const parsed: unknown = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('non-object JSON')
  }
  const obj = parsed as Record<string, unknown>
  const items = Array.isArray(obj.line_items) ? obj.line_items.slice(0, 40) : []
  return {
    doc_type: coerceDocType(obj.doc_type),
    supplier: coerceString(obj.supplier),
    invoice_number: coerceString(obj.invoice_number),
    invoice_date: coerceString(obj.invoice_date),
    currency: coerceString(obj.currency)?.toUpperCase() ?? null,
    amount: coerceNumber(obj.amount),
    line_items: items.map((row) => {
      if (!row || typeof row !== 'object') {
        return { description: null, quantity: null, unit_price: null, total: null, fraccion: null }
      }
      const r = row as Record<string, unknown>
      return {
        description: coerceString(r.description),
        quantity: coerceNumber(r.quantity),
        unit_price: coerceNumber(r.unit_price),
        total: coerceNumber(r.total),
        fraccion: coerceString(r.fraccion),
      }
    }),
  }
}

function legacyDocType(t: VisionExtraction['doc_type']): string {
  switch (t) {
    case 'invoice': return 'factura_comercial'
    case 'packing_list': return 'packing_list'
    case 'certificate_of_origin': return 'certificado_origen'
    case 'bol': return 'bill_of_lading'
    case 'other': return 'otro'
    default: return 'pending_manual'
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`analyze-text:${ip}`, 30, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { data: null, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Texto inválido (10–8000 caracteres)' } },
      { status: 400 },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      data: {
        status: 'review' satisfies DocumentoStatus,
        type: 'pending_manual',
        type_label: 'Análisis no configurado',
        issues: ['Clasificación automática no disponible en este momento'],
        linked_trafico_id: null,
        supplier: null,
        amount: null,
        currency: null,
      },
      error: null,
    })
  }

  const client = new Anthropic({ apiKey })
  let extraction: VisionExtraction | null = null
  const started = Date.now()
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: parsed.data.hint ? `Contexto: ${parsed.data.hint}\n\n${parsed.data.text}` : parsed.data.text },
          ],
        },
      ],
    })
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    extraction = parseExtraction(raw)
    // V1 cost tracking — every Anthropic call logs
    void supabase.from('api_cost_log').insert({
      model: MODEL,
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cost_usd: ((response.usage?.input_tokens ?? 0) * SONNET_IN_PER_K + (response.usage?.output_tokens ?? 0) * SONNET_OUT_PER_K) / 1000,
      action: 'analyze_text',
      client_code: session.companyId,
      latency_ms: Date.now() - started,
    }).then(() => {}, () => {})
  } catch {
    return NextResponse.json({
      data: {
        status: 'review' satisfies DocumentoStatus,
        type: 'pending_manual',
        type_label: 'No reconocido',
        issues: ['No fue posible interpretar el texto'],
        linked_trafico_id: null,
        supplier: null,
        amount: null,
        currency: null,
      },
      error: null,
    })
  }

  const completeness = runCompleteness(extraction)
  const pedRef = findPedimentoReference(extraction)
  const legacyType = legacyDocType(extraction.doc_type)

  return NextResponse.json({
    data: {
      status: completeness.status,
      type: legacyType,
      type_label: labelForDocType(extraction.doc_type),
      issues: completeness.issues,
      linked_trafico_id: pedRef,
      supplier: extraction.supplier,
      amount: extraction.amount,
      currency: extraction.currency,
    },
    error: null,
  })
}
