import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * ZAPATA AI v10 — /asistente is the canonical full-page assistant route.
 * Currently redirects to /cruz (existing chat implementation). When the
 * role-scoped Claude tool-calling build lands, this route gets the full
 * upgrade; /cruz stays as a legacy alias.
 */
export default async function AsistentePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  redirect('/cruz')
}
