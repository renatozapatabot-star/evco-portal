/**
 * POST /api/clasificar/bulk — batch classification (operator/admin/broker).
 *
 * Accepts up to 20 products, runs Haiku classifyProduct() in parallel with
 * a concurrency cap of 10, logs each to classification_log + api_cost_log.
 * Returns array with one result row per input in original order.
 *
 * Rate-limited per session at 4 batch/min (each batch is already up to
 * 20 calls, so 4x20=80/min headroom for an operator).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { rateLimitDB } from '@/lib/rate-limit-db'
import {
  classifyProduct,
  estimateCostUsd,
  type ImageMime,
} from '@/lib/classification/self-service'

export const runtime = 'nodejs'
export const maxDuration = 90

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MAX_ITEMS = 20
const CONCURRENCY = 10
const PRIVILEGED_ROLES = new Set(['operator', 'admin', 'broker'])

const ItemSchema = z.object({
  producto_id: z.union([z.string(), z.number()]).optional(),
  description: z.string().min(3).max(2000),
  imageBase64: z.string().max(8 * 1024 * 1024).optional(),
  imageMime: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
})

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1).max(MAX_ITEMS),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

interface BulkResultRow {
  producto_id: string | number | null
  classification_log_id: string | null
  fraccion: string | null
  tmec_eligible: boolean | null
  nom_required: string[]
  confidence: number
  justificacion: string | null
  alternatives: { fraccion: string; descripcion: string; confidence: number }[]
  error_code?: string
  error_message?: string
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function drain() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => drain())
  await Promise.all(runners)
  return results
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)
  if (!PRIVILEGED_ROLES.has(session.role)) {
    return err('FORBIDDEN', 'Solo operadores pueden clasificar en bloque', 403)
  }

  const rl = await rateLimitDB(`clasificar-bulk:${session.companyId}:${session.role}`, 4, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { data: null, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Espera un minuto.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'Cuerpo JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  for (const item of parsed.data.items) {
    if (item.imageBase64 && !item.imageMime) {
      return err('VALIDATION_ERROR', 'imageMime requerido cuando se envía imageBase64', 400)
    }
  }

  const results = await runWithConcurrency(parsed.data.items, CONCURRENCY, async (item) => {
    const outcome = await classifyProduct({
      description: item.description,
      imageBase64: item.imageBase64,
      imageMime: item.imageMime as ImageMime | undefined,
    })

    const baseRow = {
      company_id: session.companyId,
      created_by_role: session.role,
      description: item.description,
      image_mime: item.imageMime ?? null,
    }

    if (outcome.error) {
      const e = outcome.error
      const cost = estimateCostUsd(e.model, e.input_tokens, e.output_tokens)
      const { data: logRow } = await supabase
        .from('classification_log')
        .insert({
          ...baseRow,
          model: e.model,
          confidence: 0,
          input_tokens: e.input_tokens,
          output_tokens: e.output_tokens,
          cost_usd: cost,
          latency_ms: e.latency_ms,
          error_code: e.code,
        })
        .select('id')
        .single()
      void supabase.from('api_cost_log').insert({
        model: e.model,
        input_tokens: e.input_tokens,
        output_tokens: e.output_tokens,
        cost_usd: cost,
        action: 'bulk_classify_failed',
        client_code: session.companyId,
        latency_ms: e.latency_ms,
      }).then(() => {}, () => {})
      const row: BulkResultRow = {
        producto_id: item.producto_id ?? null,
        classification_log_id: (logRow?.id as string | undefined) ?? null,
        fraccion: null,
        tmec_eligible: null,
        nom_required: [],
        confidence: 0,
        justificacion: null,
        alternatives: [],
        error_code: e.code,
        error_message: e.message,
      }
      return row
    }

    const r = outcome.data
    const cost = estimateCostUsd(r.model, r.input_tokens, r.output_tokens)
    const { data: logRow } = await supabase
      .from('classification_log')
      .insert({
        ...baseRow,
        model: r.model,
        fraccion: r.fraccion,
        tmec_eligible: r.tmec_eligible,
        nom_required: r.nom_required.length ? r.nom_required : null,
        confidence: r.confidence,
        justificacion: r.justificacion,
        alternatives: r.alternatives.length ? r.alternatives : null,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        cost_usd: cost,
        latency_ms: r.latency_ms,
      })
      .select('id')
      .single()
    void supabase.from('api_cost_log').insert({
      model: r.model,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: cost,
      action: 'bulk_classify',
      client_code: session.companyId,
      latency_ms: r.latency_ms,
    }).then(() => {}, () => {})
    const row: BulkResultRow = {
      producto_id: item.producto_id ?? null,
      classification_log_id: (logRow?.id as string | undefined) ?? null,
      fraccion: r.fraccion,
      tmec_eligible: r.tmec_eligible,
      nom_required: r.nom_required,
      confidence: r.confidence,
      justificacion: r.justificacion,
      alternatives: r.alternatives,
    }
    return row
  })

  const ok = results.filter((r) => !r.error_code).length
  const failed = results.length - ok

  return NextResponse.json({
    data: { results, ok, failed },
    error: null,
  })
}
