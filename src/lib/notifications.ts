import { createClient } from '@supabase/supabase-js'

/**
 * V1 Polish Pack · Block 6 — notifications server helper.
 * Uses existing `notifications` table (legacy schema: company_id,
 * severity, title, description, read, action_url, trafico_id).
 *
 * Recipient identity: we use `{companyId}:{role}` composite stored
 * in `recipient_key` (added by Block 6 migration). For legacy rows
 * without recipient_key, company_id is the scoping key — and that's
 * how the existing bell already reads.
 */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type NotificationSeverity = 'info' | 'warning' | 'success' | 'celebration' | 'error'

export interface CreateNotificationInput {
  companyId: string
  /** Composite userId from session, e.g. "evco:client". Stored in recipient_key. */
  recipientKey?: string
  title: string
  description: string
  severity?: NotificationSeverity
  actionUrl?: string
  traficoId?: string
  entityType?: string
  entityId?: string
}

export interface CreateNotificationResult {
  id: string | null
  error: { code: string; message: string } | null
}

/**
 * Insert a notification row. Returns the row id or a typed error.
 * Never throws across the boundary — route handlers and server actions
 * can inspect `error` and decide how to surface it.
 */
export async function createNotification(input: CreateNotificationInput): Promise<CreateNotificationResult> {
  const {
    companyId,
    recipientKey,
    title,
    description,
    severity = 'info',
    actionUrl,
    traficoId,
    entityType,
    entityId,
  } = input

  if (!companyId) {
    return { id: null, error: { code: 'VALIDATION_ERROR', message: 'companyId required' } }
  }
  if (!title || !description) {
    return { id: null, error: { code: 'VALIDATION_ERROR', message: 'title and description required' } }
  }

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      company_id: companyId,
      recipient_key: recipientKey ?? null,
      title,
      description,
      severity,
      action_url: actionUrl ?? null,
      trafico_id: traficoId ?? null,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      read: false,
    })
    .select('id')
    .single()

  if (error) {
    return { id: null, error: { code: 'INTERNAL_ERROR', message: error.message } }
  }
  return { id: (data?.id as string) ?? null, error: null }
}

export interface NotificationRow {
  id: string
  company_id: string
  recipient_key: string | null
  title: string
  description: string
  severity: NotificationSeverity
  action_url: string | null
  trafico_id: string | null
  entity_type: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}

export async function listNotifications(companyId: string, limit = 20): Promise<NotificationRow[]> {
  const supabase = getAdmin()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, company_id, recipient_key, title, description, severity, action_url, trafico_id, entity_type, entity_id, read, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data as NotificationRow[] | null) ?? []
}

export async function markNotificationRead(id: string, companyId: string): Promise<{ ok: boolean; error: string | null }> {
  if (!id) return { ok: false, error: 'id required' }
  const supabase = getAdmin()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('company_id', companyId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}
