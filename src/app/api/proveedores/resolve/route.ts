/**
 * Resolve a proveedor code to a display name.
 *
 * Replaces the previous pattern where /entradas/[id] held its own
 * anon-key Supabase client and queried globalpc_proveedores +
 * supplier_network directly (both tenant-scoped tables). That pattern
 * broke the 'anon-key queries are banned on tenant-scoped tables'
 * rule and would fall back to empty results once RLS tightens.
 *
 * Tenant scope:
 *   - client role → session.companyId (HMAC-signed, never URL override)
 *   - broker/admin → no tenant filter (they see all suppliers)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for /api/proveedores/resolve')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`prov:${ip}`, 60, 60_000)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limited' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    })
  }

  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code || code.length > 80) {
    return NextResponse.json({ name: null }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const scopedCompanyId = isInternal ? undefined : session.companyId

  // Primary lookup: globalpc_proveedores (tenant-scoped)
  let q = supabase
    .from('globalpc_proveedores')
    .select('nombre')
    .or(`cve_proveedor.eq.${code},nombre.ilike.%${code}%`)
    .limit(1)
  if (scopedCompanyId) q = q.eq('company_id', scopedCompanyId)
  const { data: gpc } = await q

  if (gpc?.[0]?.nombre) {
    return NextResponse.json({ name: gpc[0].nombre }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }

  // Fallback: supplier_network (also tenant-scoped per /api/data)
  let q2 = supabase
    .from('supplier_network')
    .select('supplier_name')
    .ilike('supplier_name', `%${code}%`)
    .limit(1)
  if (scopedCompanyId) q2 = q2.eq('company_id', scopedCompanyId)
  const { data: net } = await q2

  return NextResponse.json({ name: net?.[0]?.supplier_name ?? null }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
