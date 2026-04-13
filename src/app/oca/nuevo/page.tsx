import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PageShell } from '@/components/aguila'
import { OcaForm } from './OcaForm'

export const dynamic = 'force-dynamic'

export default async function OcaNuevoPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker', 'operator'].includes(session.role)) redirect('/oca')

  return (
    <PageShell
      title="Nueva Opinión OCA"
      subtitle="Generada por Opus · revisada y firmada por Renato Zapata III"
    >
      <OcaForm />
    </PageShell>
  )
}
