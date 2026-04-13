import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell } from '@/components/aguila'
import { AuditoriaGenerator } from '@/components/admin/AuditoriaGenerator'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Generar auditoría · AGUILA',
}

export default async function AuditoriaGenerarPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: companiesRaw } = await sb
    .from('companies')
    .select('company_id, name, clave_cliente')
    .eq('active', true)
    .order('name', { ascending: true })
    .limit(500)

  const clients = (companiesRaw ?? []).map((c) => ({
    companyId: c.company_id,
    name: c.name ?? c.company_id,
    clave: c.clave_cliente ?? '',
  }))

  return (
    <PageShell
      title="Generar auditoría semanal"
      subtitle="Elige un cliente y una semana. AGUILA arma el PDF dark-theme con el resumen financiero, detalle por proveedor, remesas y fracciones."
      systemStatus="healthy"
      liveTimestamp
    >
      <AuditoriaGenerator clients={clients} />
    </PageShell>
  )
}
