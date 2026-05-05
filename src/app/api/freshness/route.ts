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

  // Per-page sync_type scoping (audit Cluster B3 2026-05-05). Comma-list
  // of sync_types; falls back to "any sync_type" when absent. Whitelist
  // guards against arbitrary string injection.
  const rawSyncTypes = req.nextUrl.searchParams.get('sync_types')
  const syncTypes = rawSyncTypes
    ? rawSyncTypes.split(',').map((s) => s.trim()).filter((s) => ALLOWED_SYNC_TYPES.has(s))
    : undefined

  const reading = await readFreshness(supabase, companyId, syncTypes)
  return NextResponse.json(reading, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

const ALLOWED_SYNC_TYPES = new Set([
  'globalpc_delta',
  'globalpc_full',
  'wsdl_anexo24',
  'aduanet_scrape',
  'document_intelligence',
  'email_intake',
  'risk_feed',
  'risk_scorer',
  'content_intel',
  'econta_delta',
  'econta_full',
  'econta_intraday',
  'econta_nightly_full',
  'econta_reconciler',
])
