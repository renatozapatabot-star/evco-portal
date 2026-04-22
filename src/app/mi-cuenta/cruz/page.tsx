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
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { resolveMiCuentaCruzAccess } from '@/lib/mi-cuenta/cruz-safe'
import MiCuentaCruzChat from './MiCuentaCruzChat'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CRUZ_FEATURE_FLAG = process.env.NEXT_PUBLIC_MI_CUENTA_CRUZ_ENABLED === 'true'

export default async function MiCuentaCruzPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  const access = resolveMiCuentaCruzAccess(session, CRUZ_FEATURE_FLAG)
  if (access.decision === 'redirect') {
    redirect(access.to)
  }
  if (!session) redirect('/login')

  return <MiCuentaCruzChat isClient={access.isClient} />
}
