/**
 * Mensajería · /api/mensajeria/threads
 * GET  — list threads visible to the caller (escalated pinned first for owners)
 * POST — create a new thread + first message
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createThread, listThreads } from '@/lib/mensajeria/threads'
import {
  isInternalRole,
  isMensajeriaEnabled,
  isOwnerRole,
} from '@/lib/mensajeria/constants'
import type { ThreadStatus, ThreadWithMeta } from '@/lib/mensajeria/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
    { status: 401 },
  )
}

function disabled() {
  return NextResponse.json(
    { data: null, error: { code: 'DISABLED', message: 'Mensajería no está activa' } },
    { status: 403 },
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

export async function GET(request: NextRequest) {
  if (!isMensajeriaEnabled()) return disabled()

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()

  // Phase 1: block client role entirely until flag flipped
  if (session.role === 'client' && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Mensajería no disponible' } },
      { status: 403 },
    )
  }

  const sp = request.nextUrl.searchParams
  const statusParam = sp.get('status')
  const status: ThreadStatus | 'all' | undefined =
    statusParam === 'open' || statusParam === 'escalated' || statusParam === 'resolved' || statusParam === 'all'
      ? statusParam
      : undefined

  const result = await listThreads({
    role: session.role,
    companyId: session.companyId,
    readerKey: readerKey(session.role, session.companyId),
    status,
    limit: 100,
  })
  if (result.error) {
    return NextResponse.json({ data: null, error: result.error }, { status: 500 })
  }

  // Owners see escalated threads pinned at top
  const threads = result.data ?? []
  const pinned = isOwnerRole(session.role)
    ? sortEscalatedFirst(threads)
    : threads

  return NextResponse.json({ data: pinned, error: null })
}

function sortEscalatedFirst(threads: ThreadWithMeta[]): ThreadWithMeta[] {
  const escalated: ThreadWithMeta[] = []
  const rest: ThreadWithMeta[] = []
  for (const t of threads) {
    if (t.status === 'escalated') escalated.push(t)
    else rest.push(t)
  }
  escalated.sort((a, b) => (b.escalated_at ?? '').localeCompare(a.escalated_at ?? ''))
  return [...escalated, ...rest]
}

export async function POST(request: NextRequest) {
  if (!isMensajeriaEnabled()) return disabled()

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()

  if (session.role === 'client' && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Mensajería no disponible' } },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { subject?: string; body?: string; trafico_id?: string | null; company_id?: string; internal_only?: boolean }
    | null
  if (!body) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION', message: 'Cuerpo inválido' } },
      { status: 400 },
    )
  }

  // Internal users may target any company; clients are locked to their own
  const targetCompanyId = isInternalRole(session.role)
    ? (body.company_id?.trim() || request.cookies.get('company_id')?.value || session.companyId)
    : session.companyId

  if (!targetCompanyId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION', message: 'Falta company_id' } },
      { status: 400 },
    )
  }

  const authorName = operatorName(request, session.role === 'client' ? 'Cliente' : 'Operador')

  const result = await createThread({
    companyId: targetCompanyId,
    subject: body.subject ?? '',
    role: session.role,
    authorName,
    firstMessageBody: body.body ?? '',
    traficoId: body.trafico_id ?? null,
    internalOnly: Boolean(body.internal_only),
  })
  if (result.error) {
    const statusCode = result.error.code === 'VALIDATION' ? 400 : 500
    return NextResponse.json({ data: null, error: result.error }, { status: statusCode })
  }
  return NextResponse.json({ data: result.data, error: null }, { status: 201 })
}
