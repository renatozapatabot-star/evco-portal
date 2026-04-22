/**
 * Agent write-action pipeline — propose, 5-second-cancel, commit.
 *
 * Backs CRUZ AI's write-gated tools. The agent never writes directly
 * to client-facing or regulated tables; instead it `proposeAction` with
 * a payload shaped for one of three `kind`s, returns the action id to
 * the user, and the UI shows a visible 5-second countdown with a Cancel
 * button. After the deadline (or on Cancel click) the app calls
 * `commitAction` or `cancelAction`.
 *
 * Invariants:
 *   - Tenant isolation: every propose / commit / cancel carries a
 *     `companyId` arg and every status transition uses it as a filter.
 *     A forged action_id from another tenant returns `not_found`
 *     (never `forbidden` — avoid information leak).
 *   - Append-only: no DELETE paths. Cancelling is a status flip.
 *   - Idempotent transitions: commit on an already-committed row
 *     returns the row unchanged (not an error). Same for cancel. This
 *     matters because the UI may double-fire on slow networks.
 *   - Deadline: commit accepts transition even after the deadline has
 *     passed — a user with slow network should not lose their work.
 *     Cancel is always allowed while status='proposed'.
 *   - Downstream side-effects (actual mensajeria send, actual trafico
 *     flag write, actual OCA creation) are NOT done by this module.
 *     `committed` is the authorization token; an operator surface or
 *     follow-up cron reads committed rows and executes. Keeps the
 *     HARD approval gate intact.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { PortalRole } from '@/lib/session'

// ─── Kind registry ─────────────────────────────────────────────────

export const ACTION_KINDS = [
  'flag_shipment',
  'draft_mensajeria_to_anabel',
  'open_oca_request',
] as const

export type AgentActionKind = (typeof ACTION_KINDS)[number]

/**
 * 5-second cancellation window per CLAUDE.md. Kept centralized so the
 * UI countdown, the deadline stamp, and the tests agree on one number.
 */
export const CANCEL_WINDOW_MS = 5000

// ─── Per-kind payload schemas ──────────────────────────────────────

const flagShipmentPayload = z.object({
  trafico_id: z.string().min(1).max(64),
  reason_es: z.string().min(1).max(280),
  severity: z.enum(['info', 'warn', 'critical']).default('warn'),
})

const draftMensajeriaToAnabelPayload = z.object({
  subject_es: z.string().min(1).max(140),
  body_es: z.string().min(1).max(4000),
  related_trafico_id: z.string().min(1).max(64).optional(),
  related_pedimento: z.string().min(1).max(32).optional(),
})

const openOcaRequestPayload = z.object({
  trafico_id: z.string().min(1).max(64).optional(),
  fraccion: z
    .string()
    .regex(/^\d{4}\.\d{2}\.\d{2}$/, 'fraccion must be XXXX.XX.XX')
    .optional(),
  cve_producto: z.string().min(1).max(64).optional(),
  product_description_es: z.string().min(1).max(500),
  reason_es: z.string().min(1).max(500),
})

const PAYLOAD_SCHEMAS: Record<AgentActionKind, z.ZodTypeAny> = {
  flag_shipment: flagShipmentPayload,
  draft_mensajeria_to_anabel: draftMensajeriaToAnabelPayload,
  open_oca_request: openOcaRequestPayload,
}

export type FlagShipmentPayload = z.infer<typeof flagShipmentPayload>
export type DraftMensajeriaToAnabelPayload = z.infer<typeof draftMensajeriaToAnabelPayload>
export type OpenOcaRequestPayload = z.infer<typeof openOcaRequestPayload>

// ─── Row shape ─────────────────────────────────────────────────────

export type AgentActionStatus =
  | 'proposed'
  | 'committed'
  | 'cancelled'
  | 'executed'
  | 'execute_failed'

export interface AgentActionRow {
  id: string
  created_at: string
  company_id: string
  actor_id: string | null
  actor_role: string
  kind: AgentActionKind
  payload: Record<string, unknown>
  summary_es: string
  status: AgentActionStatus
  commit_deadline_at: string
  committed_at: string | null
  cancelled_at: string | null
  cancel_reason_es: string | null
  decision_id: string | null
  /** Populated by the operator execute surface after 20260422210000. */
  executed_at?: string | null
  executed_by?: string | null
  executed_by_role?: string | null
  execute_attempts?: number | null
  execute_error_es?: string | null
  execute_result?: Record<string, unknown> | null
}

// ─── Result envelopes ──────────────────────────────────────────────

export type ProposeResult =
  | { ok: true; action: AgentActionRow }
  | { ok: false; error: 'invalid_payload' | 'insert_failed'; detail?: string }

export type TransitionResult =
  | { ok: true; action: AgentActionRow; already: boolean }
  | { ok: false; error: 'not_found' | 'invalid_transition' | 'update_failed'; detail?: string }

// ─── Propose ───────────────────────────────────────────────────────

export interface ProposeActionInput {
  companyId: string
  actorId: string | null
  actorRole: PortalRole
  kind: AgentActionKind
  payload: unknown
  summaryEs: string
  decisionId?: string | null
}

/**
 * Validate + insert a proposed action. Returns the full row so the
 * caller can emit the `action` stream event with id + deadline.
 */
export async function proposeAction(
  supabase: SupabaseClient,
  input: ProposeActionInput,
): Promise<ProposeResult> {
  const schema = PAYLOAD_SCHEMAS[input.kind]
  const parsed = schema.safeParse(input.payload)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid_payload',
      detail: parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; '),
    }
  }

  const now = Date.now()
  const deadline = new Date(now + CANCEL_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('agent_actions')
    .insert({
      company_id: input.companyId,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      kind: input.kind,
      payload: parsed.data as Record<string, unknown>,
      summary_es: input.summaryEs,
      status: 'proposed',
      commit_deadline_at: deadline,
      decision_id: input.decisionId ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: 'insert_failed', detail: error?.message }
  }
  return { ok: true, action: data as AgentActionRow }
}

// ─── Commit ────────────────────────────────────────────────────────

/**
 * Flip `proposed → committed`. Idempotent: calling on a row that is
 * already `committed` returns the same row with `already: true`.
 *
 * Cross-tenant lookups return `not_found` — never `forbidden`, to
 * avoid confirming the id exists elsewhere.
 */
export async function commitAction(
  supabase: SupabaseClient,
  companyId: string,
  actionId: string,
): Promise<TransitionResult> {
  const row = await loadRow(supabase, companyId, actionId)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'committed') return { ok: true, action: row, already: true }
  if (row.status === 'cancelled') return { ok: false, error: 'invalid_transition' }

  const { data, error } = await supabase
    .from('agent_actions')
    .update({ status: 'committed', committed_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('company_id', companyId)
    .eq('status', 'proposed')
    .select('*')
    .single()

  if (error || !data) {
    // Race: another caller committed or cancelled between our read
    // and write. Re-read to return the canonical row.
    const after = await loadRow(supabase, companyId, actionId)
    if (after?.status === 'committed') return { ok: true, action: after, already: true }
    if (after?.status === 'cancelled') return { ok: false, error: 'invalid_transition' }
    return { ok: false, error: 'update_failed', detail: error?.message }
  }
  return { ok: true, action: data as AgentActionRow, already: false }
}

// ─── Cancel ────────────────────────────────────────────────────────

export async function cancelAction(
  supabase: SupabaseClient,
  companyId: string,
  actionId: string,
  reasonEs?: string,
): Promise<TransitionResult> {
  const row = await loadRow(supabase, companyId, actionId)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'cancelled') return { ok: true, action: row, already: true }
  if (row.status === 'committed') return { ok: false, error: 'invalid_transition' }

  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason_es: reasonEs ?? null,
    })
    .eq('id', actionId)
    .eq('company_id', companyId)
    .eq('status', 'proposed')
    .select('*')
    .single()

  if (error || !data) {
    const after = await loadRow(supabase, companyId, actionId)
    if (after?.status === 'cancelled') return { ok: true, action: after, already: true }
    if (after?.status === 'committed') return { ok: false, error: 'invalid_transition' }
    return { ok: false, error: 'update_failed', detail: error?.message }
  }
  return { ok: true, action: data as AgentActionRow, already: false }
}

// ─── Read helpers ──────────────────────────────────────────────────

async function loadRow(
  supabase: SupabaseClient,
  companyId: string,
  actionId: string,
): Promise<AgentActionRow | null> {
  const { data } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('company_id', companyId)
    .maybeSingle()
  return (data as AgentActionRow | null) ?? null
}

/**
 * Public lookup — same contract as `loadRow` but exported for the API
 * routes to reuse without duplicating the tenant filter.
 */
export async function getAction(
  supabase: SupabaseClient,
  companyId: string,
  actionId: string,
): Promise<AgentActionRow | null> {
  return loadRow(supabase, companyId, actionId)
}

// ─── Operator-queue helpers (internal roles only) ──────────────────
//
// These bypass the per-tenant filter because the operator surface at
// `/operador/actions` is gated to operator/admin/broker roles
// (see src/lib/route-guards.ts · requireOperator). Internal roles can
// see every tenant's actions — same contract as mensajeria threads.
// NEVER call these from a client-role code path.

/**
 * Load a single action by id without the tenant filter. For use from
 * internal (operator/admin/broker) surfaces only — the calling route
 * MUST gate access via `requireOperator()` before invoking.
 */
export async function getActionAdmin(
  supabase: SupabaseClient,
  actionId: string,
): Promise<AgentActionRow | null> {
  const { data } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle()
  return (data as AgentActionRow | null) ?? null
}

export interface ListActionsAdminInput {
  statuses?: ReadonlyArray<AgentActionStatus>
  kinds?: ReadonlyArray<AgentActionKind>
  companyId?: string
  /** Hard cap to keep the page snappy. Default 200. */
  limit?: number
}

/**
 * List actions for the operator queue. No tenant filter — internal
 * only. Default sort: oldest-committed first so the FIFO gets worked.
 */
export async function listActionsAdmin(
  supabase: SupabaseClient,
  input: ListActionsAdminInput,
): Promise<AgentActionRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000)
  let q = supabase.from('agent_actions').select('*').order('created_at', { ascending: true }).limit(limit)
  if (input.statuses && input.statuses.length > 0) {
    q = q.in('status', input.statuses as string[])
  }
  if (input.kinds && input.kinds.length > 0) {
    q = q.in('kind', input.kinds as string[])
  }
  if (input.companyId) {
    q = q.eq('company_id', input.companyId)
  }
  const { data } = await q
  return (data as AgentActionRow[] | null) ?? []
}

export type MarkExecuteResult =
  | { ok: true; action: AgentActionRow; already: boolean }
  | {
      ok: false
      error: 'not_found' | 'invalid_transition' | 'update_failed'
      detail?: string
    }

/**
 * Flip `committed → executed` (or `execute_failed → executed` on retry).
 * Idempotent: a second call on an already-executed row returns
 * `already: true`. Never transitions away from `executed` or terminal
 * `cancelled`.
 */
export async function markExecuted(
  supabase: SupabaseClient,
  actionId: string,
  input: {
    executorId: string | null
    executorRole: string
    result: Record<string, unknown>
  },
): Promise<MarkExecuteResult> {
  const row = await getActionAdmin(supabase, actionId)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'executed') return { ok: true, action: row, already: true }
  if (row.status !== 'committed' && row.status !== 'execute_failed') {
    return { ok: false, error: 'invalid_transition' }
  }

  const now = new Date().toISOString()
  const nextAttempts = (row.execute_attempts ?? 0) + 1
  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: 'executed',
      executed_at: now,
      executed_by: input.executorId,
      executed_by_role: input.executorRole,
      execute_attempts: nextAttempts,
      execute_error_es: null,
      execute_result: input.result,
    })
    .eq('id', actionId)
    .in('status', ['committed', 'execute_failed'])
    .select('*')
    .single()

  if (error || !data) {
    const after = await getActionAdmin(supabase, actionId)
    if (after?.status === 'executed') return { ok: true, action: after, already: true }
    return { ok: false, error: 'update_failed', detail: error?.message }
  }
  return { ok: true, action: data as AgentActionRow, already: false }
}

/**
 * Flip `committed → execute_failed` (or keep it in execute_failed on
 * repeated failure). Records the error so the queue surface can show
 * why the retry is needed.
 */
export async function markExecuteFailed(
  supabase: SupabaseClient,
  actionId: string,
  input: {
    executorId: string | null
    executorRole: string
    errorEs: string
  },
): Promise<MarkExecuteResult> {
  const row = await getActionAdmin(supabase, actionId)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status === 'executed' || row.status === 'cancelled') {
    return { ok: false, error: 'invalid_transition' }
  }

  const nextAttempts = (row.execute_attempts ?? 0) + 1
  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: 'execute_failed',
      executed_by: input.executorId,
      executed_by_role: input.executorRole,
      execute_attempts: nextAttempts,
      execute_error_es: input.errorEs.slice(0, 500),
    })
    .eq('id', actionId)
    .in('status', ['committed', 'execute_failed'])
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: 'update_failed', detail: error?.message }
  }
  return { ok: true, action: data as AgentActionRow, already: false }
}
