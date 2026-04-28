import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  getActionAdmin,
  markExecuted,
  markExecuteFailed,
} from '@/lib/aguila/actions'
import { runExecutor, type ExecutorContext } from '@/lib/aguila/action-executor'
import { logOperatorAction } from '@/lib/operator-actions'

/**
 * POST /api/cruz-ai/actions/execute — run the downstream side-effect
 * for a committed action and flip it to `executed` (or `execute_failed`).
 *
 * Gate: operator / admin / broker only. Clients and warehouse/etc.
 * never reach this endpoint — this is the internal queue surface.
 *
 * Lifecycle:
 *   committed → executor → executed          (on success)
 *   committed → executor → execute_failed    (on error; retryable)
 *   execute_failed → executor → executed     (retry succeeded)
 *
 * Idempotency: re-executing an already-executed row returns 200 with
 * `already: true`. Running on a proposed/cancelled row returns 409
 * (invalid_transition).
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['operator', 'admin', 'broker'])

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión no válida.' } },
      { status: 401 },
    )
  }
  if (!INTERNAL_ROLES.has(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Acceso restringido al equipo interno.' } },
      { status: 403 },
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

  const row = await getActionAdmin(supabase, actionId)
  if (!row) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Acción no encontrada.' } },
      { status: 404 },
    )
  }

  if (row.status === 'executed') {
    return NextResponse.json({
      data: {
        id: row.id,
        status: row.status,
        already: true,
        message_es: 'Esta acción ya fue ejecutada.',
        executed_at: row.executed_at ?? null,
        execute_result: row.execute_result ?? null,
      },
      error: null,
    })
  }

  if (row.status !== 'committed' && row.status !== 'execute_failed') {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INVALID_TRANSITION',
          message:
            row.status === 'proposed'
              ? 'Falta confirmar la acción antes de ejecutarla.'
              : row.status === 'cancelled'
                ? 'Esta acción fue cancelada y no puede ejecutarse.'
                : `Estado no válido para ejecución: ${row.status}.`,
        },
      },
      { status: 409 },
    )
  }

  const operatorId = req.cookies.get('operator_id')?.value ?? null
  const executorCtx: ExecutorContext = {
    supabase,
    executorId: operatorId,
    executorRole: session.role as 'operator' | 'admin' | 'broker',
  }

  const outcome = await runExecutor(row, executorCtx)

  if (!outcome.ok) {
    const failed = await markExecuteFailed(supabase, actionId, {
      executorId: operatorId,
      executorRole: session.role,
      errorEs: outcome.errorEs,
    })
    void logOperatorAction({
      operatorId: operatorId ?? undefined,
      actionType: 'aguila_action_execute_failed',
      companyId: row.company_id,
      targetTable: 'agent_actions',
      targetId: row.id,
      payload: { kind: row.kind, error_es: outcome.errorEs, role: session.role },
    })
    const status =
      !failed.ok && failed.error === 'not_found'
        ? 404
        : !failed.ok && failed.error === 'invalid_transition'
          ? 409
          : 500
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'EXECUTE_FAILED',
          message: outcome.errorEs,
        },
      },
      { status },
    )
  }

  const updated = await markExecuted(supabase, actionId, {
    executorId: operatorId,
    executorRole: session.role,
    result: outcome.result,
  })

  if (!updated.ok) {
    // Downstream side-effect already ran — this is a bookkeeping
    // failure, not a downstream failure. Log and surface 500 so the
    // operator can report it rather than silently believing it worked.
    void logOperatorAction({
      operatorId: operatorId ?? undefined,
      actionType: 'aguila_action_mark_executed_failed',
      companyId: row.company_id,
      targetTable: 'agent_actions',
      targetId: row.id,
      payload: { kind: row.kind, detail: updated.detail ?? null, role: session.role },
    })
    return NextResponse.json(
      {
        data: null,
        error: {
          code: updated.error.toUpperCase(),
          message: updated.detail ?? 'No se pudo registrar la ejecución.',
        },
      },
      { status: updated.error === 'not_found' ? 404 : updated.error === 'invalid_transition' ? 409 : 500 },
    )
  }

  if (!updated.already) {
    void logOperatorAction({
      operatorId: operatorId ?? undefined,
      actionType: 'aguila_action_executed',
      companyId: row.company_id,
      targetTable: 'agent_actions',
      targetId: row.id,
      payload: {
        kind: row.kind,
        result: outcome.result,
        role: session.role,
      },
    })
  }

  return NextResponse.json({
    data: {
      id: updated.action.id,
      kind: updated.action.kind,
      status: updated.action.status,
      executed_at: updated.action.executed_at ?? null,
      execute_result: updated.action.execute_result ?? null,
      already: updated.already,
      message_es: updated.already
        ? 'Esta acción ya fue ejecutada.'
        : 'Acción ejecutada.',
    },
    error: null,
  })
}
