import { createClient } from '@supabase/supabase-js'
import type { PortalRole } from '@/lib/session'
import { isInternal } from './roles'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface MentionRecipient {
  handle: string
  role: PortalRole
  operatorId: string | null
  claveCliente: string | null
  escalated: boolean
}

export interface MentionResult {
  recipients: MentionRecipient[]
  escalated: boolean
  untagged: boolean
  rejected: string[]  // client handles attempted by a client caller
}

const MENTION_REGEX = /@([a-z0-9_-]{2,32})/gi

/**
 * Parse @handles from a raw message and resolve them to recipients.
 * Clients may not mention other clients (any `recipient_role = 'client'` handle) — those handles
 * are rejected when the caller is not internal. Untagged messages default
 * to the operator queue.
 */
export async function resolveMentions(
  rawMessage: string,
  callerRole: PortalRole,
): Promise<MentionResult> {
  const handles = new Set<string>()
  for (const m of rawMessage.matchAll(MENTION_REGEX)) {
    handles.add(m[1].toLowerCase())
  }

  if (handles.size === 0) {
    return {
      recipients: [{
        handle: 'operator_queue',
        role: 'operator',
        operatorId: null,
        claveCliente: null,
        escalated: false,
      }],
      escalated: false,
      untagged: true,
      rejected: [],
    }
  }

  const { data } = await supabase
    .from('aguila_mention_routes')
    .select('handle, recipient_role, operator_id, clave_cliente, escalated, active')
    .in('handle', Array.from(handles))
    .eq('active', true)

  const recipients: MentionRecipient[] = []
  const rejected: string[] = []
  let escalated = false

  for (const row of data ?? []) {
    // Block clients from mentioning other clients to prevent cross-tenant pings
    if (row.recipient_role === 'client' && !isInternal(callerRole)) {
      rejected.push(row.handle)
      continue
    }
    recipients.push({
      handle: row.handle,
      role: row.recipient_role as PortalRole,
      operatorId: row.operator_id ?? null,
      claveCliente: row.clave_cliente ?? null,
      escalated: !!row.escalated,
    })
    if (row.escalated) escalated = true
  }

  if (recipients.length === 0) {
    recipients.push({
      handle: 'operator_queue',
      role: 'operator',
      operatorId: null,
      claveCliente: null,
      escalated: false,
    })
  }

  return { recipients, escalated, untagged: false, rejected }
}
