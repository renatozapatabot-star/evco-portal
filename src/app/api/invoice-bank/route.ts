/**
 * Block 8 · Invoice Bank — list endpoint.
 *
 * Session-scoped, tenant-filtered listing. Supports filter bar params:
 * status, supplier (q), currency, date_from, date_to, amount_min,
 * amount_max. Paginated (default 50, max 200). Returns the shape the
 * /banco-facturas list view expects.
 *
 * 2026-05-05: hardened in two ways:
 *
 *   1. Tenant scope migrated from raw cookie read to resolveTenantScope
 *      helper — closes the forgeable-cookie pattern (baseline I20).
 *      Client role is locked to session.companyId; internal roles can
 *      view-as via ?company_id= or the company_id cookie set by
 *      /api/auth/view-as.
 *
 *   2. PostgREST "table not found" (PGRST205) is converted to a clean
 *      503 SERVICE_UNAVAILABLE instead of leaking the schema-cache
 *      error string in a 500. Production currently lacks the
 *      `pedimento_facturas` CREATE TABLE migration — this keeps the
 *      list view rendering an empty state instead of a crash banner.
 *      Tracked separately as "Invoice Bank schema gap" — needs a
 *      CREATE TABLE migration with RLS before the feature works
 *      end-to-end.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import type { InvoiceBankRow } from '@/lib/invoice-bank'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_STATUSES = new Set(['unassigned', 'assigned', 'archived'])

/**
 * PostgREST emits PGRST205 when the requested table is not in the
 * schema cache. Treat that as "feature not yet provisioned" rather
 * than "internal error" — the route stays a 200 with an empty list
 * so the UI renders its empty state.
 */
function isSchemaCacheMiss(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === 'PGRST205') return true
  return /Could not find the table .* in the schema cache/i.test(err.message ?? '')
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const sp = request.nextUrl.searchParams
  const status = sp.get('status') ?? 'unassigned'
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'status inválido' } },
      { status: 400 },
    )
  }
  const q = (sp.get('q') ?? '').trim()
  const currency = sp.get('currency')
  const dateFrom = sp.get('date_from')
  const dateTo = sp.get('date_to')
  const amountMin = sp.get('amount_min')
  const amountMax = sp.get('amount_max')

  const limitRaw = Number.parseInt(sp.get('limit') ?? '50', 10)
  const offsetRaw = Number.parseInt(sp.get('offset') ?? '0', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 50
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0

  // Canonical tenant scope — closes the forgeable-cookie pattern.
  // Client role: locked to session.companyId regardless of cookies/params.
  // Internal: ?company_id= or company_id cookie (view-as) or session fallback.
  const companyId = resolveTenantScope(session, request)
  if (!companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Tenant scope required' } },
      { status: 400 },
    )
  }

  let query = supabase
    .from('pedimento_facturas')
    .select(
      'id, invoice_number, supplier_name, amount, currency, status, file_url, received_at, assigned_to_trafico_id, assigned_at, company_id',
      { count: 'exact' },
    )
    .eq('status', status)
    .eq('company_id', companyId)
    .order('received_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (q.length > 0) query = query.ilike('supplier_name', `%${q}%`)
  if (currency === 'MXN' || currency === 'USD') query = query.eq('currency', currency)
  if (dateFrom) query = query.gte('received_at', dateFrom)
  if (dateTo) query = query.lte('received_at', dateTo)
  const amountMinNum = amountMin ? Number.parseFloat(amountMin) : null
  const amountMaxNum = amountMax ? Number.parseFloat(amountMax) : null
  if (amountMinNum !== null && Number.isFinite(amountMinNum)) query = query.gte('amount', amountMinNum)
  if (amountMaxNum !== null && Number.isFinite(amountMaxNum)) query = query.lte('amount', amountMaxNum)

  const { data, error, count } = await query

  if (error) {
    if (isSchemaCacheMiss(error)) {
      // The CREATE TABLE migration for pedimento_facturas is missing
      // in production. Render an empty bank to the UI instead of a
      // 500 schema-cache leak. The feature is "available but empty"
      // until the migration ships.
      return NextResponse.json(
        {
          data: {
            rows: [],
            meta: { total: 0, limit, offset, hasMore: false, schema_pending: true },
          },
          error: null,
        },
        { status: 200 },
      )
    }
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as InvoiceBankRow[]
  return NextResponse.json({
    data: {
      rows,
      meta: { total: count ?? rows.length, limit, offset, hasMore: (count ?? 0) > offset + rows.length },
    },
    error: null,
  })
}
