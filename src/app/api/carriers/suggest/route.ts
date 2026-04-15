/**
 * GET /api/carriers/suggest?type=mx|transfer|foreign&limit=3
 *
 * Smart carrier suggestion based on 90-day tráfico history. Returns top N
 * carriers of the requested type ranked by recent volume, with calificacion
 * as a tiebreaker. Useful when operator creates a tráfico and needs a
 * quick one-tap assignment.
 *
 * No cargo/route ML yet — that's deferred. Volume + rating is the baseline
 * signal every future iteration must beat.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator'])
const VALID_TYPES = new Set(['mx', 'transfer', 'foreign'])

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

interface Carrier {
  id: string
  name: string
  carrier_type: 'mx' | 'transfer' | 'foreign'
  calificacion: number | null
  active: boolean
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!INTERNAL_ROLES.has(session.role)) return err('FORBIDDEN', 'Sin permisos', 403)

  const sp = request.nextUrl.searchParams
  const type = sp.get('type')
  const limit = Math.min(Math.max(Number.parseInt(sp.get('limit') ?? '3', 10) || 3, 1), 10)
  if (!type || !VALID_TYPES.has(type)) {
    return err('VALIDATION_ERROR', 'type debe ser mx, transfer, o foreign', 400)
  }

  const { data: carriersData } = await supabase
    .from('carriers')
    .select('id, name, carrier_type, calificacion, active')
    .eq('carrier_type', type)
    .eq('active', true)
    .limit(500)

  const carriers = (carriersData ?? []) as Carrier[]
  if (carriers.length === 0) {
    return NextResponse.json({ data: [], error: null })
  }

  const names = carriers.map((c) => c.name)
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const column = type === 'foreign' ? 'transportista_extranjero' : 'transportista_mexicano'

  const { data: recentTraficos } = await supabase
    .from('traficos')
    .select(`${column}`)
    .in(column, names)
    .gte('updated_at', since)
    .limit(5000)

  const counts = new Map<string, number>()
  for (const row of (recentTraficos ?? []) as Record<string, string | null>[]) {
    const name = row[column]
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  const ranked = carriers
    .map((c) => ({
      id: c.id,
      name: c.name,
      carrier_type: c.carrier_type,
      calificacion: c.calificacion,
      traficos_90d: counts.get(c.name) ?? 0,
    }))
    .sort((a, b) => {
      if (b.traficos_90d !== a.traficos_90d) return b.traficos_90d - a.traficos_90d
      const bc = b.calificacion ?? 0
      const ac = a.calificacion ?? 0
      return bc - ac
    })
    .slice(0, limit)

  return NextResponse.json({ data: ranked, error: null })
}
