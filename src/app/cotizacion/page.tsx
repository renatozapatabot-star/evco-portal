import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PageShell } from '@/components/aguila'
import { QuoteForm } from './QuoteForm'

export const dynamic = 'force-dynamic'

export default async function CotizacionPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  return (
    <PageShell
      title="Cotización de impuestos"
      subtitle="DTA · IGI · IVA · PREV — base cascada desde system_config, nunca hardcodeada"
      systemStatus="healthy"
    >
      <QuoteForm />
    </PageShell>
  )
}
