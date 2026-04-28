/**
 * Operator-role route guard — V1 Clean Visibility (2026-04-24).
 *
 * Applied at the top of any server component under src/app/ that should
 * NOT render for the client role (mi-cuenta, contabilidad, cruz, demo,
 * ahorro, analytics, kpis, and ~20 other V2/internal routes). Returns
 * notFound() for client role; otherwise resolves the session for use by
 * the caller.
 *
 * Usage:
 *   // At the top of a server component
 *   const session = await requireOperatorRole()
 *
 * If the client hits the route directly, Next.js renders the app's
 * not-found UI. No redirect — we want the URL to look broken for
 * non-authorized roles, not to quietly bounce them elsewhere.
 *
 * HARD invariants preserved:
 *   - Tenant isolation: this does not read/bypass session.companyId;
 *     caller still filters queries by companyId as usual.
 *   - Approval gate: caller is still responsible for client-surface
 *     copy and the 5-sec cancel window on any automation they trigger.
 *   - Audit: add an `audit_log` entry if the caller is an internal
 *     admin surface reading cross-client data (not this helper's job).
 */

import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'

export const OPERATOR_ROLES: ReadonlySet<string> = new Set([
  'operator',
  'admin',
  'broker',
  'owner',
  'warehouse',
  'contabilidad',
])

export type InternalSession = Awaited<ReturnType<typeof verifySession>>

/**
 * Verifies the caller holds an operator-tier role. If not, triggers a
 * 404 via next/navigation's notFound() — this throws and never returns.
 * Caller can rely on the return value being a valid internal session.
 */
export async function requireOperatorRole(): Promise<NonNullable<InternalSession>> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session || !OPERATOR_ROLES.has(session.role)) {
    notFound()
  }
  return session
}

/**
 * Non-throwing variant — returns a boolean so a component can render
 * partial UI for client role without 404ing the whole route. Prefer
 * requireOperatorRole() when the entire route should be invisible to
 * clients; use this when only a sub-section is operator-only.
 */
export async function isOperator(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  return Boolean(session && OPERATOR_ROLES.has(session.role))
}
