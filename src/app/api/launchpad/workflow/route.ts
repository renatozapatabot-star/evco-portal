import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { getWorkflowDetail, completeWorkflow } from '@/lib/launchpad-actions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VALID_SOURCES = [
  'agent_decisions',
  'pedimento_drafts',
  'documento_solicitudes',
  'expediente_documentos',
  'workflow_events',
]

const VALID_ACTIONS = ['confirm', 'correct', 'approve', 'reject', 'call_done']

/**
 * GET /api/launchpad/workflow?source_table=X&source_id=Y
 * Returns detailed data for rendering an inline workflow panel.
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(
    req.cookies.get('portal_session')?.value || '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const sourceTable = req.nextUrl.searchParams.get('source_table') || ''
  const sourceId = req.nextUrl.searchParams.get('source_id') || ''

  if (!VALID_SOURCES.includes(sourceTable) || !sourceId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid source_table or source_id' } },
      { status: 400 },
    )
  }

  const companyId =
    req.cookies.get('company_id')?.value || session.companyId

  const detail = await getWorkflowDetail(supabase, companyId, sourceTable, sourceId)

  if (!detail) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Action not found' } },
      { status: 404 },
    )
  }

  return NextResponse.json({ data: detail, error: null })
}

/**
 * POST /api/launchpad/workflow
 * Complete a workflow action (confirm, correct, approve, reject, call_done).
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(
    req.cookies.get('portal_session')?.value || '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 },
    )
  }

  const sourceTable = String(body.source_table || '')
  const sourceId = String(body.source_id || '')
  const actionType = String(body.action_type || '')

  if (
    !VALID_SOURCES.includes(sourceTable) ||
    !sourceId ||
    !VALID_ACTIONS.includes(actionType)
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Required: source_table, source_id, action_type (confirm|correct|approve|reject|call_done)',
        },
      },
      { status: 400 },
    )
  }

  const companyId =
    req.cookies.get('company_id')?.value || session.companyId

  const result = await completeWorkflow(supabase, companyId, sourceTable, sourceId, {
    action_type: actionType as 'confirm' | 'correct' | 'approve' | 'reject' | 'call_done',
    corrected_to: body.corrected_to as string | undefined,
    correction_note: body.correction_note as string | undefined,
  })

  if (!result.success) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: result.error || 'Unknown error' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
