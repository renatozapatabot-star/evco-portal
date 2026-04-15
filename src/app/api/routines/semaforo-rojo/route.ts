/**
 * ZAPATA AI · Routine R3 — Semáforo Rojo Webhook
 *
 * Event-triggered, NOT scheduled. Called when GlobalPC sync detects a
 * tráfico's estatus flipping to semáforo rojo. Creates / updates the
 * Mensajería thread for that tráfico, @mentions the assigned operator,
 * attaches chain context, and suggests a next action.
 *
 * Expected payload:
 *   { traficoId: string, companyId?: string, estatus?: string, detectedAt?: string }
 *
 * Idempotent via findOrCreateThreadByTrafico — calling twice for the same
 * tráfico adds a second message, not a second thread.
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRoutineRequest, routineOk, routineError } from '@/lib/routines/auth'
import { findOrCreateThreadByTrafico } from '@/lib/mensajeria/threads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WebhookBody {
  traficoId?: string
  companyId?: string
  estatus?: string
  detectedAt?: string
  /** Pre-composed message from the routine. Required. */
  message?: string
}

export async function POST(request: NextRequest) {
  const auth = verifyRoutineRequest(request, 'semaforo-rojo')
  if (!auth.ok) return auth.response

  const body: WebhookBody = await request.json().catch(() => ({}))
  if (!body.traficoId) {
    return routineError('VALIDATION_ERROR', 'traficoId required', 400)
  }
  if (!body.message) {
    return routineError('VALIDATION_ERROR', 'message required — compose in the routine before calling', 400)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    // Resolve traficoId → company_id + assigned_to_operator_id so we can
    // gate the thread and @mention the right operator in a follow-up.
    const { data: traficoRow, error: trafErr } = await sb
      .from('traficos')
      .select('trafico, company_id, assigned_to_operator_id, estatus, semaforo, descripcion_mercancia, pedimento, fecha_llegada')
      .eq('trafico', body.traficoId)
      .maybeSingle()

    if (trafErr) {
      return routineError('INTERNAL_ERROR', `lookup failed: ${trafErr.message}`)
    }
    if (!traficoRow) {
      return routineError('NOT_FOUND', `tráfico ${body.traficoId} not found`, 404)
    }

    const tr = traficoRow as {
      trafico: string
      company_id: string | null
      assigned_to_operator_id: string | null
      estatus: string | null
      semaforo: string | null
      descripcion_mercancia: string | null
      pedimento: string | null
      fecha_llegada: string | null
    }

    const companyId = body.companyId ?? tr.company_id ?? 'internal'
    const subject = `Semáforo rojo · ${tr.trafico}${tr.pedimento ? ` · ${tr.pedimento}` : ''}`

    const threadRes = await findOrCreateThreadByTrafico({
      companyId,
      traficoId: tr.trafico,
      subject,
      role: 'system',
      authorName: 'ZAPATA AI Routines',
      firstMessageBody: body.message,
      internalOnly: true,
    })

    if (!threadRes.data) {
      return routineError('INTERNAL_ERROR', `thread create failed: ${threadRes.error?.message ?? 'unknown'}`)
    }

    return routineOk({
      thread: { id: threadRes.data.id, subject: threadRes.data.subject },
      trafico: {
        id: tr.trafico,
        companyId: tr.company_id,
        assignedOperatorId: tr.assigned_to_operator_id,
        estatus: tr.estatus,
        semaforo: tr.semaforo,
        pedimento: tr.pedimento,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return routineError('INTERNAL_ERROR', `semaforo-rojo failed: ${msg}`)
  }
}
