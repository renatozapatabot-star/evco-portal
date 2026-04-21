/**
 * Block 5 — GET/POST /api/classification/configs
 *
 * Per-cliente default config storage. GET loads the default for the
 * calling session's company_id; POST upserts it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import {
  DEFAULT_CONFIG,
  DEFAULT_PRINT_TOGGLES,
  type ClassificationSheetConfig,
} from '@/types/classification'

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

function normalizeConfig(
  input: Partial<ClassificationSheetConfig> | undefined,
): ClassificationSheetConfig {
  return {
    grouping_mode: input?.grouping_mode ?? DEFAULT_CONFIG.grouping_mode,
    ordering_mode: input?.ordering_mode ?? DEFAULT_CONFIG.ordering_mode,
    specific_description: input?.specific_description ?? DEFAULT_CONFIG.specific_description,
    restriction_print_mode: input?.restriction_print_mode ?? DEFAULT_CONFIG.restriction_print_mode,
    print_toggles: { ...DEFAULT_PRINT_TOGGLES, ...(input?.print_toggles ?? {}) },
    email_recipients: Array.isArray(input?.email_recipients) ? input!.email_recipients! : [],
  }
}

export async function GET() {
  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('classification_sheet_configs')
    .select(
      'grouping_mode, ordering_mode, specific_description, restriction_print_mode, print_toggles, email_recipients',
    )
    .eq('cliente_id', session.companyId)
    .eq('company_id', session.companyId)
    .maybeSingle()
  if (error) return err('DB_ERROR', error.message, 500)

  const config = data
    ? normalizeConfig(data as Partial<ClassificationSheetConfig>)
    : DEFAULT_CONFIG

  return NextResponse.json({ data: { config }, error: null })
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const body = (await request.json().catch(() => ({}))) as {
    config?: Partial<ClassificationSheetConfig>
  }
  const config = normalizeConfig(body.config)

  const supabase = createServerClient()
  const { error } = await supabase.from('classification_sheet_configs').upsert(
    {
      cliente_id: session.companyId,
      company_id: session.companyId,
      grouping_mode: config.grouping_mode,
      ordering_mode: config.ordering_mode,
      specific_description: config.specific_description,
      restriction_print_mode: config.restriction_print_mode,
      print_toggles: config.print_toggles,
      email_recipients: config.email_recipients,
      is_default: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cliente_id,company_id' },
  )
  if (error) return err('DB_ERROR', error.message, 500)

  return NextResponse.json({ data: { ok: true, config }, error: null })
}
