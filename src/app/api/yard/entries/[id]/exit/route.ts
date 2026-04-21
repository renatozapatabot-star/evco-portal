/**
 * CRUZ · Block 14 — PATCH /api/yard/entries/[id]/exit
 *
 * Marks a yard entry as exited (sets exited_at = now()) and emits
 * `yard_exited` onto workflow_events. Tenant-scoped via verifySession.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { YARD_EXITED_EVENT, buildYardEvent } from '@/lib/yard-entries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status },
  )
}

interface YardEntryRow {
  id: string
  trafico_id: string
  company_id: string
  trailer_number: string
  yard_position: string
  refrigerated: boolean
  temperature_setting: number | null
  exited_at: string | null
}

function isInternalRole(role: string): boolean {
  return (
    role === 'broker' ||
    role === 'admin' ||
    role === 'operator' ||
    role === 'warehouse'
  )
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  }

  const { id } = await context.params
  if (!id || id.length < 8) {
    return errorResponse('VALIDATION_ERROR', 'ID inválido', 400)
  }

  const { data: entry, error: fetchErr } = await supabase
    .from('yard_entries')
    .select(
      'id, trafico_id, company_id, trailer_number, yard_position, refrigerated, temperature_setting, exited_at',
    )
    .eq('id', id)
    .maybeSingle<YardEntryRow>()

  if (fetchErr || !entry) {
    return errorResponse('NOT_FOUND', 'Entrada no encontrada', 404)
  }

  const internal = isInternalRole(session.role)
  if (!internal && entry.company_id !== session.companyId) {
    return errorResponse('FORBIDDEN', 'Sin acceso a la entrada', 403)
  }

  if (entry.exited_at) {
    return errorResponse('CONFLICT', 'Entrada ya registrada como salida', 409)
  }

  const nowIso = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('yard_entries')
    .update({ exited_at: nowIso })
    .eq('id', id)

  if (updErr) {
    return errorResponse('INTERNAL_ERROR', updErr.message, 500)
  }

  const actor = `${session.companyId}:${session.role}`

  await supabase.from('workflow_events').insert(
    buildYardEvent(entry.company_id, YARD_EXITED_EVENT, {
      trafico_id: entry.trafico_id,
      entry_id: entry.id,
      trailer_number: entry.trailer_number,
      yard_position: entry.yard_position,
      refrigerated: entry.refrigerated,
      temperature_setting: entry.temperature_setting,
      actor,
    }),
  )

  await logDecision({
    trafico: entry.trafico_id,
    company_id: entry.company_id,
    decision_type: YARD_EXITED_EVENT,
    decision: `caja ${entry.trailer_number} salió del patio (${entry.yard_position})`,
    reasoning: `Operador ${actor} marcó salida del patio.`,
    dataPoints: {
      entry_id: entry.id,
      trailer_number: entry.trailer_number,
      yard_position: entry.yard_position,
    },
  })

  return NextResponse.json({
    data: { entry_id: entry.id, exited_at: nowIso },
    error: null,
  })
}
