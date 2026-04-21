import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'

/**
 * /clientes — admin/broker route. Client roles see /?unavailable=1.
 *
 * Audit 2026-04-19 "THE CHROME REPORT" #9: client role on /clientes
 * returned 404 while other admin routes (/operador/*, /admin/*)
 * redirected to /?unavailable=1. Inconsistent unauthorized handling.
 *
 * Now: client roles bounce to the canonical "you don't have access"
 * landing. Admin/broker roles redirect to the first client detail
 * (or to /admin/eagle if no client list is appropriate at this level).
 */
export default async function ClientesIndex() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (session.role === 'client') {
    redirect('/?unavailable=1')
  }
  // Admin/broker land on Eagle View — the canonical multi-client surface.
  redirect('/admin/eagle')
}
