/**
 * ZAPATA AI · Block 11 — POST /api/pece/confirm
 *
 * Transitions a pece_payments row along intent → submitted → confirmed
 * (or → rejected). Fires `pece_payment_confirmed` on final confirmation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  ConfirmPecePaymentSchema,
  transitionPecePayment,
  type PecePaymentStatus,
} from '@/lib/pece-payments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface PaymentRow {
  id: string
  pedimento_id: string
  trafico_id: string | null
  company_id: string
  status: PecePaymentStatus
  bank_code: string
  amount: number
  reference: string
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

  const parsed = ConfirmPecePaymentSchema.safeParse(body)
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

  const { payment_id, action, confirmation_number } = parsed.data

  const { data: row, error: loadErr } = await supabase
    .from('pece_payments')
    .select('id, pedimento_id, trafico_id, company_id, status, bank_code, amount, reference')
    .eq('id', payment_id)
    .maybeSingle<PaymentRow>()

  if (loadErr || !row) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Pago no encontrado' } },
      { status: 404 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal && row.company_id !== session.companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso al pago' } },
      { status: 403 },
    )
  }

  const result = transitionPecePayment({
    from: row.status,
    action,
    confirmationNumber: confirmation_number,
  })
  if (result.error) {
    return NextResponse.json(
      { data: null, error: { code: result.error.code, message: result.error.message } },
      { status: 400 },
    )
  }

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = { status: result.to }
  if (result.to === 'submitted') update.submitted_at = nowIso
  if (result.to === 'confirmed') {
    update.confirmed_at = nowIso
    update.confirmation_number = confirmation_number
  }

  const { error: updErr } = await supabase
    .from('pece_payments')
    .update(update)
    .eq('id', payment_id)

  if (updErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: updErr.message } },
      { status: 500 },
    )
  }

  const actor = `${session.companyId}:${session.role}`

  if (result.to === 'confirmed' && row.trafico_id) {
    await supabase.from('workflow_events').insert({
      workflow: 'pedimento',
      event_type: 'pece_payment_confirmed',
      trigger_id: row.trafico_id,
      company_id: row.company_id,
      payload: {
        pedimento_id: row.pedimento_id,
        pece_payment_id: row.id,
        bank_code: row.bank_code,
        amount: row.amount,
        confirmation_number,
        actor,
      },
    })

    // V1.5 F12 — Telegram routing (fire-and-forget).
    const { dispatchTelegramForEvent } = await import('@/lib/telegram/dispatch')
    void dispatchTelegramForEvent('pece_payment_confirmed', {
      trafico_id: row.trafico_id,
      company_id: row.company_id,
      pedimento_number: row.pedimento_id,
      amount: row.amount,
      currency: 'MXN',
      bank_name: row.bank_code,
      actor,
    })

    await logDecision({
      trafico: row.trafico_id,
      company_id: row.company_id,
      decision_type: 'pece_payment_confirmed',
      decision: `pago PECE confirmado (folio ${confirmation_number})`,
      reasoning: `Operador ${actor} confirmó pago por ${row.amount} MXN en banco ${row.bank_code}`,
      dataPoints: {
        pedimento_id: row.pedimento_id,
        pece_payment_id: row.id,
        bank_code: row.bank_code,
        amount: row.amount,
        confirmation_number,
      },
    })
  }

  return NextResponse.json({
    data: { payment_id: row.id, status: result.to },
    error: null,
  })
}
