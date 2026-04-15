/**
 * ZAPATA AI V1.5 · F14 — /api/vision/classify
 *
 * Server-side entry point for document auto-classification. Callers
 * POST a fileUrl (from the `expedientes` bucket) and optionally the id
 * of the expediente doc or invoice-bank row to cross-link.
 *
 * Returns the parsed extraction + classification row id, or a
 * structured error when vision is not configured / file unreadable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { classifyDocumentWithVision } from '@/lib/vision/classify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  fileUrl: z.string().url().max(2048),
  linkToExpedienteDocId: z.string().uuid().nullish(),
  linkToInvoiceBankId: z.string().uuid().nullish(),
})

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)

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

  const result = await classifyDocumentWithVision({
    fileUrl: parsed.data.fileUrl,
    companyId,
    linkToExpedienteDocId: parsed.data.linkToExpedienteDocId ?? null,
    linkToInvoiceBankId: parsed.data.linkToInvoiceBankId ?? null,
    actor: `${session.companyId}:${session.role}`,
  })

  if (result.notConfigured) {
    return NextResponse.json({
      data: { id: null, extraction: null, notConfigured: true },
      error: { code: 'VISION_NOT_CONFIGURED', message: 'Clasificación automática no disponible' },
    })
  }

  return NextResponse.json({
    data: {
      id: result.id,
      extraction: result.extraction,
      error: result.error,
      notConfigured: false,
    },
    error: null,
  })
}
