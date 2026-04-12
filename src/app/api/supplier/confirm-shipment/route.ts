/**
 * Portal · Phase 4 commit 1 — supplier mini-cockpit "Confirmar embarque".
 *
 * Token-gated endpoint. A proveedor holding a valid upload_token taps
 * "Confirmar embarque" on /proveedor/[token] to tell the broker the
 * mercancía is ready to pick up. We:
 *
 *   1. Validate the token (existence + not expired).
 *   2. Stamp `upload_tokens.shipment_confirmed_at` so repeat taps are
 *      idempotent and the GET response can render a locked state.
 *   3. Emit a workflow_event (`supplier.shipment_confirmed`) so the
 *      operator cockpit and downstream automations see it.
 *   4. Log the decision into operational_decisions via logDecision()
 *      so the CRUZ Operational Brain has the reasoning trail.
 *
 * Auth: TOKEN ONLY. No session cookie required. Supplier never gets
 * a session — that boundary is permanent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BodySchema = z.object({
  token: z.string().min(8).max(256),
  note: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Cuerpo inválido' } },
      { status: 400 }
    )
  }

  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Falta token' } },
      { status: 400 }
    )
  }

  const { token, note } = parsed.data

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('upload_tokens')
    .select('id, trafico_id, company_id, expires_at, shipment_confirmed_at')
    .eq('token', token)
    .single()

  if (tokenErr || !tokenRow) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Enlace no válido' } },
      { status: 404 }
    )
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Enlace expirado' } },
      { status: 410 }
    )
  }

  // Idempotent: if already confirmed, return ok without re-emitting events.
  if (tokenRow.shipment_confirmed_at) {
    return NextResponse.json({
      data: { ok: true, alreadyConfirmed: true, confirmedAt: tokenRow.shipment_confirmed_at },
      error: null,
    })
  }

  const confirmedAt = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('upload_tokens')
    .update({ shipment_confirmed_at: confirmedAt })
    .eq('id', tokenRow.id)

  if (updErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: updErr.message } },
      { status: 500 }
    )
  }

  // Emit workflow_event so operator cockpit and downstream chain pick it up.
  const { error: evtErr } = await supabase.from('workflow_events').insert({
    workflow: 'intake',
    event_type: 'supplier.shipment_confirmed',
    trigger_id: tokenRow.trafico_id,
    company_id: tokenRow.company_id,
    payload: {
      trafico_id: tokenRow.trafico_id,
      token_id: tokenRow.id,
      note: note ?? null,
      confirmed_at: confirmedAt,
      source: 'proveedor_portal',
    },
    status: 'pending',
  })

  if (evtErr) {
    // Don't 500 — the confirmation has landed on upload_tokens already.
    // Surface as warning so operator can see the event failed to emit.
    // We still succeed to the supplier.
    console.error('[supplier/confirm-shipment] workflow_events insert failed:', evtErr.message)
  }

  await logDecision({
    trafico: tokenRow.trafico_id ?? null,
    company_id: tokenRow.company_id ?? null,
    decision_type: 'supplier_confirm',
    decision: 'shipment_confirmed',
    reasoning: note ? `Proveedor confirmó embarque con nota: ${note}` : 'Proveedor confirmó embarque vía portal',
    dataPoints: {
      token_id: tokenRow.id,
      confirmed_at: confirmedAt,
    },
  })

  return NextResponse.json({
    data: { ok: true, alreadyConfirmed: false, confirmedAt },
    error: null,
  })
}
