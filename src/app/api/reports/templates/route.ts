/**
 * Block 3 · Dynamic Report Builder — templates list + create.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { parseReportConfig } from '@/lib/report-config-validator'
import { logDecision } from '@/lib/decision-logger'
import type { ReportTemplateRow } from '@/types/reports'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  source_entity: z.string().min(1).max(64),
  config: z.unknown(),
  scope: z.enum(['private', 'team', 'seed']).default('private'),
  schedule_cron: z.string().max(120).nullable().optional(),
  schedule_recipients: z.array(z.string().email().max(256)).max(20).nullable().optional(),
  created_by_override: z.string().max(128).optional(), // used only by seed path
})

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
  const { data, error } = await sb
    .from('report_templates')
    .select('*')
    .eq('company_id', session.companyId)
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const userId = `${session.companyId}:${session.role}`
  const rows = (data ?? []) as ReportTemplateRow[]
  const grouped = {
    private: rows.filter((r) => r.scope === 'private' && r.created_by === userId),
    team: rows.filter((r) => r.scope === 'team'),
    seed: rows.filter((r) => r.scope === 'seed'),
  }
  return NextResponse.json({ data: grouped, error: null })
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }
  const cfgParse = parseReportConfig(parsed.data.config)
  if (!cfgParse.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: cfgParse.message } },
      { status: 400 },
    )
  }

  const sb = createServerClient()
  const userId = `${session.companyId}:${session.role}`
  const isInternal = session.role === 'broker' || session.role === 'admin'
  // Only internal roles can create seed-scope rows (used by the auto-seed path)
  const scope = parsed.data.scope === 'seed' && !isInternal ? 'private' : parsed.data.scope
  const createdBy = scope === 'seed' ? parsed.data.created_by_override ?? 'system:seed' : userId

  const { data, error } = await sb
    .from('report_templates')
    .insert({
      company_id: session.companyId,
      created_by: createdBy,
      name: parsed.data.name,
      source_entity: parsed.data.source_entity,
      config: cfgParse.config,
      scope,
      schedule_cron: parsed.data.schedule_cron ?? null,
      schedule_recipients: parsed.data.schedule_recipients ?? null,
    })
    .select('*')
    .single()

  if (error) {
    // Idempotent seed path swallows unique-violation (23505)
    if (scope === 'seed' && error.code === '23505') {
      return NextResponse.json({ data: { seeded: false, reason: 'duplicate' }, error: null })
    }
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  void logDecision({
    decision_type: 'report_template_saved',
    decision: `template:${parsed.data.name}:${scope}`,
    reasoning: `Template saved by ${session.role} in ${session.companyId}`,
    dataPoints: { scope, source: parsed.data.source_entity },
    company_id: session.companyId,
  })
  return NextResponse.json({ data, error: null })
}
