/**
 * AGUILA · V1.5 F3 — GET /api/contabilidad/overview
 *
 * Returns the six tiles Anabel needs on open: AR aging, AP aging, monthly
 * close checklist, MVE open-alert counts, facturas ready queue, last
 * QuickBooks export. All scoped by session.companyId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { ensureMonthlyChecklist, monthAnchor } from '@/lib/contabilidad/close'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['contabilidad', 'admin', 'broker'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para ver contabilidad', 403)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const month = monthAnchor()

  const [ar, ap, close, mveRows, facturasReady, lastQb] = await Promise.all([
    computeARAging(supabase, session.companyId),
    computeAPAging(supabase, session.companyId),
    ensureMonthlyChecklist(supabase, session.companyId, month),
    supabase
      .from('mve_alerts')
      .select('id, severity')
      .eq('company_id', session.companyId)
      .eq('resolved', false)
      .limit(500),
    supabase
      .from('invoices')
      .select('id, invoice_number, total, currency, created_at, status, company_id')
      .eq('company_id', session.companyId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('quickbooks_export_jobs')
      .select('id, status, row_count, entity, format, created_at, completed_at, file_bytes')
      .eq('company_id', session.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const mveOpen = mveRows.data ?? []
  const critical = mveOpen.filter((a) => (a as { severity: string }).severity === 'critical').length
  const warning = mveOpen.filter((a) => (a as { severity: string }).severity === 'warning').length

  // Server-side telemetry — contabilidad_overview_viewed. We do NOT widen
  // the locked TelemetryEvent union; event lives in payload.event.
  await supabase.from('interaction_events').insert({
    event_type: 'contabilidad_overview_viewed',
    event_name: 'contabilidad_overview_viewed',
    page_path: '/contabilidad',
    user_id: `${session.companyId}:${session.role}`,
    company_id: session.companyId,
    payload: { event: 'contabilidad_overview_viewed' },
  })

  return NextResponse.json({
    data: {
      month,
      ar,
      ap,
      close,
      mve: { total: mveOpen.length, critical, warning },
      facturasReady: {
        count: facturasReady.data?.length ?? 0,
        recent: facturasReady.data ?? [],
      },
      lastQbExport: lastQb.data ?? null,
    },
    error: null,
  })
}
