import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Returns the tenant scope for the current HMAC session so client hooks
 * (realtime subscriptions, notification badge) can build filters without
 * reading a forgeable cookie. Baseline-2026-04-20 I20 eliminated the
 * unsigned `company_id` cookie across server routes; this endpoint
 * extends that hardening into the browser layer.
 */
export async function GET() {
  const store = await cookies()
  const session = await verifySession(store.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ error: 'no-session' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json(
    {
      companyId: session.companyId,
      role: session.role,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
