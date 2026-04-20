/**
 * Tenant-scope resolution — single source of truth for "which companyId
 * should this API request filter by?"
 *
 * The rule surfaces two distinct threat models:
 *
 *   1. Client role (Ursula / EVCO / any tenant user)
 *      · session is authoritative
 *      · cookies + query params are IGNORED
 *      · a client passing ?company_id=mafesa or forging a cookie
 *        never escapes their own tenant
 *      · this is the SEV-1 fence (core-invariants rule 15)
 *
 *   2. Internal role (admin, broker, operator, contabilidad, owner)
 *      · query param preferred — explicit oversight signal
 *      · cookie fallback — powers the admin "view as client" feature
 *        at /api/auth/view-as which SETS the company_id cookie
 *        to swap identity for the duration of the session
 *      · session.companyId last-resort fallback (e.g. 'admin' /
 *        'internal' placeholders that won't match real data)
 *      · cookie trust for internal roles is NOT a forgery vector —
 *        an admin can already impersonate any company via
 *        /api/auth/view-as; the cookie is just the persistence
 *        mechanism of that deliberate choice
 *
 * Usage:
 *
 *   import { resolveTenantScope } from '@/lib/api/tenant-scope'
 *
 *   const companyId = resolveTenantScope(session, req)
 *   if (!companyId) return NextResponse.json(
 *     { error: 'Tenant scope required' }, { status: 400 },
 *   )
 *
 *   const { data } = await supabase.from('traficos')
 *     .select('*').eq('company_id', companyId).limit(50)
 */

import type { NextRequest } from 'next/server'

export const INTERNAL_ROLES = new Set([
  'admin', 'broker', 'operator', 'contabilidad', 'owner',
])

export interface SessionLike {
  role: string
  companyId: string
}

/**
 * Resolve the tenant scope for an API request. Returns the empty string
 * if no valid scope can be determined (caller should 400).
 *
 * For client role: always session.companyId (never consults cookies
 * or query params — they'd be a forgery vector).
 *
 * For internal roles: prefers ?company_id= query param, falls back to
 * the company_id cookie (set by /api/auth/view-as), falls back to
 * session.companyId. Cookie trust here is scoped to already-admin
 * callers — a client cannot reach this branch.
 */
export function resolveTenantScope(
  session: SessionLike | null,
  req: NextRequest,
): string {
  if (!session) return ''
  if (session.role === 'client') {
    return session.companyId || ''
  }
  if (INTERNAL_ROLES.has(session.role)) {
    const paramCompanyId = req.nextUrl.searchParams.get('company_id') || ''
    const cookieCompanyId = req.cookies.get('company_id')?.value || ''
    return paramCompanyId || cookieCompanyId || session.companyId || ''
  }
  // Unknown role — fail closed (empty scope → 400 at caller).
  return ''
}

/**
 * Convenience: boolean for "is this an internal role that can be
 * granted cross-tenant aggregation / oversight."
 */
export function isInternalRole(session: SessionLike | null): boolean {
  return !!session && INTERNAL_ROLES.has(session.role)
}
