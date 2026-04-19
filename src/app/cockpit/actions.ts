'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { logOperatorAction } from '@/lib/operator-actions'

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Confirm AI classification and advance workflow.
 * Reuses /api/clasificar POST pattern.
 */
export async function confirmAndAdvanceAction(formData: FormData) {
  const decisionId = formData.get('decisionId') as string
  const operatorId = formData.get('operatorId') as string
  const traficoId = formData.get('traficoId') as string
  if (!decisionId || !operatorId) return

  const sb = getSb()

  // 1. Fetch the decision
  const { data: decision } = await sb.from('agent_decisions')
    .select('id, decision, confidence, payload, company_id')
    .eq('id', decisionId)
    .maybeSingle()

  if (!decision) return

  // 2. Mark as correct
  await sb.from('agent_decisions')
    .update({
      was_correct: true,
      outcome: 'confirmed_by_operator',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', decisionId)

  // 3. Writeback to globalpc_productos if payload has product info
  const payload = decision.payload as Record<string, unknown> | null
  if (payload?.product_description && decision.decision) {
    // allowlist-ok:globalpc_productos — operator classification writeback;
    // UPDATE scoped by (decision.company_id, descripcion fuzzy match),
    // limited to 1 row. Write op, not a read.
    await sb.from('globalpc_productos')
      .update({
        fraccion: decision.decision,
        fraccion_source: 'human_operator',
        fraccion_classified_at: new Date().toISOString(),
      })
      .eq('company_id', decision.company_id)
      .ilike('descripcion', `%${String(payload.product_description).slice(0, 50)}%`)
      .limit(1)
  }

  // 4. Emit workflow event
  await sb.from('workflow_events').insert({
    workflow: 'classify',
    event_type: 'classification_confirmed',
    trigger_id: traficoId || null,
    company_id: decision.company_id,
    payload: { decision_id: decisionId, operator_id: operatorId },
    status: 'completed',
  })

  // 5. Log operator action
  await logOperatorAction({
    operatorId,
    actionType: 'vote_classification',
    targetTable: 'agent_decisions',
    targetId: decisionId,
    companyId: decision.company_id,
    payload: { fraccion: decision.decision, confidence: decision.confidence },
  })

  revalidatePath('/')
}

/**
 * Escalate a trafico to Tito (admin).
 * Creates an escalation record and logs the action.
 */
export async function escalateToTitoAction(formData: FormData) {
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  const reason = (formData.get('reason') as string) || 'Necesita revision manual'
  if (!traficoId || !operatorId) return

  const sb = getSb()

  // Find trafico context
  const { data: trafico } = await sb.from('traficos')
    .select('trafico, company_id, descripcion_mercancia')
    .eq('id', traficoId)
    .maybeSingle()

  // Create pending draft entry as escalation signal
  await sb.from('pedimento_drafts').insert({
    trafico_id: trafico?.trafico || traficoId,
    company_id: trafico?.company_id || null,
    status: 'pending',
    draft_data: { escalated_by: operatorId, reason },
  })

  await logOperatorAction({
    operatorId,
    actionType: 'escalate_to_admin',
    targetTable: 'traficos',
    targetId: traficoId,
    companyId: trafico?.company_id || undefined,
    payload: { reason },
  })

  revalidatePath('/')
}

/**
 * Take next unassigned trafico from the queue.
 * Same pattern as asignarTrafico in /operador/page.tsx.
 */
export async function takeFromQueueAction(formData: FormData) {
  const operatorId = formData.get('operatorId') as string
  if (!operatorId) return

  const sb = getSb()

  // Find first unassigned active trafico
  const { data: next } = await sb.from('traficos')
    .select('id, trafico')
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
    .is('assigned_to_operator_id', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!next) return

  // Assign to this operator
  await sb.from('traficos')
    .update({ assigned_to_operator_id: operatorId })
    .eq('id', next.id)

  await logOperatorAction({
    operatorId,
    actionType: 'assign_trafico',
    targetTable: 'traficos',
    targetId: next.id,
  })

  revalidatePath('/')
}

/**
 * Request document update from supplier (stub — logs action for now).
 */
export async function requestUpdateAction(formData: FormData) {
  const traficoId = formData.get('traficoId') as string
  const operatorId = formData.get('operatorId') as string
  if (!traficoId || !operatorId) return

  await logOperatorAction({
    operatorId,
    actionType: 'request_supplier_update',
    targetTable: 'traficos',
    targetId: traficoId,
  })

  revalidatePath('/')
}
