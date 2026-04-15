/**
 * ZAPATA AI · V1.5 F2 — POST /api/quickbooks/export
 *
 * Creates a `quickbooks_export_jobs` row and kicks off the runner. If the
 * runner completes within ~10s we return the final status; otherwise the
 * client polls `GET /api/quickbooks/export/[id]`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { runExportJob } from '@/lib/quickbooks-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  entity: z.enum(['invoices', 'bills', 'customers', 'vendors', 'all']),
  format: z.enum(['IIF', 'CSV']).default('IIF'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const ALLOWED_ROLES = new Set(['contabilidad', 'admin', 'broker'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para exportar', 403)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Cuerpo inválido', 400)
  }

  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400,
    )
  }

  const { entity, format, dateFrom, dateTo } = parsed.data

  const { data: job, error: insertErr } = await supabase
    .from('quickbooks_export_jobs')
    .insert({
      company_id: session.companyId,
      entity,
      format,
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !job) {
    return errorResponse('INTERNAL_ERROR', insertErr?.message ?? 'No se pudo crear la exportación', 500)
  }

  // Run with a soft timeout. The runner always completes (success or failure)
  // — if we hit 10s we return pending and let the client poll.
  const runner = runExportJob(job.id)
  const timeout = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 10_000))
  const outcome = await Promise.race([runner.then(() => 'done' as const), timeout])

  if (outcome === 'timeout') {
    return NextResponse.json({ data: { id: job.id, status: 'running' }, error: null })
  }

  const { data: finalRow } = await supabase
    .from('quickbooks_export_jobs')
    .select('id, status, file_path, file_bytes, row_count, error')
    .eq('id', job.id)
    .maybeSingle()

  return NextResponse.json({ data: finalRow, error: null })
}
