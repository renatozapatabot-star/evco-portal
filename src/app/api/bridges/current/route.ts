// AGUILA V1.5 · F18 — GET /api/bridges/current
//
// Returns the latest bridge-wait snapshot per (bridge, direction, lane).
// If the most recent row is older than 6 min, triggers an in-place
// refresh before returning — this is the near-real-time mechanism that
// supplants sub-daily crons on Vercel Hobby.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { getLatestBridgeWaits, refreshIfStale } from '@/lib/bridges/fetch'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  await refreshIfStale(6 * 60 * 1000)
  const latest = await getLatestBridgeWaits()
  return NextResponse.json(
    { data: { bridges: latest }, error: null },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}
