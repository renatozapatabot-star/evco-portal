/**
 * PATCH /api/leads/[id] — update a lead (admin/broker only).
 * GET   /api/leads/[id] — fetch a lead (admin/broker only).
 *
 * Editable fields (whitelisted; everything else is rejected):
 *   stage · priority · contact_name · contact_email · contact_phone ·
 *   rfc · value_monthly_mxn · next_action_at · next_action_note ·
 *   last_contact_at · industry · aduana · volume_note · notes
 *
 * Never-editable: id · firm_name · source · source_campaign ·
 * source_url · created_at (immutable audit trail).
 */

import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth/session-guards'
import { createServerClient } from '@/lib/supabase-server'
import {
  LEAD_STAGES,
  type LeadStage,
  type LeadPriority,
  type LeadRow,
} from '@/lib/leads/types'
import { diffToActivities, writeActivities } from '@/lib/leads/activities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIORITIES: readonly LeadPriority[] = ['high', 'normal', 'low'] as const

function sanitize(v: unknown, max: number): string | null | undefined {
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function sanitizeNumber(v: unknown): number | null | undefined {
  if (v === null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function sanitizeIsoDate(v: unknown): string | null | undefined {
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  if (!trimmed) return null
  // Accept ISO strings (YYYY-MM-DD or full timestamptz). Reject otherwise.
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error: authError } = await requireAdminSession()
  if (authError) return authError
  const { id } = await ctx.params

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'fetch_failed' } },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'lead_not_found' } },
      { status: 404 },
    )
  }

  return NextResponse.json({ data: data as LeadRow, error: null })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error: authError } = await requireAdminSession()
  if (authError) return authError
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

  const patch: Record<string, unknown> = {}

  if ('stage' in body) {
    const next = body.stage
    if (!(LEAD_STAGES as readonly string[]).includes(String(next))) {
      return NextResponse.json(
        {
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'invalid_stage' },
        },
        { status: 400 },
      )
    }
    patch.stage = next as LeadStage
  }

  if ('priority' in body) {
    const next = body.priority
    if (!(PRIORITIES as readonly string[]).includes(String(next))) {
      return NextResponse.json(
        {
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'invalid_priority' },
        },
        { status: 400 },
      )
    }
    patch.priority = next as LeadPriority
  }

  const stringFields: Array<[keyof LeadRow, number]> = [
    ['contact_name', 120],
    ['contact_email', 200],
    ['contact_phone', 40],
    ['rfc', 13],
    ['next_action_note', 500],
    ['industry', 50],
    ['aduana', 50],
    ['volume_note', 500],
    ['notes', 4000],
  ]
  for (const [field, max] of stringFields) {
    if (field in body) {
      const v = sanitize(body[field as string], max)
      if (v !== undefined) patch[field as string] = v
    }
  }

  if ('value_monthly_mxn' in body) {
    const v = sanitizeNumber(body.value_monthly_mxn)
    if (v !== undefined) patch.value_monthly_mxn = v
  }

  if ('next_action_at' in body) {
    const v = sanitizeIsoDate(body.next_action_at)
    if (v !== undefined) patch.next_action_at = v
  }

  if ('last_contact_at' in body) {
    const v = sanitizeIsoDate(body.last_contact_at)
    if (v !== undefined) patch.last_contact_at = v
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'no_updatable_fields' } },
      { status: 400 },
    )
  }

  const supabase = createServerClient()

  // Read current row so we can diff old vs new and emit activities.
  const { data: before, error: readErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (readErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'update_failed' } },
      { status: 500 },
    )
  }
  if (!before) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'lead_not_found' } },
      { status: 404 },
    )
  }

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'update_failed' } },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'lead_not_found' } },
      { status: 404 },
    )
  }

  // Best-effort audit trail. Never fail the edit on a timeline write error.
  // HMAC session doesn't carry a user id; the role + companyId is the best
  // actor tag we have today ("admin" / "broker" / "internal").
  const activities = diffToActivities(id, before as LeadRow, data as LeadRow, {
    userId: null,
    name: session.role,
  })
  if (activities.length > 0) {
    await writeActivities(supabase, activities)
  }

  return NextResponse.json({ data: data as LeadRow, error: null })
}
