/**
 * AGUILA V1.5 F16 — GET /api/admin/auditoria
 *
 * Admin/broker only. Returns audit_log rows for the session's
 * company_id with filter support. Emits `audit_log_queried` telemetry.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { queryAuditLog, type AuditLogFilters } from '@/lib/audit/query'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const sp = request.nextUrl.searchParams
  const filters: AuditLogFilters = {
    table: sp.get('table') ?? undefined,
    recordId: sp.get('recordId') ?? undefined,
    changedBy: sp.get('changedBy') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    cursor: sp.get('cursor') ? Number(sp.get('cursor')) : undefined,
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await queryAuditLog(supabase, session.companyId, filters)

    // Telemetry — silent
    try {
      await supabase.from('interaction_events').insert({
        event_type: 'audit_log_queried',
        event_name: 'audit_log_queried',
        page_path: '/admin/auditoria',
        user_id: `${session.companyId}:${session.role}`,
        company_id: session.companyId,
        metadata: { event: 'audit_log_queried', filters, count: result.rows.length },
      })
    } catch {
      // never block response
    }

    return NextResponse.json({ data: result, error: null })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json(
      { data: null, error: { code: 'QUERY_FAILED', message } },
      { status: 500 },
    )
  }
}
