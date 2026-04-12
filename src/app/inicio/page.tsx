// AGUILA · /inicio — cliente self-service cockpit (V1.5 F11).
//
// Landing page for client role: three tabs — active tráficos, documentos,
// notificaciones. Non-client roles (operator/admin/broker/warehouse/
// contabilidad) are redirected to their usual cockpit at `/`.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  getClienteActiveTraficos,
  getClienteDocuments,
  getClienteNotifications,
} from '@/lib/cliente/dashboard'
import { CockpitShell } from '@/components/cockpit/shared/CockpitShell'
import { ClienteInicio } from '@/components/cliente/ClienteInicio'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  // Non-client roles: send them to their real cockpit.
  if (session.role !== 'client') redirect('/')

  const supabase = createServerClient()
  const companyId = session.companyId

  const [activeTraficos, documentos, notificaciones, companyRow] = await Promise.all([
    getClienteActiveTraficos(supabase, companyId),
    getClienteDocuments(supabase, companyId),
    getClienteNotifications(supabase, companyId),
    supabase.from('companies').select('name').eq('company_id', companyId).maybeSingle(),
  ])

  const companyName = (companyRow?.data?.name as string) ?? ''

  // Telemetry — fire-and-forget, silent on failure.
  const opId = cookieStore.get('operator_id')?.value
  logOperatorAction({
    operatorId: opId,
    actionType: 'view_page',
    targetId: '/inicio',
    companyId,
    payload: {
      event: 'cliente_inicio_viewed',
      active_traficos: activeTraficos.length,
      documentos: documentos.length,
      notificaciones: notificaciones.length,
    },
  })

  return (
    <CockpitShell>
      <ClienteInicio
        companyName={companyName}
        activeTraficos={activeTraficos}
        documentos={documentos}
        notificaciones={notificaciones}
      />
    </CockpitShell>
  )
}
