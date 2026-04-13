import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PageShell } from '@/components/aguila'
import { CertForm } from './CertForm'

export const dynamic = 'force-dynamic'

export default async function UsmcaNuevoPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker', 'operator'].includes(session.role)) redirect('/usmca/certificados')

  return (
    <PageShell
      title="Nuevo certificado USMCA"
      subtitle="Artículo 5.2 · Criterios A–D · firma a cargo de Renato Zapata III"
    >
      <CertForm />
    </PageShell>
  )
}
