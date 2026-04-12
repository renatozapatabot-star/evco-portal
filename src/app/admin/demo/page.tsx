/**
 * AGUILA · V1.5 F9 — /admin/demo
 *
 * Admin-only one-click demo. Renato clicks "Iniciar demo" and AGUILA seeds
 * a synthetic DEMO EVCO PLASTICS tráfico that walks through 12 lifecycle
 * events in ~90 seconds. Silver glass, single-button UI.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { DemoRunnerClient } from './DemoRunnerClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DemoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/inicio')

  return <DemoRunnerClient />
}
