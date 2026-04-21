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

async function requireBroker(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session || (session.role !== 'admin' && session.role !== 'broker')) return null
  return cookieStore.get('operator_id')?.value || session.companyId || 'broker'
}

async function logAudit(action: string, draftId: string, brokerId: string, details: Record<string, unknown>) {
  await supabase.from('audit_log').insert({
    action,
    entity_type: 'pedimento_draft',
    entity_id: draftId,
    user_id: brokerId,
    details,
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {}) // Non-blocking audit
}

export async function approveDraft(draftId: string): Promise<ActionResult> {
  const brokerId = await requireBroker()
  if (!brokerId) return { success: false, error: 'No autorizado' }

  const { data: draft } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (!draft) return { success: false, error: 'Borrador no encontrado' }

  // Set to approved_pending (5-second cancellation window)
  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'approved_pending',
      reviewed_by: brokerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (error) return { success: false, error: error.message }

  const draftData = (draft.draft_data || {}) as Record<string, unknown>
  await logAudit('draft_approved_portal', draftId, brokerId, {
    supplier: draftData.supplier,
    valor_usd: draftData.valor_total_usd,
    channel: 'portal',
  })

  // Auto-advance to approved after 5 seconds (handled by resolveStatus in UI)
  // The same pattern as Telegram: approved_pending → approved after 5s elapsed

  return { success: true }
}

export async function rejectDraft(draftId: string, reason: string): Promise<ActionResult> {
  const brokerId = await requireBroker()
  if (!brokerId) return { success: false, error: 'No autorizado' }

  if (!reason.trim()) return { success: false, error: 'Motivo requerido' }

  const { data: draft } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (!draft) return { success: false, error: 'Borrador no encontrado' }

  const draftData = (draft.draft_data || {}) as Record<string, unknown>

  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'rejected',
      reviewed_by: brokerId,
      updated_at: new Date().toISOString(),
      draft_data: { ...draftData, rejection_reason: reason },
    })
    .eq('id', draftId)

  if (error) return { success: false, error: error.message }

  await logAudit('draft_rejected_portal', draftId, brokerId, {
    supplier: draftData.supplier,
    reason,
    channel: 'portal',
  })

  return { success: true }
}

export async function correctDraft(draftId: string, note: string): Promise<ActionResult> {
  const brokerId = await requireBroker()
  if (!brokerId) return { success: false, error: 'No autorizado' }

  if (!note.trim()) return { success: false, error: 'Nota de corrección requerida' }

  const { data: draft } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .eq('id', draftId)
    .single()

  if (!draft) return { success: false, error: 'Borrador no encontrado' }

  const draftData = (draft.draft_data || {}) as Record<string, unknown>

  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'approved_corrected',
      reviewed_by: brokerId,
      updated_at: new Date().toISOString(),
      draft_data: { ...draftData, correction_note: note },
    })
    .eq('id', draftId)

  if (error) return { success: false, error: error.message }

  await logAudit('draft_corrected_portal', draftId, brokerId, {
    supplier: draftData.supplier,
    correction_note: note,
    channel: 'portal',
  })

  return { success: true }
}

export async function cancelApproval(draftId: string): Promise<ActionResult> {
  const brokerId = await requireBroker()
  if (!brokerId) return { success: false, error: 'No autorizado' }

  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'draft',
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .eq('status', 'approved_pending') // Only cancel if still in window

  if (error) return { success: false, error: error.message }

  await logAudit('draft_approval_cancelled_portal', draftId, brokerId, {
    channel: 'portal',
  })

  return { success: true }
}
