/**
 * DailyWorkflowsWidget — dashboard surface for the 3 Killer Daily
 * Driver Workflows.
 *
 * Composition:
 *   · Server wrapper resolves session + loads findings via the
 *     shared `listFindings` helper.
 *   · Client child `DailyWorkflowsPanel` owns expand/collapse,
 *     feedback submission, and optimistic status transitions.
 *
 * Shadow-mode banner is always present so Ursula never mistakes
 * these cards for live actions. Copy tone follows
 * `client-accounting-ethics.md` — informational, never dunning.
 */

import { createServerClient } from '@/lib/supabase-server'
import { isShadowModeCompany } from '@/lib/workflows/scope'
import { listFindings, summarize } from '@/lib/workflows/query'
import { DailyWorkflowsPanel } from './DailyWorkflowsPanel'

export interface DailyWorkflowsWidgetProps {
  companyId: string
  role: string
  limit?: number
}

export async function DailyWorkflowsWidget({
  companyId,
  role,
  limit = 12,
}: DailyWorkflowsWidgetProps) {
  if (!isShadowModeCompany(companyId)) return null

  const supabase = createServerClient()
  const [findings, summary] = await Promise.all([
    listFindings(supabase, companyId, { limit }),
    summarize(supabase, companyId),
  ])

  return (
    <DailyWorkflowsPanel
      companyId={companyId}
      role={role}
      findings={findings}
      summary={summary}
    />
  )
}
