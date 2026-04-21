/**
 * GET  /api/leads/[id]/activities — list timeline rows for a lead.
 * POST /api/leads/[id]/activities — log a manual activity (call, note,
 *                                   email, meeting, demo_sent).
 *
 * Admin/broker only. CSRF-protected via middleware (not exempt).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  MANUAL_ACTIVITY_KINDS,
  type LeadActivityKind,
  type LeadActivityRow,
} from '@/lib/leads/types'
import { writeActivity } from '@/lib/leads/activities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_SUMMARY = 1000

async function requireAdminSession() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) return null
  if (!['admin', 'broker'].includes(session.role)) return null
  return session
}

function sanitizeSummary(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_SUMMARY)
}

function sanitizeIsoDate(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'admin/broker only' } },
      { status: 401 },
    )
  }
  const { id } = await ctx.params
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('occurred_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'fetch_failed' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: (data ?? []) as LeadActivityRow[],
    error: null,
  })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession()
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'admin/broker only' } },
      { status: 401 },
    )
  }
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'invalid_json' } },
      { status: 400 },
    )
  }

  const kind = body.kind
  if (!(MANUAL_ACTIVITY_KINDS as readonly string[]).includes(String(kind))) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'invalid_kind' } },
      { status: 400 },
    )
  }

  const summary = sanitizeSummary(body.summary)
  if (!summary) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'summary_required' } },
      { status: 400 },
    )
  }

  const occurredAt = sanitizeIsoDate(body.occurred_at)
  if (occurredAt === undefined) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'invalid_occurred_at' } },
      { status: 400 },
    )
  }

  const supabase = createServerClient()

  // Verify the lead exists before inserting (prevents orphan rows when
  // CASCADE FK isn't available on a rollback edge case).
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (leadErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'fetch_failed' } },
      { status: 500 },
    )
  }
  if (!lead) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'lead_not_found' } },
      { status: 404 },
    )
  }

  await writeActivity(supabase, {
    lead_id: id,
    kind: kind as LeadActivityKind,
    summary,
    actor_user_id: null,
    actor_name: session.role,
    occurred_at: occurredAt ?? new Date().toISOString(),
  })

  // Opportunistically bump last_contact_at on touchpoint kinds so the
  // main /admin/leads list stays honest without an explicit edit.
  const TOUCHPOINT_KINDS: LeadActivityKind[] = [
    'call',
    'email_sent',
    'email_received',
    'meeting',
    'demo_sent',
  ]
  if (TOUCHPOINT_KINDS.includes(kind as LeadActivityKind)) {
    try {
      await supabase
        .from('leads')
        .update({ last_contact_at: occurredAt ?? new Date().toISOString() })
        .eq('id', id)
    } catch {
      // best-effort
    }
  }

  // Re-read the most recent row so the caller gets the canonical record
  // (including the id + server-generated timestamps).
  const { data: inserted } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(
    { data: (inserted ?? null) as LeadActivityRow | null, error: null },
    { status: 201 },
  )
}
