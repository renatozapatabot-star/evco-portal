/**
 * AGUILA · V1.5 F3 — POST /api/contabilidad/checklist/[id]/toggle
 *
 * Flips a single monthly-close checklist item. Scoped by session.companyId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { toggleChecklistItem } from '@/lib/contabilidad/close'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['contabilidad', 'admin', 'broker'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso', 403)
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-f-]{10,}$/i.test(id)) {
    return errorResponse('VALIDATION_ERROR', 'ID inválido', 400)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const updated = await toggleChecklistItem(supabase, id, session.companyId, null)
  if (!updated) return errorResponse('NOT_FOUND', 'Elemento no encontrado', 404)

  return NextResponse.json({ data: updated, error: null })
}
