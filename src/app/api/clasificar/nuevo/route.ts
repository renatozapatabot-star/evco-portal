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
export const maxDuration = 45

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  description: z.string().min(3).max(2000),
  imageBase64: z.string().max(8 * 1024 * 1024).optional(),
  imageMime: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const rl = await rateLimitDB(`clasificar-nuevo:${session.companyId}:${session.role}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      { data: null, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' } },
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
  if (parsed.data.imageBase64 && !parsed.data.imageMime) {
    return err('VALIDATION_ERROR', 'imageMime requerido cuando se envía imageBase64', 400)
  }

  const result = await classifyProduct({
    description: parsed.data.description,
    imageBase64: parsed.data.imageBase64,
    imageMime: parsed.data.imageMime as ImageMime | undefined,
  })

  const baseRow = {
    company_id: session.companyId,
    created_by_role: session.role,
    description: parsed.data.description,
    image_mime: parsed.data.imageMime ?? null,
  }

  if (result.error) {
    const e = result.error
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
      action: 'self_service_classify_failed',
      client_code: session.companyId,
      latency_ms: e.latency_ms,
    }).then(() => {}, (err) => console.error('[api_cost_log] clasificar/nuevo:', err.message))

    const status = e.code === 'NOT_CONFIGURED' ? 503 : 502
    return NextResponse.json(
      { data: null, error: { code: e.code, message: e.message, log_id: logRow?.id ?? null } },
      { status },
    )
  }

  const r = result.data
  const cost = estimateCostUsd(r.model, r.input_tokens, r.output_tokens)

  const { data: logRow, error: insertErr } = await supabase
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

  if (insertErr || !logRow) {
    return err('INTERNAL_ERROR', 'No se pudo registrar la clasificación: ' + (insertErr?.message ?? 'unknown'), 500)
  }

  void supabase.from('api_cost_log').insert({
    model: r.model,
    input_tokens: r.input_tokens,
    output_tokens: r.output_tokens,
    cost_usd: cost,
    action: 'self_service_classify',
    client_code: session.companyId,
    latency_ms: r.latency_ms,
  }).then(() => {}, (err) => console.error('[api_cost_log] clasificar/nuevo:', err.message))

  return NextResponse.json({
    data: {
      id: logRow.id,
      fraccion: r.fraccion,
      tmec_eligible: r.tmec_eligible,
      nom_required: r.nom_required,
      confidence: r.confidence,
      justificacion: r.justificacion,
      alternatives: r.alternatives,
      model: r.model,
      latency_ms: r.latency_ms,
    },
    error: null,
  })
}
