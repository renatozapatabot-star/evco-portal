/**
 * AGUILA · V1.5 F10 — /admin/operadores
 *
 * Admin-only per-operator performance dashboard. Silver glass header, date
 * range picker, sortable table, row click → /admin/operadores/[id].
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { OperatorsMetricsClient } from './OperatorsMetricsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OperadoresPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/inicio')

  return <OperatorsMetricsClient />
}
