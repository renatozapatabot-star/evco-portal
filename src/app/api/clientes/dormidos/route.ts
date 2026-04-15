/**
 * ZAPATA AI · V1.5 F7 — GET /api/clientes/dormidos
 *
 * Returns dormant clientes (historical embarque activity but no motion in the
 * last `threshold` days, default 14). Role-gated to admin/broker. Emits
 * `dormant_list_viewed` telemetry via interaction_events.payload.event.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { detectDormantClients, clampThreshold } from '@/lib/dormant/detect'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['admin', 'broker'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para ver clientes dormidos', 403)
  }

  const url = new URL(request.url)
  const raw = Number(url.searchParams.get('threshold') ?? '14')
  const threshold = clampThreshold(raw)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const dormant = await detectDormantClients(sb, null, threshold)

  await sb.from('interaction_events').insert({
    event_type: 'dormant_list_viewed',
    event_name: 'dormant_list_viewed',
    page_path: '/admin/clientes-dormidos',
    user_id: `${session.companyId}:${session.role}`,
    company_id: session.companyId,
    payload: { event: 'dormant_list_viewed', threshold, count: dormant.length },
  })

  return NextResponse.json(
    { data: { dormant, threshold }, error: null },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
