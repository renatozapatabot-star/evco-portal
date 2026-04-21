/**
 * GET /api/leads/export?stage=X&q=Y — admin/broker CSV download.
 *
 * Streams a CSV of leads filtered by the same ?stage= / ?q= params
 * the pipeline page uses. Useful for:
 *   - Board meetings ("send me the sales pipeline")
 *   - Backup / sanity-check before a migration
 *   - Ad-hoc analysis outside the portal
 *
 * Never exposed publicly — admin/broker only. CSRF doesn't apply
 * to GET methods.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth/session-guards'
import { createServerClient } from '@/lib/supabase-server'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  type LeadRow,
  type LeadStage,
  type LeadSource,
} from '@/lib/leads/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Escape a value for CSV: wrap in quotes, double internal quotes. */
function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const HEADERS = [
  'id',
  'firm_name',
  'contact_name',
  'contact_title',
  'contact_email',
  'contact_phone',
  'rfc',
  'stage',
  'stage_label',
  'stage_changed_at',
  'priority',
  'source',
  'source_label',
  'source_campaign',
  'source_url',
  'value_monthly_mxn',
  'industry',
  'aduana',
  'volume_note',
  'next_action_at',
  'next_action_note',
  'last_contact_at',
  'client_code_assigned',
  'converted_at',
  'created_at',
  'updated_at',
]

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdminSession()
  if (authError) return authError

  const stageParam = req.nextUrl.searchParams.get('stage') ?? ''
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
  const filterStage = (LEAD_STAGES as readonly string[]).includes(stageParam)
    ? (stageParam as LeadStage)
    : null

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'fetch_failed' } },
      { status: 500 },
    )
  }

  const rows = ((data ?? []) as LeadRow[]).filter((r) => {
    if (filterStage && r.stage !== filterStage) return false
    if (q) {
      const firm = (r.firm_name ?? '').toLowerCase()
      const contact = (r.contact_name ?? '').toLowerCase()
      if (!firm.includes(q) && !contact.includes(q)) return false
    }
    return true
  })

  const lines: string[] = []
  lines.push(HEADERS.join(','))
  for (const r of rows) {
    lines.push(
      [
        esc(r.id),
        esc(r.firm_name),
        esc(r.contact_name),
        esc(r.contact_title),
        esc(r.contact_email),
        esc(r.contact_phone),
        esc(r.rfc),
        esc(r.stage),
        esc(LEAD_STAGE_LABELS[r.stage as LeadStage] ?? r.stage),
        esc(r.stage_changed_at),
        esc(r.priority),
        esc(r.source),
        esc(LEAD_SOURCE_LABELS[r.source as LeadSource] ?? r.source),
        esc(r.source_campaign),
        esc(r.source_url),
        esc(r.value_monthly_mxn),
        esc(r.industry),
        esc(r.aduana),
        esc(r.volume_note),
        esc(r.next_action_at),
        esc(r.next_action_note),
        esc(r.last_contact_at),
        esc(r.client_code_assigned),
        esc(r.converted_at),
        esc(r.created_at),
        esc(r.updated_at),
      ].join(','),
    )
  }

  const csv = lines.join('\n')
  const ts = new Date().toISOString().slice(0, 10)
  const filename = filterStage
    ? `leads-${filterStage}-${ts}.csv`
    : `leads-${ts}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
