/**
 * CRUZ AI conversation memory — Phase 3 of the v2 expansion.
 *
 * Three primitives:
 *   - `getOrCreateConversation` — upserts the (session_id, company_id)
 *     envelope. Tenant isolation: a stolen session_id from another tenant
 *     won't match the unique index, so a fresh envelope is created.
 *   - `loadRecentTurns` — last N turns in chronological order, ready to
 *     prepend to an Anthropic messages array.
 *   - `appendTurn` — monotonic `turn_index` insert + `last_message_at`
 *     bump on the parent. Atomic from the caller's perspective (two
 *     writes, second is best-effort).
 *
 * Tenant safety: every primitive that accepts a `conversationId` also
 * requires `companyId` and verifies ownership before reading or writing.
 * Callers CANNOT pass a `conversationId` from another tenant — the
 * lookup returns empty / the write refuses.
 *
 * RLS: the table policies are `FOR ALL USING (false)`. Service role
 * bypasses those. The portal uses an HMAC session (not Supabase auth)
 * so no JWT-claim policy would ever evaluate true. App-layer tenant
 * filter is the primary gate; RLS is the safety net.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_TURN_WINDOW = 6
const MAX_TURN_WINDOW = 20
const MAX_CONTENT_CHARS = 16_000

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  tools_called: string[]
  created_at: string
}

export interface GetOrCreateInput {
  companyId: string
  operatorId: string | null
  sessionId: string
  role: string
}

export interface AppendTurnOptions {
  toolsCalled?: ReadonlyArray<string>
  metadata?: Record<string, unknown> | null
}

/**
 * Find or create the conversation envelope for (sessionId, companyId).
 *
 * Returns `{ conversationId, created }`. `created=true` means a fresh
 * envelope — callers can skip the `loadRecentTurns` call since it will
 * be empty.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  input: GetOrCreateInput,
): Promise<{ conversationId: string | null; created: boolean; error: string | null }> {
  if (!input.companyId || !input.sessionId) {
    return { conversationId: null, created: false, error: 'invalid_input' }
  }

  const { data: existing, error: findErr } = await supabase
    .from('cruz_ai_conversations')
    .select('id')
    .eq('session_id', input.sessionId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  if (findErr) return { conversationId: null, created: false, error: `conv:${findErr.message}` }
  if (existing?.id) return { conversationId: existing.id, created: false, error: null }

  const { data: created, error: insertErr } = await supabase
    .from('cruz_ai_conversations')
    .insert({
      company_id: input.companyId,
      operator_id: input.operatorId,
      session_id: input.sessionId,
      role: input.role,
    })
    .select('id')
    .single()

  if (insertErr) return { conversationId: null, created: false, error: `conv_insert:${insertErr.message}` }
  return { conversationId: created.id, created: true, error: null }
}

/**
 * Load the last N turns (default 6) of a conversation, scoped to a
 * tenant. Returns an empty array if the conversation doesn't exist or
 * belongs to a different company — tenant-isolation safety net.
 *
 * Ordering: oldest turn first (ready to spread into Anthropic's
 * messages array).
 */
export async function loadRecentTurns(
  supabase: SupabaseClient,
  conversationId: string,
  companyId: string,
  limit: number = DEFAULT_TURN_WINDOW,
): Promise<ConversationTurn[]> {
  if (!conversationId || !companyId) return []
  const capped = Math.min(Math.max(limit, 1), MAX_TURN_WINDOW)

  // Tenant ownership check — a stolen conversationId from another
  // tenant returns empty rather than leaking the other tenant's turns.
  const { data: owner } = await supabase
    .from('cruz_ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!owner?.id) return []

  const { data } = await supabase
    .from('cruz_ai_messages')
    .select('role, content, tools_called, created_at')
    .eq('conversation_id', conversationId)
    .order('turn_index', { ascending: false })
    .limit(capped)

  if (!data) return []

  const rows = data as Array<{
    role: string
    content: string
    tools_called: string[] | null
    created_at: string
  }>

  // Query returned newest-first to pick up the tail; reverse so callers
  // get oldest-first chronological order.
  return rows.reverse()
    .filter(r => r.role === 'user' || r.role === 'assistant')
    .map(r => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
      tools_called: r.tools_called ?? [],
      created_at: r.created_at,
    }))
}

/**
 * Append a turn to a conversation. Verifies tenant ownership of the
 * conversation before inserting; refuses if mismatched.
 *
 * `last_message_at` bump on the parent is best-effort — a failure
 * there doesn't unroll the message insert since the insert is the
 * load-bearing write.
 */
export async function appendTurn(
  supabase: SupabaseClient,
  conversationId: string,
  companyId: string,
  role: 'user' | 'assistant',
  content: string,
  options: AppendTurnOptions = {},
): Promise<{ success: boolean; turnIndex: number | null; error: string | null }> {
  if (!conversationId || !companyId) {
    return { success: false, turnIndex: null, error: 'invalid_input' }
  }
  if (role !== 'user' && role !== 'assistant') {
    return { success: false, turnIndex: null, error: 'invalid_role' }
  }

  const { data: owner } = await supabase
    .from('cruz_ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!owner?.id) return { success: false, turnIndex: null, error: 'forbidden_tenant_mismatch' }

  const { data: last } = await supabase
    .from('cruz_ai_messages')
    .select('turn_index')
    .eq('conversation_id', conversationId)
    .order('turn_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const turnIndex = ((last?.turn_index as number | null) ?? -1) + 1
  const cappedContent = (content ?? '').slice(0, MAX_CONTENT_CHARS)

  const { error: insertErr } = await supabase.from('cruz_ai_messages').insert({
    conversation_id: conversationId,
    turn_index: turnIndex,
    role,
    content: cappedContent,
    tools_called: Array.from(options.toolsCalled ?? []),
    metadata: options.metadata ?? null,
  })

  if (insertErr) return { success: false, turnIndex: null, error: `msg_insert:${insertErr.message}` }

  // Best-effort parent bump. Don't fail the caller if this hiccups —
  // the message is already safely persisted.
  await supabase
    .from('cruz_ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('company_id', companyId)

  return { success: true, turnIndex, error: null }
}

/** Constants exposed for tests + tuning scripts. */
export const CONVERSATION_CONSTANTS = {
  DEFAULT_TURN_WINDOW,
  MAX_TURN_WINDOW,
  MAX_CONTENT_CHARS,
} as const
