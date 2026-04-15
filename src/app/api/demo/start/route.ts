/**
 * ZAPATA AI · V1.5 F9 — POST /api/demo/start
 *
 * Admin/broker only. Creates the synthetic DEMO EVCO PLASTICS company if
 * absent, inserts a fresh DEMO- embarque, kicks off the 12-step orchestrator
 * in the background, and returns `{ runId, traficoId }` so the UI can poll
 * /api/demo/status/[runId].
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { verifySession } from '@/lib/session'
import {
  assertNoExistingDemoTrafico,
  buildInitialRun,
  createDemoTrafico,
  ensureDemoCompany,
  runOrchestrator,
} from '@/lib/demo/orchestrator'

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
    await ensureDemoCompany(sb)
    await assertNoExistingDemoTrafico(sb)
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'CONFLICT',
          message: err instanceof Error ? err.message : 'No se pudo iniciar demo',
        },
      },
      { status: 409 },
    )
  }

  let traficoId: string
  try {
    traficoId = await createDemoTrafico(sb)
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Error creando embarque',
        },
      },
      { status: 500 },
    )
  }

  const runId = crypto.randomUUID()
  const run = buildInitialRun(runId, traficoId)

  // Fire-and-forget. The orchestrator is in-memory; it logs to Supabase as it goes.
  void runOrchestrator(sb, run)

  return NextResponse.json({ data: { runId, traficoId }, error: null })
}
