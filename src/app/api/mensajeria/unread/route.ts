/**
 * Mensajería · GET /api/mensajeria/unread
 * Returns the unread message count for the caller, used by the TopBar badge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { getUnreadCount } from '@/lib/mensajeria/threads'
import { isInternalRole, isMensajeriaEnabled } from '@/lib/mensajeria/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isMensajeriaEnabled()) {
    return NextResponse.json({ data: { count: 0 }, error: null })
  }
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ data: { count: 0 }, error: null })
  }
  if (session.role === 'client' && process.env.NEXT_PUBLIC_MENSAJERIA_CLIENT !== 'true') {
    return NextResponse.json({ data: { count: 0 }, error: null })
  }

  const readerKey = isInternalRole(session.role)
    ? `internal:${session.role}`
    : `client:${session.companyId}`

  const count = await getUnreadCount(session.role, session.companyId, readerKey)
  return NextResponse.json({ data: { count }, error: null })
}
