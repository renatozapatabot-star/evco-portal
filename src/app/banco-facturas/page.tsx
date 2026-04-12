// Block 8 · Invoice Bank — server shell. Session + tenant guard then
// hands to the client surface.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
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

  return <BancoFacturasClient companyId={companyId} role={session.role} />
}
