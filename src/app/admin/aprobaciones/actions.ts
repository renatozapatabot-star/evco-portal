'use server'

import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

async function requireBrokerSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) return { error: 'No session' }

  const session = await verifySession(token)
  if (!session) return { error: 'Invalid session' }

  if (session.role !== 'admin' && session.role !== 'broker') {
    return { error: 'Unauthorized — broker or admin role required' }
  }

  return { session }
}

export async function approveAction(draftId: string, traficoId: string, companyId: string) {
  const auth = await requireBrokerSession()
  if (auth.error) return { success: false, error: auth.error }

  const sb = createServerClient()

  // Idempotency: check current status
  const { data: draft } = await sb
    .from('pedimento_drafts')
    .select('id, status')
    .eq('id', draftId)
    .maybeSingle()

  if (!draft) return { success: false, error: 'Draft not found' }
  if (draft.status === 'approved') return { success: true, already: true }

  const now = new Date().toISOString()

  // Update draft status
  const { error: updateErr } = await sb
    .from('pedimento_drafts')
    .update({
      status: 'approved',
      reviewed_by: 'tito',
      updated_at: now,
    })
    .eq('id', draftId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit pedimento.approved workflow event
  await sb.from('workflow_events').insert({
    workflow: 'pedimento',
    event_type: 'approved',
    trigger_id: traficoId,
    company_id: companyId,
    payload: {
      trafico_id: traficoId,
      approved_by: 'tito',
      approved_at: now,
    },
    status: 'pending',
  })

  // Log to operational_decisions
  await sb.from('operational_decisions').insert({
    trafico: traficoId,
    company_id: companyId,
    decision_type: 'approval',
    decision: 'pedimento_approved_by_broker',
    reasoning: `Approved by Tito via portal at ${now}`,
    data_points_used: JSON.stringify({ draft_id: draftId, trafico_id: traficoId }),
  })

  // Log to audit_log
  await sb.from('audit_log').insert({
    action: 'pedimento_approved',
    entity_type: 'pedimento_draft',
    entity_id: draftId,
    details: { trafico_id: traficoId, company_id: companyId, approved_by: 'tito' },
  })

  return { success: true }
}

export async function requestChangesAction(
  draftId: string,
  traficoId: string,
  companyId: string,
  note: string
) {
  const auth = await requireBrokerSession()
  if (auth.error) return { success: false, error: auth.error }

  const sb = createServerClient()

  // Get current draft data to append note
  const { data: draft } = await sb
    .from('pedimento_drafts')
    .select('id, draft_data, status')
    .eq('id', draftId)
    .maybeSingle()

  if (!draft) return { success: false, error: 'Draft not found' }
  if (draft.status === 'approved') return { success: false, error: 'Already approved' }

  const now = new Date().toISOString()
  const updatedData = {
    ...draft.draft_data,
    revision_notes: [
      ...(draft.draft_data?.revision_notes || []),
      { note, by: 'tito', at: now },
    ],
  }

  const { error: updateErr } = await sb
    .from('pedimento_drafts')
    .update({
      status: 'needs_revision',
      draft_data: updatedData,
      updated_at: now,
    })
    .eq('id', draftId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit revision_requested event
  await sb.from('workflow_events').insert({
    workflow: 'pedimento',
    event_type: 'revision_requested',
    trigger_id: traficoId,
    company_id: companyId,
    payload: { trafico_id: traficoId, note, requested_by: 'tito' },
    status: 'pending',
  })

  // Log decision
  await sb.from('operational_decisions').insert({
    trafico: traficoId,
    company_id: companyId,
    decision_type: 'approval',
    decision: 'pedimento_revision_requested',
    reasoning: `Tito requested changes: ${note}`,
    data_points_used: JSON.stringify({ draft_id: draftId, note }),
  })

  return { success: true }
}

export async function rejectAction(
  draftId: string,
  traficoId: string,
  companyId: string,
  reason: string
) {
  const auth = await requireBrokerSession()
  if (auth.error) return { success: false, error: auth.error }

  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'Reason is required for rejection' }
  }

  const sb = createServerClient()

  const { data: draft } = await sb
    .from('pedimento_drafts')
    .select('id, draft_data, status')
    .eq('id', draftId)
    .maybeSingle()

  if (!draft) return { success: false, error: 'Draft not found' }
  if (draft.status === 'approved') return { success: false, error: 'Already approved — cannot reject' }

  const now = new Date().toISOString()
  const updatedData = {
    ...draft.draft_data,
    rejection_reason: reason,
    rejected_at: now,
    rejected_by: 'tito',
  }

  const { error: updateErr } = await sb
    .from('pedimento_drafts')
    .update({
      status: 'rejected',
      draft_data: updatedData,
      updated_at: now,
    })
    .eq('id', draftId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Emit rejected event
  await sb.from('workflow_events').insert({
    workflow: 'pedimento',
    event_type: 'rejected',
    trigger_id: traficoId,
    company_id: companyId,
    payload: { trafico_id: traficoId, reason, rejected_by: 'tito' },
    status: 'pending',
  })

  // Log decision
  await sb.from('operational_decisions').insert({
    trafico: traficoId,
    company_id: companyId,
    decision_type: 'approval',
    decision: 'pedimento_rejected',
    reasoning: `Rejected by Tito: ${reason}`,
    data_points_used: JSON.stringify({ draft_id: draftId, reason }),
  })

  return { success: true }
}
