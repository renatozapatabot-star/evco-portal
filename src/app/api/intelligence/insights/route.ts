/**
 * GET /api/intelligence/insights?company_id=X&window=N
 *
 * V2 intelligence layer entry point. Returns the `InsightsPayload`
 * from lib/intelligence/crossing-insights — green streaks, broken
 * streaks, proveedor health, and rule-based anomalies for the tenant
 * scoped by the caller's session.
 *
 * Admin + broker override (via ?company_id=) lets operators inspect
 * any tenant's insights for oversight — mirrors the /api/catalogo/partes
 * pattern. Client sessions ignore the override param (no escalation).
 *
 * Response: ApiResponse<InsightsPayload>
 *   - 200 { data, error: null } on success
 *   - 401 { data: null, error: UNAUTHORIZED } if no session
 *   - 400 { data: null, error: VALIDATION_ERROR } on invalid window
 *
 * Cache-Control: private, max-age=60 — insights recompute in ~500ms
 * on a 90-day window, so a minute of edge caching smooths the
 * dashboard poll without hiding anomalies.
 */

import { NextRequest } from 'next/server'
import { requireAdminSession } from '@/lib/auth/session-guards'
import { ok, validationError, internalError } from '@/lib/api/response'
import { createServerClient } from '@/lib/supabase-server'
import { getCrossingInsights } from '@/lib/intelligence/crossing-insights'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { session, error: authError } = await requireAdminSession()
  if (authError) return authError

  const paramCompany = req.nextUrl.searchParams.get('company_id')?.trim()
  const isInternal = session.role === 'admin' || session.role === 'broker'
  // Admin oversight override — client sessions ignore the query param.
  const companyId = isInternal && paramCompany ? paramCompany : session.companyId

  const windowParam = req.nextUrl.searchParams.get('window')
  let windowDays = 90
  if (windowParam) {
    const parsed = Number.parseInt(windowParam, 10)
    if (!Number.isFinite(parsed) || parsed < 7 || parsed > 365) {
      return validationError('window_out_of_range_7_to_365')
    }
    windowDays = parsed
  }

  try {
    const supabase = createServerClient()
    const payload = await getCrossingInsights(supabase, companyId, { windowDays })
    return ok(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'insights_failed'
    return internalError(msg)
  }
}
