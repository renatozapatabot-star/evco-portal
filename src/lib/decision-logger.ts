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
 *
 * Tenant-tagging guard (added 2026-04-29): every insert normalizes
 * company_id through the slug allowlist. NULL is preserved (system-level
 * decisions intentionally don't have a tenant scope). Clave-shape values
 * are remapped or rejected — never silently passed through. See the
 * 2026-04-29 audit + scripts/lib/tenant-tags.js for the cron twin.
 */

import { createServerClient } from '@/lib/supabase-server'
import { buildClaveMap, resolveCompanyIdSlug } from '@/lib/tenant/resolve-slug'

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

  // NULL company_id is the documented "system-level decision" sentinel and
  // is preserved as-is. Any non-null value goes through the normalizer so a
  // clave-shape input (e.g. legacy '9254') gets remapped to its slug. If
  // resolution fails, prefer NULL over a bad write — the audit trail is
  // strict-append, downstream filters can recover.
  let normalizedCompanyId: string | null = null
  if (input.company_id !== undefined && input.company_id !== null) {
    const claveMap = await buildClaveMap(supabase)
    const resolved = resolveCompanyIdSlug(input.company_id, claveMap)
    if (resolved.kind === 'resolved') {
      normalizedCompanyId = resolved.slug
    } else {
      console.warn(
        `[decision-logger] company_id ${String(input.company_id)} unresolvable (${resolved.reason}) — writing NULL`,
      )
    }
  }

  const { error } = await supabase.from('operational_decisions').insert({
    trafico: input.trafico ?? null,
    company_id: normalizedCompanyId,
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
