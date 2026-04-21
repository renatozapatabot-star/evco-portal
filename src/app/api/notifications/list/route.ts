import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { listNotifications } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * V1 Polish Pack · Block 6 — 20 most recent notifications for the
 * authenticated company. Session-scoped. No polling from unauthenticated
 * clients.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }
  const companyId = session.role === 'client'
    ? session.companyId
    : (request.cookies.get('company_id')?.value || session.companyId)

  const rows = await listNotifications(companyId, 20)
  const unread = rows.filter(r => !r.read).length
  return NextResponse.json({ data: { notifications: rows, unread }, error: null })
}
