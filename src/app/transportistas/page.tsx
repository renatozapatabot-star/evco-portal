/**
 * /transportistas — operator-facing carriers directory.
 *
 * Three tabs (Mexicanos / Extranjeros / Transfer) backed by the same
 * `carriers` table. Admin management stays at /admin/carriers — this view is
 * optimized for read + history lookup during tráfico creation.
 *
 * CLICK COUNT: cockpit → transportistas → carrier detail = 2 clicks
 * GLOBALPC EQUIVALENT: 3 separate menus · navigate · open = 4+ clicks
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { BG_DEEP } from '@/lib/design-system'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { TransportistasClient, type CarrierRow } from './TransportistasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TransportistasPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['operator', 'admin', 'broker'].includes(session.role)) redirect('/')

  const sb = createServerClient()
  const { data } = await sb
    .from('carriers')
    .select('id, name, carrier_type, rfc, sct_permit, dot_number, mc_number, scac_code, calificacion, tipos_trailer, area_servicio, active')
    .order('active', { ascending: false })
    .order('calificacion', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .limit(1000)

  const rows = (data ?? []) as CarrierRow[]

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Transportistas" />
      <TransportistasClient initialRows={rows} />
    </div>
  )
}
