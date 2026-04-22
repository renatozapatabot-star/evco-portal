import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { commitAction } from '@/lib/aguila/actions'
import { logOperatorAction } from '@/lib/operator-actions'

/**
 * POST /api/cruz-ai/actions/commit — flip a proposed action to committed.
 *
 * Fired automatically by the CRUZ AI client UI when the 5-second
 * cancellation window elapses without the user clicking Cancel.
 * `committed` means the user has authorized the action; the actual
 * downstream side-effect (flag write, mensajeria send, OCA open) is
 * executed separately by an operator surface or follow-up cron.
 *
 * Tenant isolation: the action_id is looked up with an explicit
 * `company_id = session.companyId` filter. A forged id from another
 * tenant returns `not_found` (404) — never confirms the row exists.
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
  if (!actionId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'actionId requerido.' } },
      { status: 400 },
    )
  }

  const result = await commitAction(supabase, session.companyId, actionId)

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

  // Audit — only log the NEW commit (not idempotent repeats) to keep
  // the audit trail a faithful event log rather than a retry log.
  if (!result.already) {
    const operatorId = req.cookies.get('operator_id')?.value
    void logOperatorAction({
      operatorId,
      actionType: 'aguila_action_committed',
      companyId: session.companyId,
      targetTable: 'agent_actions',
      targetId: result.action.id,
      payload: { kind: result.action.kind, role: session.role },
    })
  }

  return NextResponse.json({
    data: {
      id: result.action.id,
      kind: result.action.kind,
      status: result.action.status,
      committed_at: result.action.committed_at,
      already: result.already,
      message_es: result.already
        ? 'Ya habíamos confirmado esta acción.'
        : 'Acción confirmada.',
    },
    error: null,
  })
}
