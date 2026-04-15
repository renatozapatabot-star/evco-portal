/**
 * ZAPATA AI · Block 11 — POST /api/pece/create-intent
 *
 * Validates pedimento ownership, inserts a pece_payments row with
 * status='intent', fires the `pece_payment_intent` workflow_event.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { CreatePeceIntentSchema, PECE_INTENT_CREATED_EVENT } from '@/lib/pece-payments'
import { getBankByCode } from '@/lib/mexican-banks'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface PedimentoOwnership {
  id: string
  trafico_id: string
  company_id: string
  pedimento_number: string | null
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }

  const parsed = CreatePeceIntentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        },
      },
      { status: 400 },
    )
  }

  const { pedimento_id, bank_code, amount, reference, trafico_id } = parsed.data

  if (!getBankByCode(bank_code)) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Banco no reconocido' },
      },
      { status: 400 },
    )
  }

  const { data: ped, error: pedErr } = await supabase
    .from('pedimentos')
    .select('id, trafico_id, company_id, pedimento_number')
    .eq('id', pedimento_id)
    .maybeSingle<PedimentoOwnership>()

  if (pedErr || !ped) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Pedimento no encontrado' } },
      { status: 404 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal && ped.company_id !== session.companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso al pedimento' } },
      { status: 403 },
    )
  }

  const actor = `${session.companyId}:${session.role}`

  const { data: inserted, error: insErr } = await supabase
    .from('pece_payments')
    .insert({
      pedimento_id,
      trafico_id: trafico_id ?? ped.trafico_id,
      company_id: ped.company_id,
      bank_code,
      amount,
      reference,
      status: 'intent',
      created_by: actor,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: insErr?.message ?? 'No se pudo registrar intento',
        },
      },
      { status: 500 },
    )
  }

  await supabase.from('workflow_events').insert({
    workflow: 'pedimento',
    event_type: PECE_INTENT_CREATED_EVENT,
    trigger_id: ped.trafico_id,
    company_id: ped.company_id,
    payload: {
      pedimento_id,
      pece_payment_id: inserted.id,
      bank_code,
      amount,
      reference,
      actor,
    },
  })

  await logDecision({
    trafico: ped.trafico_id,
    company_id: ped.company_id,
    decision_type: 'pece_payment_intent',
    decision: `intento de pago PECE registrado (banco ${bank_code})`,
    reasoning: `Operador ${actor} registró intento por ${amount} MXN, ref ${reference}`,
    dataPoints: {
      pedimento_id,
      pece_payment_id: inserted.id,
      bank_code,
      amount,
      reference,
    },
  })

  return NextResponse.json({
    data: { payment_id: inserted.id, status: 'intent' },
    error: null,
  })
}
