import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'

/**
 * AGUILA v8.1 — `/` is now a role-aware redirect to the canonical cockpit.
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

export default async function RootRedirect() {
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

  if (session.role === 'admin' || session.role === 'broker') redirect('/admin/eagle')
  if (session.role === 'operator') redirect('/operador/inicio')
  // Default: client
  redirect('/inicio')
}
