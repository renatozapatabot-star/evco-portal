'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ActionResult {
  success: boolean
  error?: string
}

async function getOperator(): Promise<{ operatorId: string; role: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  const opId = cookieStore.get('operator_id')?.value || session.companyId
  return { operatorId: opId, role: session.role }
}

async function logDecision(
  trafico: string,
  companyId: string,
  decisionType: string,
  decision: string,
  reasoning: string,
  operatorId: string,
) {
  await supabase.from('operational_decisions').insert({
    trafico,
    company_id: companyId,
    decision_type: decisionType,
    decision,
    reasoning,
    data_points_used: { operator_id: operatorId, timestamp: new Date().toISOString() },
  })
}

export async function resolveClassification(
  eventId: string,
  fraccion: string,
  productDescription: string
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  // Update workflow event to completed
  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      payload: {
        ...((event.payload as Record<string, unknown>) || {}),
        resolved_fraccion: fraccion,
        resolved_by: op.operatorId,
      },
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'manual_classification',
    `Clasificado como ${fraccion}`,
    `Operador clasificó manualmente: ${productDescription?.substring(0, 100)}`,
    op.operatorId,
  )

  return { success: true }
}

export async function approveSolicitation(eventId: string): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const payload = (event.payload || {}) as Record<string, unknown>
  const now = new Date().toISOString()

  // Extract email fields from payload
  const emailTo = (payload.supplier_email || payload.to || (payload.email as Record<string, unknown>)?.to) as string | undefined
  const emailSubject = (payload.subject || (payload.email as Record<string, unknown>)?.subject || `Solicitud de documentación — Embarque ${event.trigger_id}`) as string
  const emailBody = (payload.body || payload.email_body || (payload.email as Record<string, unknown>)?.html || '') as string

  // Mark completed with approval metadata
  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'completed',
      completed_at: now,
      payload: {
        ...payload,
        approved_by: op.operatorId,
        approved_at: now,
      },
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Actually send the email via Resend if we have a recipient
  if (emailTo) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Renato Zapata & Co. <ai@renatozapata.com>',
            to: [emailTo],
            subject: emailSubject,
            html: emailBody || `<p>Solicitud de documentación para embarque ${event.trigger_id}</p>`,
          }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          // Email failed — revert to failed status
          await supabase.from('workflow_events').update({
            status: 'failed',
            error_message: `Email send failed: ${(errData as Record<string, unknown>).message || res.statusText}`,
          }).eq('id', eventId)
          return { success: false, error: `Error al enviar email: ${(errData as Record<string, unknown>).message || res.statusText}` }
        }
      } catch (err) {
        await supabase.from('workflow_events').update({
          status: 'failed',
          error_message: `Email send error: ${(err as Error).message}`,
        }).eq('id', eventId)
        return { success: false, error: `Error de conexión: ${(err as Error).message}` }
      }
    }

    // Emit docs.solicitation_sent event
    await supabase.from('workflow_events').insert({
      workflow: 'docs',
      event_type: 'solicitation_sent',
      trigger_id: event.trigger_id,
      company_id: event.company_id,
      payload: {
        trafico_id: event.trigger_id,
        supplier_email: emailTo,
        sent_by: op.operatorId,
        sent_at: now,
      },
      status: 'pending',
    })
  }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'solicitation_approved',
    `Solicitud aprobada${emailTo ? ` y enviada a ${emailTo}` : ''}`,
    `Operador aprobó envío de solicitud${emailTo ? ` — email enviado a ${emailTo}` : ' — sin email destino'}`,
    op.operatorId,
  )

  return { success: true }
}

export async function assignCarrier(
  eventId: string,
  carrierName: string
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      payload: {
        ...((event.payload as Record<string, unknown>) || {}),
        assigned_carrier: carrierName,
        assigned_by: op.operatorId,
      },
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'carrier_assignment',
    `Transportista asignado: ${carrierName}`,
    'Operador asignó transportista manualmente',
    op.operatorId,
  )

  return { success: true }
}

export async function retryEvent(eventId: string): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'pending',
      error_message: null,
      attempt_count: ((event.attempt_count as number) || 0) + 1,
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'event_retry',
    'Reintento de evento fallido',
    `Operador reinició evento ${event.event_type} (intento ${((event.attempt_count as number) || 0) + 1})`,
    op.operatorId,
  )

  return { success: true }
}

export async function escalateEvent(
  eventId: string,
  note: string
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'dead_letter',
      error_message: `Escalado por operador: ${note}`,
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'escalation',
    `Escalado: ${note}`,
    `Operador escaló evento ${event.event_type} al broker`,
    op.operatorId,
  )

  return { success: true }
}

export async function resolveCompleteness(
  eventId: string,
  resolution: 'confirmed' | 'not_required',
  notes: string
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const payload = (event.payload || {}) as Record<string, unknown>
  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'completed',
      completed_at: now,
      payload: {
        ...payload,
        resolution,
        resolution_notes: notes || null,
        resolved_by: op.operatorId,
        resolved_at: now,
      },
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  // If documents confirmed received, emit expediente_complete
  if (resolution === 'confirmed') {
    await supabase.from('workflow_events').insert({
      workflow: 'docs',
      event_type: 'expediente_complete',
      trigger_id: event.trigger_id,
      company_id: event.company_id,
      payload: {
        trafico_id: event.trigger_id,
        confirmed_by: op.operatorId,
      },
      status: 'pending',
    })
  }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'completeness_resolution',
    resolution === 'confirmed' ? 'Documentos confirmados' : 'Documentos no requeridos',
    `Operador resolvió: ${resolution}${notes ? ` — ${notes}` : ''}`,
    op.operatorId,
  )

  return { success: true }
}

export async function retrySolicitation(
  eventId: string,
  action: 'retry' | 'mark_manual'
): Promise<ActionResult> {
  const op = await getOperator()
  if (!op) return { success: false, error: 'No autorizado' }

  const { data: event } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) return { success: false, error: 'Evento no encontrado' }

  const payload = (event.payload || {}) as Record<string, unknown>
  const now = new Date().toISOString()

  if (action === 'retry') {
    const { error: updateErr } = await supabase
      .from('workflow_events')
      .update({
        status: 'pending',
        error_message: null,
        attempt_count: ((event.attempt_count as number) || 0) + 1,
      })
      .eq('id', eventId)

    if (updateErr) return { success: false, error: updateErr.message }

    await logDecision(
      event.trigger_id || '',
      event.company_id,
      'solicitation_retry',
      'Reintento de solicitud fallida',
      `Operador reintentó envío (intento ${((event.attempt_count as number) || 0) + 1})`,
      op.operatorId,
    )
  } else {
    const { error: updateErr } = await supabase
      .from('workflow_events')
      .update({
        status: 'completed',
        completed_at: now,
        payload: {
          ...payload,
          manual_resolution: true,
          resolved_by: op.operatorId,
          resolved_at: now,
        },
      })
      .eq('id', eventId)

    if (updateErr) return { success: false, error: updateErr.message }

    await logDecision(
      event.trigger_id || '',
      event.company_id,
      'solicitation_manual',
      'Solicitud resuelta manualmente',
      'Operador marcó solicitud como resuelta manualmente (sin envío automático)',
      op.operatorId,
    )
  }

  return { success: true }
}
