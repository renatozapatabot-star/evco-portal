/**
 * Mensajería · escalate a thread to owner review.
 * POST /api/mensajeria/threads/[id]/escalate
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { escalateThread } from '@/lib/mensajeria/threads'
import { isInternalRole, isMensajeriaEnabled } from '@/lib/mensajeria/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json(
      { data: null, error: { code: 'DISABLED', message: 'Mensajería no está activa' } },
      { status: 403 },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  if (!isInternalRole(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Solo operadores o dirección pueden escalar' } },
      { status: 403 },
    )
  }

  const { id } = await ctx.params
  const body = (await request.json().catch(() => null)) as { summary?: string } | null
  const authorName = request.cookies.get('operator_name')?.value?.trim() || 'Operador'

  const result = await escalateThread({
    threadId: id,
    role: session.role,
    authorName,
    summary: body?.summary,
  })
  if (result.error) {
    const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 500
    return NextResponse.json({ data: null, error: result.error }, { status: statusCode })
  }
  return NextResponse.json({ data: result.data, error: null })
}
