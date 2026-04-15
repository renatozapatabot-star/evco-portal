/**
 * Mensajería · /api/mensajeria/threads/[id]/messages
 * GET  — list messages in a thread (internal_only filtered for clients)
 * POST — append a message (30s undo window)
 *
 * Marks the thread as read for the caller on GET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import {
  createMessage,
  getThread,
  listMessages,
  markThreadRead,
} from '@/lib/mensajeria/threads'
import {
  isInternalRole,
  isMensajeriaEnabled,
} from '@/lib/mensajeria/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
    { status: 401 },
  )
}

function readerKey(role: string, companyId: string): string {
  return isInternalRole(role) ? `internal:${role}` : `client:${companyId}`
}

function operatorName(req: NextRequest, fallback: string): string {
  const cookieName = req.cookies.get('operator_name')?.value
  if (cookieName && cookieName.trim().length > 0) return cookieName.trim()
  return fallback
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json(
      { data: null, error: { code: 'DISABLED', message: 'Chat no está activo' } },
      { status: 403 },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()
  if (session.role === 'client' && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Chat no disponible' } },
      { status: 403 },
    )
  }

  const { id } = await ctx.params
  const threadRes = await getThread(id, session.role, session.companyId)
  if (threadRes.error) {
    const statusCode = threadRes.error.code === 'NOT_FOUND' ? 404 : 500
    return NextResponse.json({ data: null, error: threadRes.error }, { status: statusCode })
  }

  const msgs = await listMessages({
    threadId: id,
    role: session.role,
    companyId: session.companyId,
  })
  if (msgs.error) {
    return NextResponse.json({ data: null, error: msgs.error }, { status: 500 })
  }

  await markThreadRead(id, readerKey(session.role, session.companyId))

  return NextResponse.json({
    data: { thread: threadRes.data, messages: msgs.data ?? [] },
    error: null,
  })
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json(
      { data: null, error: { code: 'DISABLED', message: 'Chat no está activo' } },
      { status: 403 },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()
  if (session.role === 'client' && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Chat no disponible' } },
      { status: 403 },
    )
  }

  const { id } = await ctx.params
  const body = (await request.json().catch(() => null)) as
    | { body?: string; internal_only?: boolean }
    | null
  if (!body) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION', message: 'Cuerpo inválido' } },
      { status: 400 },
    )
  }

  // Confirm caller can see this thread before appending
  const threadRes = await getThread(id, session.role, session.companyId)
  if (threadRes.error) {
    const statusCode = threadRes.error.code === 'NOT_FOUND' ? 404 : 500
    return NextResponse.json({ data: null, error: threadRes.error }, { status: statusCode })
  }

  const authorName = operatorName(request, session.role === 'client' ? 'Cliente' : 'Operador')

  // Clients cannot write internal_only messages
  const internalOnly = isInternalRole(session.role) ? Boolean(body.internal_only) : false

  const result = await createMessage({
    threadId: id,
    role: session.role,
    authorName,
    body: body.body ?? '',
    internalOnly,
  })
  if (result.error) {
    const statusCode = result.error.code === 'VALIDATION' ? 400 : 500
    return NextResponse.json({ data: null, error: result.error }, { status: statusCode })
  }
  return NextResponse.json({ data: result.data, error: null }, { status: 201 })
}
