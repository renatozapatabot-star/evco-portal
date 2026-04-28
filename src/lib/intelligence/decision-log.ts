/**
 * decision-log.ts — persistent record of every agent / CRUZ AI call.
 *
 * Phase 3 #3: captures the structured history that Phase 3 #5's learning
 * loop will need to compare past predictions against actual outcomes.
 * Every row carries enough context to:
 *   - Replay the exact tool call (tool_name + tool_input)
 *   - See what the agent proposed (tool_output + decision + reasoning)
 *   - Attach human feedback after the fact (human_feedback)
 *   - Attach the real-world outcome once observed (outcome)
 *
 * The primitives below are:
 *   - `logDecision(sb, entry)` — raw insert, returns the inserted id or null
 *   - `withDecisionLog(sb, ctx, fn)` — HOF wrapping any async fn with timing
 *   - `getRecentDecisions(sb, companyId, opts?)` — latest N for a tenant
 *   - `getDecisionHistory(sb, opts?)` — filtered query by tool / workflow / date
 *   - `recordOutcome(sb, id, outcome)` — late-binding outcome write
 *   - `recordHumanFeedback(sb, id, feedback)` — reviewer capture
 *
 * Design notes:
 *   - Tenant-isolated. Every query takes `companyId` explicitly. No
 *     defaults, no "current tenant" magic. Callers thread the scope.
 *   - Error-swallowing on write. Telemetry that breaks the caller is
 *     worse than telemetry that silently misses. Insert failures are
 *     console.error'd + returned as null; queries return [] on failure.
 *     The morning briefing keeps sending even if the log insert trips.
 *   - Deterministic size control. `tool_input` / `tool_output` go through
 *     `truncateJson` (default 8KB) before insert so a pathological tool
 *     output can't blow past the Supabase jsonb 1GB limit or bloat the
 *     row beyond what an operator wants to look at.
 *   - No writes beyond the log table. This module does NOT read or
 *     mutate any tenant data — the caller did that already.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────

export interface DecisionLogEntry {
  /** Logical cycle this entry belongs to (e.g. one briefing run). */
  cycle_id?: string | null
  /** How the tool was invoked. */
  trigger_type:
    | 'cron'
    | 'api'
    | 'chat'
    | 'script'
    | 'admin'
    | 'test'
    | string
  /** Identifier of the triggering context (e.g. a trafico id, user id). */
  trigger_id?: string | null
  company_id: string
  /** Higher-level workflow label (e.g. 'morning_briefing', 'shipment_review'). */
  workflow?: string | null
  /** CRUZ AI tool or agent-mode label (e.g. 'analyze_trafico'). */
  tool_name?: string | null
  /** Structured input arguments. Strip secrets before passing. */
  tool_input?: unknown
  /** Structured output the tool emitted. */
  tool_output?: unknown
  /** One-line headline for the decision (kept narrow for easy scanning). */
  decision: string
  /** Longer rationale / plain-text body. */
  reasoning?: string | null
  /** 0..1 — deterministic formatters should set 1.0. */
  confidence?: number | null
  /** 0 = propose-only · 1+ = higher-autonomy actions. */
  autonomy_level?: number | null
  /** What the surrounding I/O did ('telegram_sent', 'dry_run', etc.). */
  action_taken?: string | null
  /** Elapsed ms from start to response. */
  processing_ms?: number | null
}

export interface HumanFeedback {
  sentiment: 'positive' | 'negative' | 'neutral'
  note_es?: string
  reviewer_id?: string
  corrected_action_es?: string
  /** Set server-side on insert. */
  reviewed_at?: string
}

export interface ToolCallContext {
  /** Tenant this call is scoped to. */
  companyId: string
  /** CRUZ AI tool / agent-mode name. */
  toolName: string
  /** Higher-level workflow wrapping the call (optional). */
  workflow?: string
  /** Triggering context (e.g. trafico id, pedimento number, user id). */
  triggerId?: string
  triggerType?: DecisionLogEntry['trigger_type']
  /** Argument object the caller passed. Strip secrets before handing in. */
  toolInput?: unknown
  /** Optional cycle id tying a group of calls together. */
  cycleId?: string
  /** Optional decision headline. Defaults to `tool_name executed` when omitted. */
  decisionOverride?: string
  autonomyLevel?: number
}

export interface QueryOptions {
  limit?: number
  /** Upper bound on `created_at` (ISO string). */
  before?: string
  /** Lower bound on `created_at` (ISO string). */
  after?: string
  /** Filter by tool_name. */
  toolName?: string
  /** Filter by workflow. */
  workflow?: string
  /** Filter by outcome value. */
  outcome?: string
  /** Only rows missing an outcome (for the learning-loop backlog). */
  outcomePending?: boolean
}

/** Row shape returned by queries. Narrower than the raw DB row. */
export interface DecisionRow {
  id: string
  created_at: string
  company_id: string
  tool_name: string | null
  workflow: string | null
  trigger_type: string | null
  trigger_id: string | null
  decision: string | null
  reasoning: string | null
  confidence: number | null
  autonomy_level: number | null
  action_taken: string | null
  processing_ms: number | null
  tool_input: unknown
  tool_output: unknown
  human_feedback: HumanFeedback | null
  outcome: string | null
  outcome_recorded_at: string | null
}

// ── Core primitives ───────────────────────────────────────────────

const MAX_JSON_BYTES = 8 * 1024

/** Truncate a JSON-serializable value if it exceeds `maxBytes` UTF-8 bytes. */
export function truncateJson<T>(value: T, maxBytes = MAX_JSON_BYTES): unknown {
  try {
    const str = JSON.stringify(value)
    if (!str) return value
    const byteLen = Buffer.byteLength(str, 'utf8')
    if (byteLen <= maxBytes) return value
    return {
      _truncated: true,
      _original_bytes: byteLen,
      _preview: str.slice(0, Math.max(0, maxBytes - 200)) + '…',
    }
  } catch {
    return { _serialize_failed: true }
  }
}

/**
 * Insert a decision-log row. Returns the inserted id, or null if the
 * insert failed (error is logged but not thrown).
 */
export async function logDecision(
  supabase: SupabaseClient,
  entry: DecisionLogEntry,
): Promise<string | null> {
  const row = {
    cycle_id: entry.cycle_id ?? null,
    trigger_type: entry.trigger_type,
    trigger_id: entry.trigger_id ?? null,
    company_id: entry.company_id,
    workflow: entry.workflow ?? null,
    tool_name: entry.tool_name ?? null,
    tool_input: entry.tool_input === undefined ? null : truncateJson(entry.tool_input),
    tool_output: entry.tool_output === undefined ? null : truncateJson(entry.tool_output),
    decision: entry.decision,
    reasoning: entry.reasoning ?? null,
    confidence: entry.confidence ?? null,
    autonomy_level: entry.autonomy_level ?? 0,
    action_taken: entry.action_taken ?? null,
    processing_ms: entry.processing_ms ?? null,
  }

  try {
    const { data, error } = await supabase
      .from('agent_decisions')
      .insert(row)
      .select('id')
      .single()
    if (error) {
      console.error('[decision-log] insert failed:', error.message)
      return null
    }
    return ((data as { id?: string } | null)?.id) ?? null
  } catch (err) {
    console.error(
      '[decision-log] insert threw:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

/**
 * Wrap any async function with decision logging. Records timing,
 * inputs, and a deterministic summary of the output. Returns the
 * original function's return value unchanged — logging failures never
 * affect the caller.
 *
 * Usage:
 *   const result = await withDecisionLog(sb, {
 *     companyId: 'evco',
 *     toolName: 'analyze_trafico',
 *     toolInput: { traficoId: 'T-1' },
 *   }, () => analyzeTrafico(sb, 'evco', 'T-1'))
 */
export async function withDecisionLog<T>(
  supabase: SupabaseClient,
  ctx: ToolCallContext,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  let safeResult: unknown = undefined
  let errorMessage: string | null = null
  let threw = false

  try {
    const result = await fn()
    safeResult = result
    return result
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
    threw = true
    throw err
  } finally {
    const processing_ms = Date.now() - startedAt
    const decision =
      ctx.decisionOverride ??
      summarizeDecision(ctx.toolName, threw ? undefined : safeResult, errorMessage)

    // Await so row ordering stays stable in tests; `logDecision` swallows
    // its own errors so this `await` can never reject.
    await logDecision(supabase, {
      cycle_id: ctx.cycleId ?? null,
      trigger_type: ctx.triggerType ?? 'chat',
      trigger_id: ctx.triggerId ?? null,
      company_id: ctx.companyId,
      workflow: ctx.workflow ?? null,
      tool_name: ctx.toolName,
      tool_input: ctx.toolInput,
      tool_output: threw ? undefined : safeResult,
      decision,
      reasoning: errorMessage ?? null,
      confidence: 1.0,
      autonomy_level: ctx.autonomyLevel ?? 0,
      action_taken: errorMessage ? `error:${errorMessage.slice(0, 80)}` : 'completed',
      processing_ms,
    })
  }
}

/** Pick a short decision headline from a tool response. Best-effort. */
function summarizeDecision(
  toolName: string,
  output: unknown,
  errorMessage: string | null,
): string {
  if (errorMessage) return `${toolName}: error`
  if (!output || typeof output !== 'object') return `${toolName}: completed`

  const candidates = [
    (output as { data?: { headline_es?: string } }).data?.headline_es,
    (output as { headline_es?: string }).headline_es,
    (output as { summary_es?: string }).summary_es,
    (output as { data?: { summary_es?: string } }).data?.summary_es,
    (output as { data?: { type?: string } }).data?.type,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0)

  return candidates[0] ? `${toolName}: ${candidates[0]}` : `${toolName}: completed`
}

// ── Queries ───────────────────────────────────────────────────────

const COLUMNS =
  'id, created_at, company_id, tool_name, workflow, trigger_type, trigger_id, ' +
  'decision, reasoning, confidence, autonomy_level, action_taken, processing_ms, ' +
  'tool_input, tool_output, human_feedback, outcome, outcome_recorded_at'

/**
 * Latest decisions for a tenant (newest first). Safe default for
 * dashboards + CRUZ AI "what did we do recently" questions.
 */
export async function getRecentDecisions(
  supabase: SupabaseClient,
  companyId: string,
  opts: { limit?: number } = {},
): Promise<DecisionRow[]> {
  if (!companyId) return []
  const limit = clampLimit(opts.limit ?? 20)
  try {
    const { data, error } = await supabase
      .from('agent_decisions')
      .select(COLUMNS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('[decision-log] getRecentDecisions failed:', error.message)
      return []
    }
    return (data ?? []) as unknown as DecisionRow[]
  } catch (err) {
    console.error(
      '[decision-log] getRecentDecisions threw:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/**
 * Filtered history query. companyId remains required (tenant isolation
 * at the module boundary); all other filters are optional.
 */
export async function getDecisionHistory(
  supabase: SupabaseClient,
  companyId: string,
  opts: QueryOptions = {},
): Promise<DecisionRow[]> {
  if (!companyId) return []
  const limit = clampLimit(opts.limit ?? 50)
  try {
    let query = supabase
      .from('agent_decisions')
      .select(COLUMNS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (opts.toolName) query = query.eq('tool_name', opts.toolName)
    if (opts.workflow) query = query.eq('workflow', opts.workflow)
    if (opts.before) query = query.lt('created_at', opts.before)
    if (opts.after) query = query.gt('created_at', opts.after)
    if (opts.outcome) query = query.eq('outcome', opts.outcome)
    if (opts.outcomePending) query = query.is('outcome', null)

    const { data, error } = await query
    if (error) {
      console.error('[decision-log] getDecisionHistory failed:', error.message)
      return []
    }
    return (data ?? []) as unknown as DecisionRow[]
  } catch (err) {
    console.error(
      '[decision-log] getDecisionHistory threw:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/**
 * Record the real-world outcome of a prior decision. Phase 3 #5
 * learning loop is the primary caller (when a predicted-verde SKU
 * actually crosses, we update the row so the loop can measure hit rate).
 */
export async function recordOutcome(
  supabase: SupabaseClient,
  decisionId: string,
  outcome: string,
): Promise<boolean> {
  if (!decisionId || !outcome) return false
  try {
    const { error } = await supabase
      .from('agent_decisions')
      .update({
        outcome,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', decisionId)
    if (error) {
      console.error('[decision-log] recordOutcome failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error(
      '[decision-log] recordOutcome threw:',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

/**
 * Attach reviewer feedback to a prior decision. Called from admin UI /
 * Mensajería review flow once a human has seen the proposed action.
 */
export async function recordHumanFeedback(
  supabase: SupabaseClient,
  decisionId: string,
  feedback: HumanFeedback,
): Promise<boolean> {
  if (!decisionId) return false
  const payload: HumanFeedback = {
    ...feedback,
    reviewed_at: feedback.reviewed_at ?? new Date().toISOString(),
  }
  try {
    const { error } = await supabase
      .from('agent_decisions')
      .update({ human_feedback: payload })
      .eq('id', decisionId)
    if (error) {
      console.error('[decision-log] recordHumanFeedback failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error(
      '[decision-log] recordHumanFeedback threw:',
      err instanceof Error ? err.message : String(err),
    )
    return false
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function clampLimit(n: number | undefined): number {
  const v = Number(n ?? 20)
  if (!Number.isFinite(v)) return 20
  return Math.max(1, Math.min(500, Math.floor(v)))
}
