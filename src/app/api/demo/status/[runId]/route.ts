/**
 * CRUZ · V1.5 F9 — GET /api/demo/status/[runId]
 *
 * Admin/broker polls every ~3s. Returns the in-memory run state: which
 * step is currently running, which are done, and whether the run finished.
 * If the Map doesn't have the runId (cold start on another lambda), returns
 * `unknown` so the UI can render gracefully.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { getDemoRun } from '@/lib/demo/orchestrator'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
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

  const { runId } = await context.params
  const run = getDemoRun(runId)

  if (!run) {
    return NextResponse.json({
      data: { status: 'unknown', runId },
      error: null,
    })
  }

  return NextResponse.json({ data: run, error: null })
}
