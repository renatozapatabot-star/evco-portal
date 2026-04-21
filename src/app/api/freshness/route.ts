/**
 * Tenant-scoped freshness reading for client-side cockpits.
 *
 * Contract: `.claude/rules/sync-contract.md` — every client-facing
 * surface must surface a freshness signal (either "Sincronizado
 * hace N min" or the stale banner). /inicio reads this server-side
 * via readFreshness(); client-component list pages (/entradas,
 * /pedimentos, /embarques, /expedientes) consume this endpoint via
 * the useFreshness() hook.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { readFreshness } from '@/lib/cockpit/freshness'

export const dynamic = 'force-dynamic'

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for /api/freshness')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Broker/admin can peek at another tenant's freshness via query param
  // for support purposes; client role ignores any override.
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const paramCompanyId = req.nextUrl.searchParams.get('company_id')
  const companyId = isInternal ? (paramCompanyId || session.companyId) : session.companyId

  const reading = await readFreshness(supabase, companyId)
  return NextResponse.json(reading, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
