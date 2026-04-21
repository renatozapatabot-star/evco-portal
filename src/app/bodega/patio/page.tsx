import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { PatioClient } from './PatioClient'

export const dynamic = 'force-dynamic'

export default async function PatioPage() {
  const cookieStore = await cookies()
  const session = await verifySession(
    cookieStore.get('portal_session')?.value ?? '',
  )
  if (!session) redirect('/login')

  return <PatioClient />
}
