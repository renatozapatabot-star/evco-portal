/**
 * CRUZ · V1.5 F2 — GET /api/quickbooks/export/[id]
 *
 * Polls the status of a QuickBooks export job. Returns a signed download URL
 * (10-minute TTL) when the job is `ready`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { signedDownloadURL } from '@/lib/quickbooks-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALLOWED_ROLES = new Set(['contabilidad', 'admin', 'broker'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso', 403)
  }

  const { id } = await context.params

  const { data: row, error } = await supabase
    .from('quickbooks_export_jobs')
    .select('id, company_id, entity, format, status, file_path, file_bytes, row_count, error, created_at, completed_at')
    .eq('id', id)
    .maybeSingle()

  if (error) return errorResponse('INTERNAL_ERROR', error.message, 500)
  if (!row) return errorResponse('NOT_FOUND', 'Exportación no encontrada', 404)
  if (row.company_id !== session.companyId) {
    return errorResponse('FORBIDDEN', 'Sin acceso a esta exportación', 403)
  }

  let downloadUrl: string | null = null
  if (row.status === 'ready' && row.file_path) {
    downloadUrl = await signedDownloadURL(row.file_path)
  }

  return NextResponse.json({
    data: {
      id: row.id,
      entity: row.entity,
      format: row.format,
      status: row.status,
      fileBytes: row.file_bytes,
      rowCount: row.row_count,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      downloadUrl,
    },
    error: null,
  })
}
