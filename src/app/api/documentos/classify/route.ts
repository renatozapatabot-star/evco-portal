/**
 * Self-service classify endpoint used by /documentos/auto.
 *
 * Input:  { documentId }
 * Output: { type, confidence, status, issues, linked_trafico_id, supplier, amount, currency }
 *
 * Flow:
 *  1. Load the expediente_documentos row (tenant-guarded).
 *  2. Run classifyDocumentWithVision — handles PDF + image, extracts
 *     supplier / invoice / fraccion / line items.
 *  3. runCompleteness() → green / amber / red.
 *  4. findPedimentoReference() → if a DD AD PPPP SSSSSSS appears in the
 *     extraction AND it matches a trafico owned by this company, link
 *     the doc back to that trafico by writing pedimento_id.
 *  5. Persist a normalized doc_type + confidence on the row so the
 *     existing expediente views pick it up.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { classifyDocumentWithVision, type VisionDocType } from '@/lib/vision/classify'
import {
  runCompleteness,
  labelForDocType,
  findPedimentoReference,
  type DocumentoStatus,
} from '@/lib/docs/completeness'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  documentId: z.string().min(1).max(128),
})

interface DocRow {
  id: string
  company_id: string | null
  pedimento_id: string | null
  file_name: string | null
  file_url: string | null
}

// Map Claude's vision-classifier type vocabulary to the legacy doc_type
// strings already used elsewhere in the system (expediente checklists,
// solicitud flows, etc.). Keeping one vocabulary stops drift.
function legacyDocType(t: VisionDocType | null): string {
  switch (t) {
    case 'invoice':
      return 'factura_comercial'
    case 'packing_list':
      return 'packing_list'
    case 'certificate_of_origin':
      return 'certificado_origen'
    case 'bol':
      return 'bill_of_lading'
    case 'other':
      return 'otro'
    default:
      return 'pending_manual'
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
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
      { status: 400 },
    )
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const { data: docRaw, error: fetchError } = await supabase
    .from('expediente_documentos')
    .select('id, company_id, pedimento_id, file_name, file_url')
    .eq('id', parsed.data.documentId)
    .single()

  if (fetchError || !docRaw) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: fetchError?.message ?? 'Documento no existe' } },
      { status: 404 },
    )
  }
  const doc = docRaw as DocRow

  if (session.role === 'client' && doc.company_id && doc.company_id !== companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Acceso cruzado denegado' } },
      { status: 403 },
    )
  }

  if (!doc.file_url) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Documento sin URL de archivo' } },
      { status: 400 },
    )
  }

  const visionResult = await classifyDocumentWithVision({
    fileUrl: doc.file_url,
    companyId: companyId,
    linkToExpedienteDocId: doc.id,
    actor: session.role,
  })

  if (visionResult.notConfigured) {
    return NextResponse.json({
      data: {
        documentId: doc.id,
        status: 'review' satisfies DocumentoStatus,
        type: 'pending_manual',
        type_label: 'Clasificación manual requerida',
        confidence: null,
        issues: ['Clasificación automática no configurada — revisión manual'],
        linked_trafico_id: null,
        supplier: null,
        amount: null,
        currency: null,
      },
      error: null,
    })
  }

  if (!visionResult.extraction || visionResult.error) {
    await supabase
      .from('expediente_documentos')
      .update({ document_type: 'pending_manual', document_type_confidence: null })
      .eq('id', doc.id)

    return NextResponse.json({
      data: {
        documentId: doc.id,
        status: 'missing' satisfies DocumentoStatus,
        type: 'pending_manual',
        type_label: 'No reconocido',
        confidence: null,
        issues: [visionResult.error === 'unsupported_media'
          ? 'Tipo de archivo no soportado'
          : 'No fue posible analizar el documento'],
        linked_trafico_id: null,
        supplier: null,
        amount: null,
        currency: null,
      },
      error: null,
    })
  }

  const extraction = visionResult.extraction
  const completeness = runCompleteness(extraction)

  // Pedimento linkage — only if the referenced pedimento belongs to the
  // same company. Cross-company linking is a tenant breach; refuse it.
  let linkedTraficoId: string | null = null
  const pedRef = findPedimentoReference(extraction)
  if (pedRef) {
    const { data: trafico } = await supabase
      .from('traficos')
      .select('trafico')
      .eq('pedimento', pedRef)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()
    if (trafico) {
      linkedTraficoId = pedRef
    }
  }

  const legacyType = legacyDocType(extraction.doc_type)

  const { error: updateError } = await supabase
    .from('expediente_documentos')
    .update({
      document_type: legacyType,
      doc_type: legacyType,
      document_type_confidence: null,
      pedimento_id: linkedTraficoId ?? doc.pedimento_id ?? null,
    })
    .eq('id', doc.id)

  if (updateError) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: updateError.message } },
      { status: 500 },
    )
  }

  await logDecision({
    trafico: linkedTraficoId,
    company_id: companyId,
    decision_type: 'doc_autoclassified',
    decision: legacyType,
    reasoning: `auto-classify status=${completeness.status} issues=${completeness.issues.length}`,
    dataPoints: {
      document_id: doc.id,
      doc_type: extraction.doc_type,
      supplier: extraction.supplier,
      amount: extraction.amount,
      currency: extraction.currency,
      line_items: extraction.line_items.length,
      linked_trafico_id: linkedTraficoId,
      status: completeness.status,
      issues: completeness.issues,
      role: session.role,
    },
  })

  return NextResponse.json({
    data: {
      documentId: doc.id,
      status: completeness.status,
      type: legacyType,
      type_label: labelForDocType(extraction.doc_type),
      confidence: null,
      issues: completeness.issues,
      linked_trafico_id: linkedTraficoId,
      supplier: extraction.supplier,
      amount: extraction.amount,
      currency: extraction.currency,
    },
    error: null,
  })
}
