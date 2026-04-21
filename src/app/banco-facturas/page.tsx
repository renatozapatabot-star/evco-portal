// Block 8 · Invoice Bank — server shell. Session + tenant guard then
// hands to the client surface.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { BG_DEEP } from '@/lib/design-system'
import { BancoFacturasClient } from './BancoFacturasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BancoFacturasPage() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (store.get('company_id')?.value || session.companyId)

  return (
    <div style={{ background: BG_DEEP, minHeight: '100vh', padding: '24px 24px 48px' }}>
      <CockpitBrandHeader subtitle="Banco · Facturas" />
      <BancoFacturasClient companyId={companyId} role={session.role} />
    </div>
  )
}
