// AGUILA · /mensajeria — internal comms layer (Phase 1).
//
// Operators + owner only. Client surface is gated by NEXT_PUBLIC_MENSAJERIA_CLIENT.
// Owners see escalated threads pinned at top; operators see all threads.
// No new nav-tile entry — route is linked contextually until Tito + Renato IV
// approve a permanent nav slot (core-invariants rule 29).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import {
  isMensajeriaEnabled,
  isInternalRole,
} from '@/lib/mensajeria/constants'
import { MensajeriaClient } from './MensajeriaClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MensajeriaPage() {
  if (!isMensajeriaEnabled()) {
    return (
      <main style={{ padding: 48, color: '#94a3b8', textAlign: 'center' }}>
        Chat no está activo.
      </main>
    )
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  if (!isInternalRole(session.role) && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    redirect('/')
  }

  const operatorName = cookieStore.get('operator_name')?.value?.trim() || 'Operador'
  const companyName = cookieStore.get('company_name')?.value?.trim() || ''

  return (
    <MensajeriaClient
      role={session.role}
      companyId={session.companyId}
      companyName={companyName}
      operatorName={operatorName}
    />
  )
}
