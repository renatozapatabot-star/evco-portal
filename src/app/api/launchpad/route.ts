import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  scoreLaunchpadActions,
  getCruzAutoActions,
  type LaunchpadData,
} from '@/lib/launchpad-actions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * GET /api/launchpad
 * Returns top 3 scored actions + CRUZ auto-actions for today.
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

  // Session-derived scope. Query param allowed for internal roles;
  // raw company_id cookie is forgeable (core-invariants rule 15) and
  // never consulted.
  const isInternal = ['admin', 'broker', 'operator', 'contabilidad', 'owner'].includes(session.role)
  const paramCompany = req.nextUrl.searchParams.get('company_id')
  const companyId = (isInternal && paramCompany) || session.companyId

  const [scored, auto] = await Promise.all([
    scoreLaunchpadActions(supabase, companyId),
    getCruzAutoActions(supabase, companyId),
  ])

  const data: LaunchpadData = {
    actions: scored.actions,
    completed_count: scored.completed_count,
    auto_actions: auto.auto_actions,
    total_time_saved: auto.total_time_saved,
  }

  return NextResponse.json({ data, error: null })
}

/**
 * POST /api/launchpad
 * Mark an action as completed or postponed.
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 },
    )
  }

  const { source_table, source_id, action } = body as Record<string, string>

  if (!source_table || !source_id || !['complete', 'postpone'].includes(action)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Required: source_table, source_id, action (complete|postpone)',
        },
      },
      { status: 400 },
    )
  }

  // Session-derived scope (same contract as GET). Cookies not trusted.
  const isInternalPost = ['admin', 'broker', 'operator', 'contabilidad', 'owner'].includes(session.role)
  const paramCompanyPost = req.nextUrl.searchParams.get('company_id')
  const companyId = (isInternalPost && paramCompanyPost) || session.companyId

  // YYYY-MM-DD in Laredo timezone for DB storage
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

  const { error } = await supabase.from('launchpad_completions').upsert(
    {
      company_id: companyId,
      action_date: today,
      source_table,
      source_id,
      status: action === 'complete' ? 'completed' : 'postponed',
    },
    { onConflict: 'company_id,action_date,source_table,source_id' },
  )

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { success: true }, error: null })
}
