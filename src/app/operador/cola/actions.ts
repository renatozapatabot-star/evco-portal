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

  const { error: updateErr } = await supabase
    .from('workflow_events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      payload: {
        ...((event.payload as Record<string, unknown>) || {}),
        approved_by: op.operatorId,
      },
    })
    .eq('id', eventId)

  if (updateErr) return { success: false, error: updateErr.message }

  await logDecision(
    event.trigger_id || '',
    event.company_id,
    'solicitation_approved',
    'Solicitud de documentos aprobada',
    'Operador aprobó envío de solicitud',
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
