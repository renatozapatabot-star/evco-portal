/**
 * CRUZ · Block 12 — GET/POST /api/carriers/catalog
 *
 * Admin list + create for the master carrier catalog. Internal roles only
 * (admin / broker / operator). GET paginates; POST validates against
 * CarrierCreateSchema.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { CarrierCreateSchema, type CarrierFull } from '@/lib/carriers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator'])

export async function GET(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  if (!INTERNAL_ROLES.has(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin permisos' } },
      { status: 403 },
    )
  }

  const sp = request.nextUrl.searchParams
  const limit = Math.min(Number(sp.get('limit') ?? 100), 500)
  const offset = Math.max(0, Number(sp.get('offset') ?? 0))
  const type = sp.get('type')

  let query = supabase
    .from('carriers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)
  if (type) query = query.eq('carrier_type', type)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: (data ?? []) as CarrierFull[],
    meta: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
    error: null,
  })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  if (!INTERNAL_ROLES.has(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin permisos' } },
      { status: 403 },
    )
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }

  const parsed = CarrierCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        },
      },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('carriers')
    .insert(parsed.data)
    .select('*')
    .single()
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'CONFLICT', message: error.message } },
      { status: 409 },
    )
  }

  return NextResponse.json({ data: data as CarrierFull, error: null })
}
