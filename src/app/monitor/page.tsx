/**
 * /monitor — Live Operations Monitor.
 *
 * All active tráficos with realtime status updates. Operator/admin see
 * every client's active rows; clients see only their own company's.
 *
 * CLICK COUNT: cockpit → monitor → tráfico detail = 2 clicks
 * GLOBALPC EQUIVALENT: Utilerías → Monitor → manual refresh → open tráfico = 4 clicks
 * ZAPATA AI ADVANTAGE: realtime push + 2 clicks saved per operation
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { softData } from '@/lib/cockpit/safe-query'
import { BG_DEEP } from '@/lib/design-system'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { MonitorClient, type MonitorRow } from './MonitorClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MonitorPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const isInternal = ['operator', 'admin', 'broker'].includes(session.role)
  const companyId =
    session.role === 'client'
      ? session.companyId
      : (store.get('company_id')?.value || session.companyId)

  const sb = createServerClient()
  let query = sb
    .from('traficos')
    .select('trafico, company_id, estatus, semaforo, descripcion_mercancia, fecha_llegada, fecha_cruce, updated_at, pedimento')
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
    .order('updated_at', { ascending: false })
    .limit(500)
  if (!isInternal) {
    query = query.eq('company_id', companyId)
  }

  const rows = await softData<MonitorRow>(query)

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Monitor · en vivo" />
      <MonitorClient
        initialRows={rows}
        role={session.role}
        companyId={companyId}
        isInternal={isInternal}
      />
    </div>
  )
}
