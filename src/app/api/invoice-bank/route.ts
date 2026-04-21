/**
 * Block 8 · Invoice Bank — list endpoint.
 *
 * Session-scoped, tenant-filtered listing. Supports filter bar params:
 * status, supplier (q), currency, date_from, date_to, amount_min,
 * amount_max. Paginated (default 50, max 200). Returns the shape the
 * /banco-facturas list view expects.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import type { InvoiceBankRow } from '@/lib/invoice-bank'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_STATUSES = new Set(['unassigned', 'assigned', 'archived'])

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

  const companyId =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value || session.companyId)

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
