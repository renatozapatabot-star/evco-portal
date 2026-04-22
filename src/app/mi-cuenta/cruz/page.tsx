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
import {
  FEATURE_FLAG_OVERRIDE_COOKIE,
  isFlagEffective,
  parseOverrideCookie,
} from '@/lib/admin/feature-flags'
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

  return <MiCuentaCruzChat isClient={access.isClient} />
}
