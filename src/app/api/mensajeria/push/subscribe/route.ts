/**
 * Mensajería · POST /api/mensajeria/push/subscribe
 *
 * Client-side OneSignal player id registration. Auth required. Associates
 * the player id with the caller's user_key (internal:role or client:company)
 * so sendPush() can resolve recipients by role/company without ever exposing
 * player ids to the tenant surface.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { registerPlayerId, revokePlayerId } from '@/lib/mensajeria/push'
import { isInternalRole, isMensajeriaEnabled } from '@/lib/mensajeria/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
    { status: 401 },
  )
}

function userKeyFor(role: string, companyId: string): string {
  return isInternalRole(role) ? `internal:${role}` : `client:${companyId}`
}

export async function POST(request: NextRequest) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json(
      { data: null, error: { code: 'DISABLED', message: 'Chat no está activo' } },
      { status: 403 },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()

  const body = (await request.json().catch(() => null)) as
    | { player_id?: string; platform?: string }
    | null
  if (!body?.player_id || typeof body.player_id !== 'string') {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'player_id requerido' } },
      { status: 400 },
    )
  }

  const platform: 'web' | 'ios' | 'android' =
    body.platform === 'ios' || body.platform === 'android' ? body.platform : 'web'

  const result = await registerPlayerId({
    userKey: userKeyFor(session.role, session.companyId),
    playerId: body.player_id.trim(),
    platform,
    userAgent: request.headers.get('user-agent') ?? undefined,
  })
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: result.error ?? 'registration failed' } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data: { ok: true }, error: null })
}

export async function DELETE(request: NextRequest) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json(
      { data: null, error: { code: 'DISABLED', message: 'Chat no está activo' } },
      { status: 403 },
    )
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return unauthorized()

  const playerId = request.nextUrl.searchParams.get('player_id')
  if (!playerId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'player_id requerido' } },
      { status: 400 },
    )
  }

  await revokePlayerId(userKeyFor(session.role, session.companyId), playerId)
  return NextResponse.json({ data: { ok: true }, error: null })
}
