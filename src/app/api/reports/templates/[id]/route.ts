/**
 * Block 3 · Dynamic Report Builder — single template GET / PATCH / DELETE.
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

const UUID = z.string().uuid()

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.unknown().optional(),
  scope: z.enum(['private', 'team']).optional(),
  schedule_cron: z.string().max(120).nullable().optional(),
  schedule_recipients: z.array(z.string().email().max(256)).max(20).nullable().optional(),
})

async function loadTemplate(id: string, companyId: string) {
  const sb = createServerClient()
  const { data, error } = await sb
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()
  return { data: data as ReportTemplateRow | null, error }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }
  const { id } = await params
  if (!UUID.safeParse(id).success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } },
      { status: 400 },
    )
  }
  const { data, error } = await loadTemplate(id, session.companyId)
  if (error || !data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Plantilla no encontrada' } },
      { status: 404 },
    )
  }
  return NextResponse.json({ data, error: null })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }
  const { id } = await params
  if (!UUID.safeParse(id).success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } },
      { status: 400 },
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
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const existing = await loadTemplate(id, session.companyId)
  if (!existing.data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Plantilla no encontrada' } },
      { status: 404 },
    )
  }
  if (existing.data.scope === 'seed') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Las plantillas de AGUILA no son editables' } },
      { status: 403 },
    )
  }
  const userId = `${session.companyId}:${session.role}`
  if (existing.data.scope === 'private' && existing.data.created_by !== userId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'No puedes editar una plantilla ajena' } },
      { status: 403 },
    )
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.scope !== undefined) patch.scope = parsed.data.scope
  if (parsed.data.schedule_cron !== undefined) patch.schedule_cron = parsed.data.schedule_cron
  if (parsed.data.schedule_recipients !== undefined) {
    patch.schedule_recipients = parsed.data.schedule_recipients
  }
  if (parsed.data.config !== undefined) {
    const cfg = parseReportConfig(parsed.data.config)
    if (!cfg.ok) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: cfg.message } },
        { status: 400 },
      )
    }
    patch.config = cfg.config
  }

  const sb = createServerClient()
  const { data, error } = await sb
    .from('report_templates')
    .update(patch)
    .eq('id', id)
    .eq('company_id', session.companyId)
    .select('*')
    .single()
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  void logDecision({
    decision_type: 'report_template_updated',
    decision: `template:${id}:updated`,
    reasoning: `Template updated by ${session.role}`,
    dataPoints: { id, fields: Object.keys(patch) },
    company_id: session.companyId,
  })
  return NextResponse.json({ data, error: null })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }
  const { id } = await params
  if (!UUID.safeParse(id).success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } },
      { status: 400 },
    )
  }
  const existing = await loadTemplate(id, session.companyId)
  if (!existing.data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Plantilla no encontrada' } },
      { status: 404 },
    )
  }
  if (existing.data.scope === 'seed') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Las plantillas de AGUILA no se eliminan' } },
      { status: 403 },
    )
  }
  const userId = `${session.companyId}:${session.role}`
  if (existing.data.scope === 'private' && existing.data.created_by !== userId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'No puedes eliminar una plantilla ajena' } },
      { status: 403 },
    )
  }

  const sb = createServerClient()
  const { error } = await sb.from('report_templates').delete().eq('id', id).eq('company_id', session.companyId)
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  void logDecision({
    decision_type: 'report_template_deleted',
    decision: `template:${id}:deleted`,
    reasoning: `Template deleted by ${session.role}`,
    company_id: session.companyId,
  })
  return NextResponse.json({ data: { ok: true }, error: null })
}
