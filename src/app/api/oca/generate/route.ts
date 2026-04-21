import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { generateOcaOpinion, logOcaCost } from '@/lib/oca/generate'
import { nextOpinionNumber, isValidFraccion } from '@/lib/oca/opinion-number'
import type { OcaRow } from '@/lib/oca/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const bodySchema = z.object({
  product_description: z.string().min(10).max(2000),
  pais_origen: z.string().min(2).max(80),
  uso_final: z.string().max(500).optional(),
  fraccion_sugerida: z.string().optional().refine(v => !v || isValidFraccion(v), 'Fracción inválida (formato XXXX.XX.XX)'),
  trafico_id: z.string().optional(),
})

function unauthorized() {
  return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida' } }, { status: 401 })
}

function forbidden() {
  return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Sólo admin o broker pueden generar opiniones OCA' } }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return unauthorized()
  if (!['admin', 'broker', 'operator'].includes(session.role)) return forbidden()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join('; ') } },
      { status: 400 },
    )
  }

  const companyId = request.cookies.get('company_id')?.value ?? null

  let result
  try {
    result = await generateOcaOpinion(parsed.data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 })
  }

  const { draft } = result
  const opinionNumber = await nextOpinionNumber(supabase)

  const { data: inserted, error: insErr } = await supabase
    .from('oca_database')
    .insert({
      opinion_number: opinionNumber,
      company_id: companyId,
      trafico_id: parsed.data.trafico_id ?? null,
      product_description: parsed.data.product_description,
      fraccion_recomendada: draft.fraccion_recomendada,
      pais_origen: parsed.data.pais_origen,
      uso_final: parsed.data.uso_final ?? null,
      fundamento_legal: draft.fundamento_legal,
      nom_aplicable: draft.nom_aplicable,
      tmec_elegibilidad: draft.tmec_elegibilidad,
      vigencia_hasta: draft.vigencia_hasta,
      model_used: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      generated_by: session.role,
      status: 'draft',
    })
    .select()
    .single<OcaRow>()

  if (insErr || !inserted) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: `No se pudo guardar OCA: ${insErr?.message ?? 'unknown'}` } },
      { status: 500 },
    )
  }

  await logOcaCost(supabase, {
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    companyId,
    action: 'oca.generate',
    userId: session.role,
  })

  return NextResponse.json({
    data: { opinion: inserted, razonamiento: draft.razonamiento },
    error: null,
  })
}
