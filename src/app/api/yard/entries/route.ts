/**
 * CRUZ · Block 14 — /api/yard/entries
 *
 * GET: list active yard entries (exited_at IS NULL) for the session company.
 * POST: register a new yard entry.
 *
 * Tenant-scoped via verifySession. Emits `yard_entered` on workflow_events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  RegisterYardEntrySchema,
  YARD_ENTERED_EVENT,
  buildYardEvent,
} from '@/lib/yard-entries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface TraficoOwnership {
  trafico_id: string
  company_id: string | null
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status },
  )
}

function isInternalRole(role: string): boolean {
  return (
    role === 'broker' ||
    role === 'admin' ||
    role === 'operator' ||
    role === 'warehouse'
  )
}

export async function GET(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  }

  const internal = isInternalRole(session.role)

  let query = supabase
    .from('yard_entries')
    .select(
      'id, trafico_id, company_id, trailer_number, yard_position, refrigerated, temperature_setting, entered_at, exited_at, created_by',
    )
    .is('exited_at', null)
    .order('entered_at', { ascending: true })
    .limit(100)

  if (!internal) {
    query = query.eq('company_id', session.companyId)
  }

  const { data, error } = await query
  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500)
  }

  return NextResponse.json({
    data: { entries: data ?? [] },
    error: null,
  })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Cuerpo inválido', 400)
  }

  const parsed = RegisterYardEntrySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400,
    )
  }

  const { trafico_id, trailer_number, yard_position, refrigerated, temperature_setting } =
    parsed.data

  // Tenant check — trafico must exist; only session company (unless internal).
  const { data: trafico, error: trErr } = await supabase
    .from('traficos')
    .select('trafico_id, company_id')
    .eq('trafico_id', trafico_id)
    .maybeSingle<TraficoOwnership>()

  if (trErr || !trafico) {
    return errorResponse('NOT_FOUND', 'Embarque no encontrado', 404)
  }

  const internal = isInternalRole(session.role)
  const traficoCompanyId = trafico.company_id ?? session.companyId

  if (!internal && traficoCompanyId !== session.companyId) {
    return errorResponse('FORBIDDEN', 'Sin acceso al embarque', 403)
  }

  // Prevent collision — position already occupied (active entry).
  const { data: collision } = await supabase
    .from('yard_entries')
    .select('id')
    .eq('company_id', traficoCompanyId)
    .eq('yard_position', yard_position)
    .is('exited_at', null)
    .maybeSingle()

  if (collision) {
    return errorResponse(
      'CONFLICT',
      `Posición ${yard_position} ocupada`,
      409,
    )
  }

  const actor = `${session.companyId}:${session.role}`

  const { data: inserted, error: insErr } = await supabase
    .from('yard_entries')
    .insert({
      trafico_id,
      company_id: traficoCompanyId,
      trailer_number,
      yard_position,
      refrigerated,
      temperature_setting,
      created_by: actor,
    })
    .select('id, entered_at')
    .single()

  if (insErr || !inserted) {
    return errorResponse(
      'INTERNAL_ERROR',
      insErr?.message ?? 'No se pudo registrar entrada',
      500,
    )
  }

  await supabase.from('workflow_events').insert(
    buildYardEvent(traficoCompanyId, YARD_ENTERED_EVENT, {
      trafico_id,
      entry_id: inserted.id,
      trailer_number,
      yard_position,
      refrigerated,
      temperature_setting,
      actor,
    }),
  )

  await logDecision({
    trafico: trafico_id,
    company_id: traficoCompanyId,
    decision_type: YARD_ENTERED_EVENT,
    decision: `caja ${trailer_number} estacionada en ${yard_position}`,
    reasoning: `Operador ${actor} registró entrada a patio${refrigerated ? ` (refrigerada ${temperature_setting}°C)` : ''}.`,
    dataPoints: {
      entry_id: inserted.id,
      trailer_number,
      yard_position,
      refrigerated,
      temperature_setting,
    },
  })

  return NextResponse.json({
    data: {
      entry_id: inserted.id,
      entered_at: inserted.entered_at,
      yard_position,
    },
    error: null,
  })
}
