/**
 * V1 Polish Pack · Block 3 — human reclassification (training signal).
 *
 * Operator clicks the type pill on a classified doc → picks a new
 * type → PATCH hits this endpoint. We update the row, log an
 * `operational_decisions` row with the original type + confidence in
 * data_points_used so we can measure classifier accuracy over time.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { DOC_TYPES } from '@/lib/docs/vision-classifier'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BodySchema = z.object({
  documentId: z.string().min(1).max(128),
  newType: z.enum(DOC_TYPES),
})

interface DocRow {
  id: string
  company_id: string | null
  pedimento_id: string | null
  document_type: string | null
  document_type_confidence: number | null
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 }
    )
  }
  const companyId =
    session.role === 'client'
      ? session.companyId
      : request.cookies.get('company_id')?.value || session.companyId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 }
    )
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    )
  }

  const { data: docRaw, error: fetchError } = await supabase
    .from('expediente_documentos')
    .select('id, company_id, pedimento_id, document_type, document_type_confidence')
    .eq('id', parsed.data.documentId)
    .single()

  if (fetchError || !docRaw) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: fetchError?.message ?? 'Documento no existe' } },
      { status: 404 }
    )
  }
  const doc = docRaw as DocRow

  if (session.role === 'client' && doc.company_id && doc.company_id !== companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Cross-client access denied' } },
      { status: 403 }
    )
  }

  const originalType = doc.document_type
  const originalConfidence = doc.document_type_confidence

  const { error: updateError } = await supabase
    .from('expediente_documentos')
    .update({
      document_type: parsed.data.newType,
      document_type_confidence: 1, // human override = full confidence
    })
    .eq('id', doc.id)

  if (updateError) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: updateError.message } },
      { status: 500 }
    )
  }

  await logDecision({
    trafico: doc.pedimento_id ?? null,
    company_id: session.companyId,
    decision_type: 'doc_type_corrected',
    decision: parsed.data.newType,
    reasoning: `Operator reclassified from ${originalType ?? 'null'} (confidence ${originalConfidence ?? 'null'})`,
    dataPoints: {
      document_id: doc.id,
      original_type: originalType,
      original_confidence: originalConfidence,
      corrected_by: `${session.companyId}:${session.role}`,
    },
  })

  return NextResponse.json({
    data: { documentId: doc.id, type: parsed.data.newType },
    error: null,
  })
}
