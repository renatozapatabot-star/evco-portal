/**
 * Session guards — the canonical way to gate a route handler by role.
 *
 * Why this file exists:
 *   The same `requireAdminSession()` helper was copy-pasted across
 *   /api/leads/*, /api/leads/[id]/*, /api/leads/[id]/activities,
 *   /api/leads/[id]/convert, /api/leads/export. Every copy reached
 *   into `next/headers` + `@/lib/session` + hardcoded the
 *   `['admin', 'broker']` role list. Adding a new role (or changing
 *   the logout/session shape) meant editing every copy. This module
 *   collapses them.
 *
 * Why not middleware:
 *   Middleware runs BEFORE the route handler resolves `await params`
 *   — so it can't easily scope a 404-vs-401 decision (which might
 *   depend on the resource). Route-handler-level guards give that
 *   decision point with minimal boilerplate.
 *
 * Contract:
 *   Each guard returns either `{ session, error: null }` on success
 *   or `{ session: null, error: NextResponse }` on failure. The
 *   route handler immediately returns the error when present; this
 *   keeps success-path code unindented and ensures every handler
 *   follows the canonical { data, error } response shape.
 *
 * Usage in a route handler:
 *
 *   export async function POST(req: Request) {
 *     const { session, error } = await requireAdminSession()
 *     if (error) return error
 *     // session is now non-null, session.role is 'admin' | 'broker'
 *   }
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import type { PortalRole } from '@/lib/session'

export interface SessionShape {
  companyId: string
  role: PortalRole
  expiresAt: number
}

export interface GuardSuccess {
  session: SessionShape
  error: null
}

export interface GuardFailure {
  session: null
  error: NextResponse
}

export type GuardResult = GuardSuccess | GuardFailure

/**
 * Canonical 401 response. Matches the repo-wide `{ data, error }`
 * shape so every rejected request looks identical on the wire —
 * client-side error handlers don't need per-route branches.
 */
export function unauthorized(message = 'not authenticated'): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message } },
    { status: 401 },
  )
}

/**
 * Canonical 403 response for authenticated-but-wrong-role access.
 * The repo's convention is to use 401 here too (avoids leaking
 * "this endpoint exists, just not for you" — same rationale as
 * tenant-isolation §catalog's 404-not-403 rule). Kept available
 * for cases where an explicit 403 makes more sense (e.g., admin
 * UI surfaces where the role is known at login time).
 */
export function forbidden(message = 'forbidden'): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: 'FORBIDDEN', message } },
    { status: 403 },
  )
}

async function readSession(): Promise<SessionShape | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  return session
}

/**
 * Any authenticated session. Use for routes that any signed-in
 * user can hit regardless of role (e.g., profile, logout).
 */
export async function requireAnySession(): Promise<GuardResult> {
  const session = await readSession()
  if (!session) return { session: null, error: unauthorized('not authenticated') }
  return { session, error: null }
}

/**
 * Admin OR broker only. The default for /admin/* routes — broker =
 * Tito's role, admin = internal operator/owner. Uses the same 401
 * code for both "no session" and "wrong role" to avoid leaking
 * endpoint existence (per the tenant-isolation-style disclosure rule).
 */
export async function requireAdminSession(): Promise<GuardResult> {
  const session = await readSession()
  if (!session) return { session: null, error: unauthorized('admin/broker only') }
  if (!['admin', 'broker'].includes(session.role)) {
    return { session: null, error: unauthorized('admin/broker only') }
  }
  return { session, error: null }
}

/**
 * Client only. Use for surfaces that should reject operators +
 * brokers too (rare — /mi-cuenta is the example, where admin should
 * see the aggregate dashboard, not a specific client's A/R).
 *
 * Per `.claude/rules/founder-overrides.md`, admin sessions CAN
 * access /mi-cuenta for QA (feature-flag gated). If you need that
 * semantic, use `requireAnySession` and branch on session.role
 * inside the handler.
 */
export async function requireClientSession(): Promise<GuardResult> {
  const session = await readSession()
  if (!session) return { session: null, error: unauthorized('client only') }
  if (session.role !== 'client') {
    return { session: null, error: unauthorized('client only') }
  }
  return { session, error: null }
}

/**
 * Role-list guard — for less-common role sets. Example:
 *   requireOneOf(['admin', 'broker', 'operator'])
 */
export async function requireOneOf(
  roles: readonly PortalRole[],
  description = 'access denied',
): Promise<GuardResult> {
  const session = await readSession()
  if (!session) return { session: null, error: unauthorized(description) }
  if (!roles.includes(session.role)) {
    return { session: null, error: unauthorized(description) }
  }
  return { session, error: null }
}
