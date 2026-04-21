/**
 * CRUZ · V1.5 F10 — GET /api/admin/operadores/metrics
 *
 * Admin/broker-only. Returns per-operator metrics for the authenticated
 * session's company_id, constrained to [from, to].
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeOperatorMetrics } from '@/lib/operators/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isoOrDefault(value: string | null, fallback: Date): string {
  if (!value) return fallback.toISOString()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return fallback.toISOString()
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  if (!['admin', 'broker'].includes(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Solo administrador o broker' } },
      { status: 403 },
    )
  }

  const now = new Date()
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const from = isoOrDefault(request.nextUrl.searchParams.get('from'), firstOfMonth)
  const to = isoOrDefault(request.nextUrl.searchParams.get('to'), now)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rows = await computeOperatorMetrics(supabase, session.companyId, { from, to })

  // Telemetry (server-side insert — does not widen TelemetryEvent union).
  try {
    await supabase.from('interaction_events').insert({
      event_type: 'operator_metrics_viewed',
      event_name: 'operator_metrics_viewed',
      page_path: '/admin/operadores',
      user_id: `${session.companyId}:${session.role}`,
      company_id: session.companyId,
      payload: {
        event: 'operator_metrics_viewed',
        from,
        to,
        operators: rows.length,
      },
    })
  } catch {
    // silent — telemetry never blocks
  }

  return NextResponse.json({
    data: { from, to, operators: rows },
    error: null,
  })
}
