import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'
import { createServerClient } from '@/lib/supabase-server'
import { fetchCockpitData } from '@/components/cockpit/shared/fetchCockpitData'
import { CockpitShell } from '@/components/cockpit/shared/CockpitShell'
import { AdminCockpit } from '@/components/cockpit/AdminCockpit'
import { OperatorCockpit } from '@/components/cockpit/OperatorCockpit'
import { CommandCenterView } from '@/components/command-center/CommandCenterView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Dashboard() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('portal_session')?.value

  if (!sessionToken) redirect('/login')

  const session = await verifySession(sessionToken)
  if (!session) redirect('/login')

  const opId = cookieStore.get('operator_id')?.value
  const role = session.role

  // Resolve operator identity from operators table
  let operatorName = ''
  let operatorCompanyId = session.companyId
  if (opId) {
    const sb = createServerClient()
    const { data: op } = await sb
      .from('operators')
      .select('full_name, company_id, role')
      .eq('id', opId)
      .maybeSingle()
    if (op) {
      operatorName = op.full_name || ''
      operatorCompanyId = op.company_id || session.companyId
    }
  }

  // Log cockpit view (fire-and-forget)
  if (opId) {
    logOperatorAction({
      operatorId: opId,
      actionType: 'view_cockpit',
      payload: { role_rendered: role },
    })
  }

  // Fetch role-specific data server-side
  const data = await fetchCockpitData(role, operatorCompanyId, opId)

  // Route by role: admin/broker → AdminCockpit, operator → OperatorCockpit, client → ClientCockpit
  if (role === 'admin' || role === 'broker') {
    return (
      <CockpitShell>
        <AdminCockpit data={data.admin!} operatorName={operatorName} />
      </CockpitShell>
    )
  }

  if (role === 'operator') {
    return (
      <CockpitShell>
        <OperatorCockpit
          data={data.operator!}
          operatorName={operatorName}
          operatorId={opId || ''}
        />
      </CockpitShell>
    )
  }

  // Default: client view — full command center with client viewMode
  return (
    <CockpitShell>
      <CommandCenterView viewMode="client" />
    </CockpitShell>
  )
}
