/**
 * Lightweight JSON endpoint for the /reportes page KPI strip.
 * Same aggregation as /api/reportes-pdf — both call computeReportesKpis().
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeReportesKpis } from '@/lib/reportes/kpis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
  }

  const companyId = request.cookies.get('company_id')?.value ?? session.companyId
  const clientClave = request.cookies.get('company_clave')?.value ?? ''

  if (!companyId || !clientClave) {
    return NextResponse.json({
      data: null,
      error: { code: 'MISSING_CLIENT', message: 'Cliente no resuelto' },
    }, { status: 400 })
  }

  try {
    const kpis = await computeReportesKpis(supabase, clientClave, companyId)
    return NextResponse.json({ data: kpis, error: null }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error computing KPIs'
    return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 })
  }
}
