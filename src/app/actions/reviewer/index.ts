'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getOperator() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(token)
  const opId = cookieStore.get('operator_id')?.value
  if (!session) return null
  return { id: opId || 'system', role: session.role, companyId: session.companyId }
}

async function logAction(operatorId: string, actionType: string, payload: Record<string, unknown>) {
  await sb.from('operator_actions').insert({
    operator_id: operatorId,
    action_type: actionType,
    payload: { ...payload, timestamp: new Date().toISOString() },
  }).then(() => {}, () => {})
}

/** Approve a classification decision — marks agent_decisions.was_correct=true */
export async function approveClassification(decisionId: string, fraccion: string) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  const { error } = await sb.from('agent_decisions')
    .update({ was_correct: true })
    .eq('id', decisionId)

  if (error) return { ok: false, error: error.message }

  await logAction(op.id, 'reviewer_approved', {
    card: 'classification', subject_type: 'agent_decision',
    subject_id: decisionId, fraccion, previous: 'pending', new_state: 'approved',
  })

  return { ok: true }
}

/** Mark a document reminder as sent */
export async function markDocSent(traficoId: string, trafico: string, missingDocs: string[]) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  await logAction(op.id, 'reviewer_approved', {
    card: 'doc_chaser', subject_type: 'trafico',
    subject_id: traficoId, trafico, missingDocs,
    action: 'reminder_sent',
  })

  return { ok: true }
}

/** Escalate a blocked trafico */
export async function escalateBlocked(traficoId: string, trafico: string, reason: string) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  await logAction(op.id, 'reviewer_approved', {
    card: 'blocked', subject_type: 'trafico',
    subject_id: traficoId, trafico, reason,
    action: 'escalated',
  })

  return { ok: true }
}

/** Approve a pedimento draft */
export async function approveDraft(draftId: string) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  const { error } = await sb.from('pedimento_drafts')
    .update({ status: 'approved' })
    .eq('id', draftId)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }

  await logAction(op.id, 'reviewer_approved', {
    card: 'escalation', subject_type: 'pedimento_draft',
    subject_id: draftId, previous: 'pending', new_state: 'approved',
  })

  return { ok: true }
}

/** Take a trafico from the unassigned queue */
export async function takeTrafico(traficoId: string, trafico: string) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  const { error } = await sb.from('traficos')
    .update({ assigned_to_operator_id: op.id })
    .eq('id', traficoId)
    .is('assigned_to_operator_id', null)

  if (error) return { ok: false, error: error.message }

  await logAction(op.id, 'reviewer_approved', {
    card: 'smart_queue', subject_type: 'trafico',
    subject_id: traficoId, trafico, action: 'taken',
  })

  return { ok: true }
}

/** Generic card clear action */
export async function clearCard(cardId: string, surface: string, context?: Record<string, unknown>) {
  const op = await getOperator()
  if (!op) return { ok: false, error: 'Sin sesión' }

  await logAction(op.id, 'reviewer_cleared', {
    card: cardId, surface, ...context,
  })

  return { ok: true }
}
