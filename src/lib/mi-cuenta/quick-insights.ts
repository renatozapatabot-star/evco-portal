/**
 * PORTAL · /mi-cuenta — Quick Insights card data.
 *
 * Three signals, one card:
 *   1. Automation score — how much of the client's recent operation
 *      CRUZ handled without a human. Reuses `getCruzMetrics` when the
 *      agent tables exist; silent null when they don't (pre-launch
 *      tenants with no agent_actions rows yet).
 *   2. Shipments this calendar month — soft-counted from `traficos`
 *      using America/Chicago month boundaries (Laredo timezone per
 *      customs contract).
 *   3. Proactive insight — one calm sentence. Priority order is
 *      deterministic so the card doesn't flicker between renders:
 *        a) Strong automation (≥60%) → celebrate it
 *        b) Large aged A/R (61+ with > 1 invoice) → offer Anabel
 *        c) Healthy month with shipments → calm positive
 *        d) Pre-activation (zero signals) → gentle onboarding note
 *
 * Contract:
 *   - No DB write. All reads soft-wrapped — one failing signal never
 *     breaks the card.
 *   - Tenant-scoped by companyId.
 *   - Output is JSON-serializable so the server component can pass it
 *     to a client island if/when needed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { softCount, softData } from '@/lib/cockpit/safe-query'
import type { AgingResult } from '@/lib/contabilidad/aging'

export type QuickInsightTone = 'calm' | 'positive' | 'informative'

export interface QuickInsightsPayload {
  /** 0–100. Null when no agent-action data is available yet. */
  automationPct: number | null
  /** Month-to-date shipment count in America/Chicago. */
  shipmentsThisMonth: number
  /** One proactive copy line + its tone for chrome choice. */
  proactiveInsight: {
    id: string
    tone: QuickInsightTone
    text: string
  }
  /** ISO timestamp — useful for cache headers later. */
  generatedAt: string
}

function startOfMonthLaredo(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value ?? '1970'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  return `${year}-${month}-01T00:00:00-06:00`
}

/**
 * Build the proactive insight copy from the three loaded signals.
 * Pure function — testable, no IO.
 */
export function buildProactiveInsight(args: {
  automationPct: number | null
  shipmentsThisMonth: number
  aging: Pick<AgingResult, 'total' | 'count' | 'byBucket'> | null
}): QuickInsightsPayload['proactiveInsight'] {
  const { automationPct, shipmentsThisMonth, aging } = args

  if (automationPct !== null && automationPct >= 60) {
    return {
      id: 'automation_strong',
      tone: 'positive',
      text: `CRUZ resolvió automáticamente el ${automationPct}% de tu operación reciente.`,
    }
  }

  const oldCount = aging
    ? (aging.byBucket.find(b => b.bucket === '61-90')?.count ?? 0) +
      (aging.byBucket.find(b => b.bucket === '90+')?.count ?? 0)
    : 0
  if (oldCount > 1) {
    return {
      id: 'aging_aware',
      tone: 'informative',
      text: `Tienes ${oldCount} facturas con más de 60 días — Anabel puede organizar contigo el plan de pago.`,
    }
  }

  if (shipmentsThisMonth > 0) {
    return {
      id: 'month_active',
      tone: 'calm',
      text: `Este mes registramos ${shipmentsThisMonth} embarque${
        shipmentsThisMonth === 1 ? '' : 's'
      } para ti — todo en cadencia.`,
    }
  }

  return {
    id: 'quiet_state',
    tone: 'calm',
    text: 'Tu operación está en calma. Cuando llegue tu próximo embarque lo verás aquí primero.',
  }
}

export async function computeQuickInsights(
  supabase: SupabaseClient,
  companyId: string,
  aging: Pick<AgingResult, 'total' | 'count' | 'byBucket'> | null = null,
): Promise<QuickInsightsPayload> {
  const now = new Date()
  const monthStart = startOfMonthLaredo(now)

  const shipmentsThisMonth = await softCount(
    supabase
      .from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_llegada', monthStart),
    { label: 'quick-insights.traficos.month', timeoutMs: 3000 },
  )

  // Automation score — inline 30-day window over agent_actions. Tracks
  // the same semantic the /admin/cruz-metrics dashboard uses (commit
  // rate = committed / proposed) but scoped to this tenant so the
  // client's card reflects THEIR operation, not broker-wide aggregate.
  // Soft-wrapped: if agent_actions doesn't exist yet for this tenant,
  // we surface `null` (not 0) so the UI renders "—" instead of a
  // misleading zero score.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const actions = await softData<{ status: string }>(
    supabase
      .from('agent_actions')
      .select('status')
      .eq('company_id', companyId)
      .gte('created_at', thirtyDaysAgo)
      .limit(5000),
    { label: 'quick-insights.agent_actions.window', timeoutMs: 3000 },
  )
  let automationPct: number | null = null
  if (actions.length > 0) {
    const committed = actions.filter(a => a.status === 'committed').length
    automationPct = Math.round((committed / actions.length) * 100)
  }

  const proactiveInsight = buildProactiveInsight({
    automationPct,
    shipmentsThisMonth,
    aging,
  })

  return {
    automationPct,
    shipmentsThisMonth,
    proactiveInsight,
    generatedAt: now.toISOString(),
  }
}
