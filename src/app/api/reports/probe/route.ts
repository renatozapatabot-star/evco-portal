/**
 * Block 3 · Dynamic Report Builder — probe endpoint.
 *
 * GET /api/reports/probe
 * Runs `select * from <table> limit 1` against each of the 10 registry
 * tables (plus expediente_documentos for seed-template gating). Returns
 * which entities are alive vs missing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { REPORT_ENTITIES } from '@/lib/report-registry'
import type { ReportEntityId } from '@/types/reports'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  const sb = createServerClient()
  const alive: ReportEntityId[] = []
  const missing: ReportEntityId[] = []
  const auxMissing: string[] = []

  await Promise.all(
    REPORT_ENTITIES.map(async (entity) => {
      const { error } = await sb.from(entity.table).select('*', { head: true, count: 'exact' }).limit(1)
      if (error) {
        missing.push(entity.id)
      } else {
        alive.push(entity.id)
      }
    }),
  )

  // Separate probe for expediente_documentos (Template 8 gate)
  const { error: edErr } = await sb
    .from('expediente_documentos')
    .select('*', { head: true, count: 'exact' })
    .limit(1)
  const expedienteAlive = !edErr
  if (!expedienteAlive) auxMissing.push('expediente_documentos')

  return NextResponse.json({
    data: { alive, missing, expedienteAlive, auxMissing },
    error: null,
  })
}
