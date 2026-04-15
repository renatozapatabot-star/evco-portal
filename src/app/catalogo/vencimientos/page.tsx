/**
 * /catalogo/vencimientos — compliance expiry dashboard.
 *
 * Shows NOM / SEDUE / SEMARNAT permits due within 90 days, bucketed
 * red/amber/plum. Operators land here from the catálogo cockpit card.
 *
 * CLICK COUNT: cockpit → vencimientos → product detail = 2 clicks
 * GLOBALPC EQUIVALENT: Catálogos → manual filter → sort → open = 4 clicks
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { getVencimientos } from '@/lib/catalogo/vencimientos'
import { BG_DEEP } from '@/lib/design-system'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { VencimientosClient } from './VencimientosClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VencimientosPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const isInternal = ['operator', 'admin', 'broker'].includes(session.role)
  const companyId = session.role === 'client'
    ? session.companyId
    : (store.get('company_id')?.value || session.companyId)

  const supabase = createServerClient()
  const rows = await getVencimientos(supabase, {
    companyId,
    isInternal,
    horizonDays: 90,
  })

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Catálogo · vencimientos" />
      <VencimientosClient rows={rows} />
    </div>
  )
}
