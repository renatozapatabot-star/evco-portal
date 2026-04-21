// CRUZ · /mensajeria — internal comms layer (Phase 1).
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
import { CalmEmptyState } from '@/components/cockpit/client/CalmEmptyState'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function MensajeriaProximamente() {
  return (
    <main className="aduana-dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <CalmEmptyState
        icon="document"
        title="Próximamente disponible"
        message="La mensajería estará disponible pronto. Mientras tanto, continúa con tu operación — tu equipo te mantendrá al día."
        action={{ label: 'Volver al inicio', href: '/inicio' }}
      />
    </main>
  )
}

export default async function MensajeriaPage() {
  if (!isMensajeriaEnabled()) {
    return <MensajeriaProximamente />
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  if (!isInternalRole(session.role) && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return <MensajeriaProximamente />
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
