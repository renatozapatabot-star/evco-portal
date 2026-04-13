/**
 * AGUILA · V1.5 F9 — POST /api/demo/reset
 *
 * Admin/broker only. Purges synthetic embarques + workflow_events +
 * classification_sheets + invoices + quickbooks_export_jobs + mve_alerts
 * scoped to `company_id = aguila-demo`. Idempotent.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { resetDemo } from '@/lib/demo/orchestrator'

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }
  if (!['admin', 'broker'].includes(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Solo admin/broker' } },
      { status: 403 },
    )
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const result = await resetDemo(sb)
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Error al reiniciar demo',
        },
      },
      { status: 500 },
    )
  }
}
