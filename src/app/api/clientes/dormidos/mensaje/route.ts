/**
 * ZAPATA AI · V1.5 F7 — POST /api/clientes/dormidos/mensaje
 *
 * Given a `clienteId`, re-detect its dormant state (single-company) and return
 * a generated Spanish follow-up message. Emits `dormant_message_generated`
 * via workflow_events. Proposes only — humans authorize before anything ships.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { detectDormantClients, generateFollowUpMessage } from '@/lib/dormant/detect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['admin', 'broker'])

const BodySchema = z.object({
  clienteId: z.string().min(1).max(120),
  thresholdDays: z.number().int().optional(),
})

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para generar mensajes', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Cuerpo JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', 'clienteId requerido', 400)
  }

  const { clienteId, thresholdDays } = parsed.data

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const matches = await detectDormantClients(sb, clienteId, thresholdDays ?? 14)
  const target = matches[0]
  if (!target) {
    return errorResponse('NOT_FOUND', 'El cliente no está dormido o no existe', 404)
  }

  const { subject, message } = generateFollowUpMessage(target)

  await sb.from('workflow_events').insert({
    workflow: 'post_op',
    event_type: 'dormant_message_generated',
    status: 'completed',
    trigger_id: target.clienteId,
    company_id: session.companyId,
    payload: {
      cliente_id: target.clienteId,
      cliente_name: target.clienteName,
      dias_sin_movimiento: target.diasSinMovimiento,
      generated_by: session.role,
    },
  })

  return NextResponse.json({
    data: { subject, message, cliente: target },
    error: null,
  })
}
