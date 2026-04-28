/**
 * PORTAL · /mi-cuenta/cruz — safe client-facing assistant.
 *
 * The regular /cruz surface is right for operators + the owner (50
 * tools, write actions, draft approvals). This surface is right for
 * Ursula and every future client: read-only tools, calm tone, own
 * data only, Mensajería CTA instead of automated dispatch. See
 * `src/lib/mi-cuenta/cruz-safe.ts` for the contract.
 *
 * Gating layers:
 *   1. Page-level: resolveMiCuentaCruzAccess (no session → /login,
 *      client + flag OFF → /inicio, unknown role → /login).
 *   2. Cookie forgery fence: tenancy reads from the HMAC session.
 *   3. API-level: /api/cruz-chat re-checks the feature flag + role
 *      when mode === 'mi-cuenta-safe' (belt + suspenders).
 *   4. Tool-level: cruz-chat intersects tools with
 *      SAFE_CLIENT_TOOL_NAMES before every model call AND refuses
 *      non-safe tools at the executor gate.
 *
 * This page also pre-computes `SuggestedQuestionsContext` server-side
 * so the chat surface can render personalized chips above the input
 * on first paint — no client-side round-trip for the personalization.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { resolveMiCuentaCruzAccess } from '@/lib/mi-cuenta/cruz-safe'
import { resolveMiCuentaAccess } from '../access'
import { computeARAging } from '@/lib/contabilidad/aging'
import {
  FEATURE_FLAG_OVERRIDE_COOKIE,
  isFlagEffective,
  parseOverrideCookie,
} from '@/lib/admin/feature-flags'
import {
  buildSuggestedQuestions,
  type SuggestedQuestion,
  type SuggestedQuestionsContext,
} from '@/lib/mi-cuenta/suggested-questions'
import { softData } from '@/lib/cockpit/safe-query'
import MiCuentaCruzChat from './MiCuentaCruzChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MiCuentaCruzPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  // The flag default is env-var only. Internal roles can additionally
  // opt-in to a preview via /admin/feature-flags (cookie override
  // honored only for admin/broker/operator/contabilidad sessions).
  // Client role never picks up the override, so this cannot widen
  // client exposure — it only lets Tito/Renato IV preview the gate
  // state on their own browser before the env var flips.
  const overrides = parseOverrideCookie(cookieStore.get(FEATURE_FLAG_OVERRIDE_COOKIE)?.value)
  const effectiveFlag = isFlagEffective({
    key: 'mi_cuenta_cruz_enabled',
    overrides,
    role: session?.role ?? null,
  })

  const access = resolveMiCuentaCruzAccess(session, effectiveFlag)
  if (access.decision === 'redirect') {
    redirect(access.to)
  }
  if (!session) redirect('/login')

  // Personalized chips — server-rendered so the first paint already
  // includes them. All IO is soft-wrapped; a failing signal falls
  // through to calm-state fallbacks inside the builder.
  const suggestions = await loadSuggestions(session)

  return <MiCuentaCruzChat isClient={access.isClient} suggestions={suggestions} />
}

async function loadSuggestions(session: {
  role: string
  companyId: string
}): Promise<SuggestedQuestion[]> {
  try {
    const supabase = createServerClient()

    // Reuse the /mi-cuenta access resolver so scoping matches across
    // the two client surfaces. Internal QA sessions still get tenant-
    // scoped chips (their own companyId), preventing a broker preview
    // from seeing chips built on aggregate A/R that a real client
    // would never see.
    const miCuentaAccess = resolveMiCuentaAccess(
      { role: session.role, companyId: session.companyId },
      true,
    )
    if (miCuentaAccess.decision !== 'render') return defaultSuggestions()

    const { scopedCompanyId, companyId } = miCuentaAccess

    const [ar, lastTrafico, shipmentCount] = await Promise.all([
      safeAging(supabase, scopedCompanyId),
      safeLastTraficoId(supabase, companyId),
      safeShipmentsThisMonth(supabase, companyId),
    ])

    const oldCount =
      (ar?.byBucket.find(b => b.bucket === '61-90')?.count ?? 0) +
      (ar?.byBucket.find(b => b.bucket === '90+')?.count ?? 0)

    const ctx: SuggestedQuestionsContext = {
      arTotalMxn: ar?.total ?? 0,
      arOldCount: oldCount,
      lastTraficoId: lastTrafico,
      shipmentsThisMonth: shipmentCount,
      // MVP: the carrier-risk heuristic needs a per-carrier baseline
      // that isn't wired yet. Chip stays dormant until we have a
      // stable inspection-rate signal; the builder handles false
      // correctly (prompt suppressed) so no dead chip ever renders.
      hasRiskyCarrier: false,
      clientShortName: null,
    }
    return buildSuggestedQuestions(ctx)
  } catch {
    return defaultSuggestions()
  }
}

function defaultSuggestions(): SuggestedQuestion[] {
  return buildSuggestedQuestions({
    arTotalMxn: 0,
    arOldCount: 0,
    lastTraficoId: null,
    shipmentsThisMonth: 0,
    hasRiskyCarrier: false,
    clientShortName: null,
  })
}

async function safeAging(
  supabase: ReturnType<typeof createServerClient>,
  scopedCompanyId: string | null,
) {
  // Broker/admin passes null here (aggregate scope). We don't surface
  // aggregate A/R in the suggestion chips because the client-facing
  // prompts would leak broker-wide counts — skip aging entirely for
  // internal scoped=null sessions.
  if (scopedCompanyId === null) return null
  try {
    return await computeARAging(supabase, scopedCompanyId)
  } catch {
    return null
  }
}

async function safeLastTraficoId(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
): Promise<string | null> {
  const rows = await softData<{ trafico: string | null }>(
    supabase
      .from('traficos')
      .select('trafico')
      .eq('company_id', companyId)
      .order('fecha_llegada', { ascending: false, nullsFirst: false })
      .limit(1),
    { label: 'suggestions.last-trafico', timeoutMs: 2500 },
  )
  return rows[0]?.trafico ?? null
}

async function safeShipmentsThisMonth(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
): Promise<number> {
  const monthStart = startOfMonthLaredoISO(new Date())
  try {
    const { count } = await supabase
      .from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_llegada', monthStart)
    return count ?? 0
  } catch {
    return 0
  }
}

function startOfMonthLaredoISO(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value ?? '1970'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  return `${year}-${month}-01T00:00:00-06:00`
}
