/**
 * V1 Polish Pack · Block 3 — classify endpoint.
 *
 * Takes { documentId }, pulls the row + file bytes from Supabase
 * Storage, calls the vision classifier, PATCHes `document_type` and
 * `document_type_confidence`, and logs the decision.
 *
 * Fail-fast contract: if Anthropic errors OR the file is a PDF we
 * can't vision-classify, we stamp `document_type='pending_manual'`
 * and return a 200 with `needsManual: true` so the uploader shows a
 * red toast. No silent success — the row is still updated so the
 * operator sees it in the checklist.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { classifyDocumentImage } from '@/lib/docs/vision-classifier'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
  doc_type: string | null
  document_type: string | null
}

async function markPendingManual(
  docId: string,
  reason: string,
  session: { companyId: string; role: string },
  traficoId: string | null
): Promise<void> {
  await supabase
    .from('expediente_documentos')
    .update({
      document_type: 'pending_manual',
      document_type_confidence: null,
    })
    .eq('id', docId)

  await logDecision({
    trafico: traficoId,
    company_id: session.companyId,
    decision_type: 'doc_classify_failed',
    decision: 'pending_manual',
    reasoning: reason,
    dataPoints: { document_id: docId, role: session.role },
  })
}

function guessMediaTypeFromName(fileName: string | null): string | null {
  if (!fileName) return null
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return null
}

function deriveStoragePathFromPublicUrl(url: string): string | null {
  // Public URL shape: <origin>/storage/v1/object/public/expedientes/<path>
  const idx = url.indexOf('/expedientes/')
  if (idx < 0) return null
  return url.slice(idx + '/expedientes/'.length)
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
    .select('id, company_id, pedimento_id, file_name, file_url, doc_type, document_type')
    .eq('id', parsed.data.documentId)
    .single()

  if (fetchError || !docRaw) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: fetchError?.message ?? 'Documento no existe' } },
      { status: 404 }
    )
  }
  const doc = docRaw as DocRow

  // Tenant guard — clients only touch their own docs.
  if (session.role === 'client' && doc.company_id && doc.company_id !== companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Cross-client access denied' } },
      { status: 403 }
    )
  }

  const traficoId = doc.pedimento_id ?? null
  const mediaType = guessMediaTypeFromName(doc.file_name)

  // PDFs aren't supported by the current vision path — flag manual.
  if (mediaType === 'application/pdf' || !mediaType) {
    await markPendingManual(
      doc.id,
      mediaType === 'application/pdf'
        ? 'PDF — clasificación por visión aún no soportada'
        : 'Tipo de archivo desconocido',
      session,
      traficoId
    )
    return NextResponse.json({
      data: { documentId: doc.id, needsManual: true, type: 'pending_manual', confidence: null },
      error: null,
    })
  }

  // Download from storage. Prefer storage-api download over fetching the public URL.
  let imageBytes: Uint8Array | null = null
  const storagePath = doc.file_url ? deriveStoragePathFromPublicUrl(doc.file_url) : null
  if (storagePath) {
    const { data: blob, error: dlError } = await supabase.storage
      .from('expedientes')
      .download(storagePath)
    if (!dlError && blob) {
      imageBytes = new Uint8Array(await blob.arrayBuffer())
    }
  }
  if (!imageBytes && doc.file_url) {
    try {
      const res = await fetch(doc.file_url)
      if (res.ok) imageBytes = new Uint8Array(await res.arrayBuffer())
    } catch {
      imageBytes = null
    }
  }

  if (!imageBytes) {
    await markPendingManual(doc.id, 'No se pudo descargar el archivo para clasificación', session, traficoId)
    return NextResponse.json({
      data: { documentId: doc.id, needsManual: true, type: 'pending_manual', confidence: null },
      error: null,
    })
  }

  const base64Image = Buffer.from(imageBytes).toString('base64')

  try {
    const result = await classifyDocumentImage({
      base64Image,
      mediaType,
      callerName: 'api.docs.classify',
    })

    const { error: updateError } = await supabase
      .from('expediente_documentos')
      .update({
        document_type: result.type,
        document_type_confidence: result.confidence,
      })
      .eq('id', doc.id)

    if (updateError) {
      await markPendingManual(doc.id, `Update failed: ${updateError.message}`, session, traficoId)
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    await logDecision({
      trafico: traficoId,
      company_id: session.companyId,
      decision_type: 'doc_autoclassified',
      decision: result.type,
      reasoning: `vision=${result.model} confidence=${result.confidence.toFixed(2)}`,
      dataPoints: {
        document_id: doc.id,
        confidence: result.confidence,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        role: session.role,
      },
    })

    return NextResponse.json({
      data: {
        documentId: doc.id,
        needsManual: false,
        type: result.type,
        confidence: result.confidence,
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision error'
    await markPendingManual(doc.id, `Anthropic error: ${message}`, session, traficoId)
    return NextResponse.json({
      data: { documentId: doc.id, needsManual: true, type: 'pending_manual', confidence: null },
      error: null,
    })
  }
}
