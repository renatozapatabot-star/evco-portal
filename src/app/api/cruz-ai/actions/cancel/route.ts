import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { cancelAction } from '@/lib/aguila/actions'
import { logOperatorAction } from '@/lib/operator-actions'

/**
 * POST /api/cruz-ai/actions/cancel — flip a proposed action to cancelled.
 *
 * Fired by the CRUZ AI client UI when the user clicks Cancel inside
 * the 5-second window. Idempotent: cancelling an already-cancelled
 * action returns 200 with `already: true`. Cannot cancel a committed
 * action (409 `invalid_transition`).
 *
 * Tenant isolation: same contract as the commit route — forged id
 * from another tenant returns 404.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' } },
      { status: 401 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const actionId = typeof body.actionId === 'string' ? body.actionId.trim() : ''
  const reasonEs = typeof body.reasonEs === 'string' ? body.reasonEs.trim().slice(0, 280) : undefined
  if (!actionId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'actionId requerido.' } },
      { status: 400 },
    )
  }

  const result = await cancelAction(supabase, session.companyId, actionId, reasonEs)

  if (!result.ok) {
    const status =
      result.error === 'not_found' ? 404 :
      result.error === 'invalid_transition' ? 409 :
      500
    return NextResponse.json(
      { data: null, error: { code: result.error.toUpperCase(), message: result.detail ?? result.error } },
      { status },
    )
  }

  if (!result.already) {
    const operatorId = req.cookies.get('operator_id')?.value
    void logOperatorAction({
      operatorId,
      actionType: 'aguila_action_cancelled',
      companyId: session.companyId,
      targetTable: 'agent_actions',
      targetId: result.action.id,
      payload: { kind: result.action.kind, reason_es: reasonEs ?? null, role: session.role },
    })
  }

  return NextResponse.json({
    data: {
      id: result.action.id,
      kind: result.action.kind,
      status: result.action.status,
      cancelled_at: result.action.cancelled_at,
      already: result.already,
      message_es: result.already
        ? 'Ya habíamos cancelado esta acción.'
        : 'Acción cancelada.',
    },
    error: null,
  })
}
