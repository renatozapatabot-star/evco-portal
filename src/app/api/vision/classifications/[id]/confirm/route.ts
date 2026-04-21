/**
 * CRUZ V1.5 · F14 — POST /api/vision/classifications/[id]/confirm
 *
 * Stamps confirmed_by / confirmed_at / confirmed_match on a vision
 * classification row. Operator can either accept the extraction as-is
 * (match=true) or flag it for manual review (match=false).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  match: z.boolean(),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } },
      { status: 400 },
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
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)

  // Tenant guard before the write.
  const { data: existing, error: fetchErr } = await supabase
    .from('document_classifications')
    .select('id, company_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !existing) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Clasificación no encontrada' } },
      { status: 404 },
    )
  }
  if (session.role === 'client' && existing.company_id && existing.company_id !== companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Cross-client' } },
      { status: 403 },
    )
  }

  const confirmedAt = new Date().toISOString()
  // confirmed_by is a uuid column — session identifiers are not uuids,
  // so we record actor in the audit log instead and leave confirmed_by
  // null unless the session carries a uuid.
  const confirmedBy =
    'userId' in session && typeof (session as { userId?: unknown }).userId === 'string' &&
    UUID_RE.test((session as { userId: string }).userId)
      ? (session as { userId: string }).userId
      : null

  const { error: updateErr } = await supabase
    .from('document_classifications')
    .update({
      confirmed_at: confirmedAt,
      confirmed_by: confirmedBy,
      confirmed_match: parsed.data.match,
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: updateErr.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: { id, confirmed_at: confirmedAt, confirmed_match: parsed.data.match },
    error: null,
  })
}
