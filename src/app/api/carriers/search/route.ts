/**
 * CRUZ · Block 12 — GET /api/carriers/search
 *
 * Type-ahead search over the `carriers` master catalog. FTS on name and alias
 * via to_tsvector('spanish'), falling back to ilike for <3-char queries. Top
 * `limit` (default 5) results. Returns { id, name, rfc, sct_permit, carrier_type }.
 * Auth-gated (any signed session); read-only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  type CarrierSearchResult,
  type CarrierType,
  CarrierSearchQuerySchema,
} from '@/lib/carriers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface CarrierRow {
  id: string
  name: string
  rfc: string | null
  sct_permit: string | null
  carrier_type: CarrierType
  active: boolean
}

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

  const sp = request.nextUrl.searchParams
  const parsed = CarrierSearchQuerySchema.safeParse({
    q: sp.get('q') ?? '',
    type: sp.get('type') ?? undefined,
    onlyActive: sp.get('onlyActive') === 'false' ? false : true,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Parámetros inválidos',
        },
      },
      { status: 400 },
    )
  }
  const { q, type, onlyActive, limit } = parsed.data
  const trimmed = q.trim()

  let query = supabase
    .from('carriers')
    .select('id, name, rfc, sct_permit, carrier_type, active')
    .order('name', { ascending: true })
    .limit(limit)

  if (onlyActive) query = query.eq('active', true)
  if (type) query = query.eq('carrier_type', type)

  if (trimmed.length > 0) {
    // Short queries: prefix ilike is fine. Longer: combine name + alias match.
    if (trimmed.length < 3) {
      query = query.ilike('name', `${trimmed}%`)
    } else {
      // Pull matching carrier_ids from aliases first, then union via .or on the main query.
      const { data: aliasHits } = await supabase
        .from('carrier_aliases')
        .select('carrier_id')
        .ilike('alias', `%${trimmed}%`)
        .limit(limit * 2)
      const aliasIds = (aliasHits ?? []).map(r => r.carrier_id as string)
      if (aliasIds.length > 0) {
        const inList = aliasIds.map(id => `id.eq.${id}`).join(',')
        query = query.or(`name.ilike.%${trimmed}%,${inList}`)
      } else {
        query = query.ilike('name', `%${trimmed}%`)
      }
    }
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as CarrierRow[]
  const payload: CarrierSearchResult[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    rfc: r.rfc,
    sct_permit: r.sct_permit,
    carrier_type: r.carrier_type,
  }))

  return NextResponse.json({ data: payload, error: null })
}
