import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { ClasificarShell } from './_components/ClasificarShell'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PRIVILEGED_ROLES = new Set(['operator', 'admin', 'broker'])

export default async function ClasificarPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const canInsert = PRIVILEGED_ROLES.has(session.role)

  return <ClasificarShell canInsert={canInsert} />
}
