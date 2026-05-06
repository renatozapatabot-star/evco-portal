import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'

/**
 * CRUZ v8.1 — `/` is now a role-aware redirect to the canonical cockpit.
 *
 *  - client   → /inicio            (CockpitInicio client view)
 *  - operator → /operador/inicio   (CockpitInicio operator view)
 *  - admin / broker → /admin/eagle (CockpitInicio owner view)
 *
 * Legacy cockpits at /components/cockpit/{OperatorCockpit,AdminCockpit} and
 * ClientHome are no longer rendered. See core-invariants rules 30, 33, 34.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RootRedirect({
  searchParams,
}: {
  searchParams: Promise<{ unavailable?: string }>
}) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('portal_session')?.value
  if (!sessionToken) redirect('/login')

  const session = await verifySession(sessionToken)
  if (!session) redirect('/login')

  const opId = cookieStore.get('operator_id')?.value
  if (opId) {
    logOperatorAction({
      operatorId: opId,
      actionType: 'view_cockpit',
      payload: { role_rendered: session.role },
    })
  }

  // Preserve ?unavailable=1 through the role redirect so the destination
  // cockpit can surface a toast explaining why the user landed there
  // (i.e. they tried to reach an admin-only route per middleware:106).
  // Without this preservation the param drops at this hop and the client
  // sees a silent redirect — the audit caught this gap on 2026-05-05.
  const sp = await searchParams
  const tail = sp.unavailable === '1' ? '?unavailable=1' : ''

  if (session.role === 'admin' || session.role === 'broker') redirect(`/admin/eagle${tail}`)
  if (session.role === 'operator') redirect(`/operador/inicio${tail}`)
  // Default: client
  redirect(`/inicio${tail}`)
}
