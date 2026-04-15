/**
 * /admin/patentes — E_FIRMA / FIEL / patent renewal dashboard.
 *
 * Admin/broker only. Every pedimento under Patente 3596/3902 depends on
 * these certificates being current. This page is Tito's single source
 * of truth for compliance expiry.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { BG_DEEP } from '@/lib/design-system'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { PatentesClient, type PatenteRow } from './PatentesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PatentesPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await supabase
    .from('patentes')
    .select('id, numero, nombre, efirma_expiry, fiel_expiry, patent_renewal_date, authorized_offices, certificate_file_url, notes, active, updated_at')
    .order('numero', { ascending: true })

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Patentes · E_FIRMA / FIEL" />
      <PatentesClient initialRows={(data ?? []) as PatenteRow[]} />
    </div>
  )
}
