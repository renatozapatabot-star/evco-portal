/**
 * ZAPATA AI v9 — Mensajería read helpers for cockpit activity feeds.
 *
 * Every helper uses soft* wrappers so missing tables / RLS misses return
 * empty arrays, never crash the cockpit SSR. When the Mensajería schema
 * eventually lands in production, these automatically start returning data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { softData } from '@/lib/cockpit/safe-query'
import { mensajeriaAvailable, mensajeriaThreadsAvailable } from '@/lib/cockpit/table-availability'

export interface MensajeriaMessage {
  id: string
  thread_id: string
  company_id: string
  sender_user_id: string | null
  sender_role: string | null
  sender_display_name: string | null
  body: string
  attachment_count: number | null
  internal_only: boolean | null
  created_at: string
}

export interface MensajeriaThread {
  id: string
  company_id: string
  subject: string | null
  last_message_preview: string | null
  last_message_at: string | null
  escalated: boolean | null
  escalated_at: string | null
}

export async function fetchClientMensajeriaFeed(
  sb: SupabaseClient,
  companyId: string,
  limit = 10,
): Promise<MensajeriaMessage[]> {
  if (!(await mensajeriaAvailable(sb))) return []
  return softData<MensajeriaMessage>(
    sb.from('mensajeria_messages')
      .select('id, thread_id, company_id, sender_user_id, sender_role, sender_display_name, body, attachment_count, internal_only, created_at')
      .eq('company_id', companyId)
      .eq('internal_only', false)
      .order('created_at', { ascending: false })
      .limit(limit)
  )
}

export async function fetchOperatorMensajeriaFeed(
  sb: SupabaseClient,
  limit = 10,
): Promise<MensajeriaMessage[]> {
  if (!(await mensajeriaAvailable(sb))) return []
  return softData<MensajeriaMessage>(
    sb.from('mensajeria_messages')
      .select('id, thread_id, company_id, sender_user_id, sender_role, sender_display_name, body, attachment_count, internal_only, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
  )
}

export async function fetchEscalatedThreads(
  sb: SupabaseClient,
  limit = 5,
): Promise<MensajeriaThread[]> {
  if (!(await mensajeriaThreadsAvailable(sb))) return []
  return softData<MensajeriaThread>(
    sb.from('mensajeria_threads')
      .select('id, company_id, subject, last_message_preview, last_message_at, escalated, escalated_at')
      .eq('escalated', true)
      .order('escalated_at', { ascending: false })
      .limit(limit)
  )
}

export function mensajeriaClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'false'
}
