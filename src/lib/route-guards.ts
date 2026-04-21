/**
 * Server-side role gate helpers.
 *
 * Never read role from `cookieStore.get('user_role')`. That cookie is
 * unsigned and trivially forgeable — any user can set their own browser
 * cookie and walk through a role check. The signed `portal_session`
 * token verified by `verifySession()` is the only trustworthy source.
 *
 * Use `requireRole()` in every server component / route that needs
 * role-gating. On mismatch it calls `redirect('/login')` which throws
 * and short-circuits the render.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, type PortalRole } from '@/lib/session'

type VerifiedSession = NonNullable<Awaited<ReturnType<typeof verifySession>>>

/**
 * Returns the verified session if the user's role is in `allowed`.
 * Otherwise redirects to `/login` (or `/` if they're already logged in
 * but lack the role — avoids a login loop for wrong-role users).
 */
export async function requireRole(allowed: ReadonlyArray<PortalRole>): Promise<VerifiedSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!allowed.includes(session.role)) redirect('/')
  return session
}

/** Admin + broker only (Tito's surface). */
export const requireOwner = () => requireRole(['admin', 'broker'])

/** Operator-shaped roles: admin, broker, operator. */
export const requireOperator = () => requireRole(['admin', 'broker', 'operator'])
