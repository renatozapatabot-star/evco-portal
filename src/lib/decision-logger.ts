/**
 * V1 Polish Pack · Block 1 — TS mirror of scripts/decision-logger.js.
 *
 * Writes to `operational_decisions` (CRUZ Operational Brain — see
 * supabase/migrations/20260406_operational_brain.sql) so decisions
 * made through the portal share the same reasoning trail as those
 * made by pm2 scripts and cron jobs.
 *
 * Service-role client. Never import this from a client component.
 * Follow the project error convention: return { error }, never throw.
 */

import { createServerClient } from '@/lib/supabase-server'

export type DecisionAlternative = {
  option: string
  score?: number
  reason_rejected?: string
}

export interface LogDecisionInput {
  trafico?: string | null
  company_id?: string | null
  decision_type: string
  decision: string
  reasoning?: string | null
  alternatives?: DecisionAlternative[] | null
  dataPoints?: Record<string, unknown> | null
}

export interface LogDecisionResult {
  ok: boolean
  error: { code: string; message: string } | null
}

export async function logDecision(input: LogDecisionInput): Promise<LogDecisionResult> {
  if (!input.decision_type || !input.decision) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'decision_type and decision are required' } }
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('operational_decisions').insert({
    trafico: input.trafico ?? null,
    company_id: input.company_id ?? null,
    decision_type: input.decision_type,
    decision: input.decision,
    reasoning: input.reasoning ?? null,
    alternatives_considered: input.alternatives ? JSON.stringify(input.alternatives) : null,
    data_points_used: input.dataPoints ? JSON.stringify(input.dataPoints) : null,
  })

  if (error) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }
  }
  return { ok: true, error: null }
}
