/**
 * Block 5 — POST /api/classification/:trafico_id/generate
 *
 * Session-verified. Company-scoped. Runs engine → renders PDF + Excel →
 * uploads to Supabase Storage (`classification-sheets` bucket) → writes
 * history row in `classification_sheets` → emits `workflow_events` event
 * `classification_sheet_generated` → logs `operational_decisions`.
 *
 * Returns: { ok, sheetId, pdfUrl, excelUrl, summary, warnings }.
 * If storage bucket is missing, returns a friendly 500.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { generateClassificationSheet } from '@/lib/classification-engine'
import { renderClassificationPdf } from '@/lib/classification-pdf'
import { buildClassificationXlsx } from '@/lib/classification-excel'
import {
  DEFAULT_CONFIG,
  DEFAULT_PRINT_TOGGLES,
  type ClassificationSheetConfig,
  type Producto,
  type GeneratedSheetMeta,
} from '@/types/classification'

const BUCKET = 'classification-sheets'

type TraficoRow = {
  trafico: string
  company_id: string | null
  regimen: string | null
  // tipo_operacion is not in the live traficos schema — kept optional
  // so existing downstream code can read undefined without throwing.
  tipo_operacion?: string | null
}

type PartidaRow = {
  id?: string | null
  cve_producto?: string | null
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  descripcion?: string | null
  umc?: string | null
  pais_origen?: string | null
  cantidad?: number | null
  valor_comercial?: number | null
  tmec?: boolean | null
}

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

function normalizeConfig(body: unknown): ClassificationSheetConfig {
  const raw = (body ?? {}) as Record<string, unknown>
  const cfg = (raw.config ?? raw) as Partial<ClassificationSheetConfig>
  return {
    grouping_mode: (cfg.grouping_mode as ClassificationSheetConfig['grouping_mode']) ?? DEFAULT_CONFIG.grouping_mode,
    ordering_mode: (cfg.ordering_mode as ClassificationSheetConfig['ordering_mode']) ?? DEFAULT_CONFIG.ordering_mode,
    specific_description:
      (cfg.specific_description as ClassificationSheetConfig['specific_description']) ??
      DEFAULT_CONFIG.specific_description,
    restriction_print_mode:
      (cfg.restriction_print_mode as ClassificationSheetConfig['restriction_print_mode']) ??
      DEFAULT_CONFIG.restriction_print_mode,
    print_toggles: { ...DEFAULT_PRINT_TOGGLES, ...(cfg.print_toggles ?? {}) },
    email_recipients: Array.isArray(cfg.email_recipients) ? cfg.email_recipients : [],
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trafico_id: string }> },
) {
  const { trafico_id } = await context.params
  const traficoId = decodeURIComponent(trafico_id)

  const session = await verifySession(
    (await cookies()).get('portal_session')?.value ?? '',
  )
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin' || session.role === 'operator'

  // Resolve tráfico + company_id for tenant scoping.
  let scopeQ = supabase
    .from('traficos')
    .select('trafico, company_id, regimen')
    .eq('trafico', traficoId)
  if (!isInternal) scopeQ = scopeQ.eq('company_id', session.companyId)
  const { data: scopeRaw, error: scopeErr } = await scopeQ.maybeSingle()
  if (scopeErr) return err('DB_ERROR', scopeErr.message, 500)
  if (!scopeRaw) return err('NOT_FOUND', 'Tráfico no encontrado', 404)
  const trafico = scopeRaw as TraficoRow
  const companyId = trafico.company_id ?? session.companyId

  // Cliente name lookup — best-effort.
  let clienteName = companyId
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('company_id, name')
      .eq('company_id', companyId)
      .maybeSingle()
    const c = company as { name: string | null } | null
    if (c?.name) clienteName = c.name
  } catch {
    // fall through
  }

  const config = normalizeConfig(await request.json().catch(() => ({})))

  // Pull partidas/productos — globalpc_partidas is the de-facto productos
  // list per tráfico.
  const { data: partidasRaw, error: partidasErr } = await supabase
    .from('globalpc_partidas')
    .select(
      'id, cve_producto, fraccion_arancelaria, fraccion, descripcion, umc, pais_origen, cantidad, valor_comercial, tmec',
    )
    .eq('cve_trafico', traficoId)
    .limit(2000)
  if (partidasErr) return err('DB_ERROR', partidasErr.message, 500)

  const partidas = (partidasRaw as PartidaRow[] | null) ?? []
  const productos: Producto[] = partidas.map((p) => ({
    id: p.id ?? undefined,
    cve_producto: p.cve_producto ?? undefined,
    fraccion_arancelaria: p.fraccion_arancelaria ?? undefined,
    fraccion: p.fraccion ?? undefined,
    descripcion: p.descripcion ?? undefined,
    umc: p.umc ?? undefined,
    pais_origen: p.pais_origen ?? undefined,
    cantidad: p.cantidad ?? undefined,
    valor_comercial: p.valor_comercial ?? undefined,
    certificado_origen_tmec: p.tmec ?? undefined,
  }))

  const sheet = generateClassificationSheet(productos, config)

  const now = new Date()
  const generatedAt = now.toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const meta: GeneratedSheetMeta = {
    trafico_id: traficoId,
    cliente_id: companyId,
    cliente_name: clienteName,
    company_id: companyId,
    operator_name: `${session.companyId}:${session.role}`,
    regimen: trafico.regimen,
    tipo_operacion: trafico.tipo_operacion ?? null,
    generated_at: generatedAt,
  }

  // Render artifacts.
  let pdfBuf: Buffer
  let xlsxBuf: Buffer
  try {
    pdfBuf = await renderClassificationPdf(sheet, config, meta)
    xlsxBuf = buildClassificationXlsx(sheet, config)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'render failed'
    return err('RENDER_ERROR', msg, 500)
  }

  // Upload to Supabase Storage.
  const ts = Date.now()
  const pathBase = `${companyId}/${traficoId}/${ts}`
  const pdfPath = `${pathBase}.pdf`
  const xlsxPath = `${pathBase}.xlsx`

  const pdfUp = await supabase.storage
    .from(BUCKET)
    .upload(pdfPath, pdfBuf, { contentType: 'application/pdf', upsert: false })
  if (pdfUp.error) {
    const m = (pdfUp.error.message || '').toLowerCase()
    if (m.includes('not found') || m.includes('bucket')) {
      return err(
        'STORAGE_BUCKET_MISSING',
        'Bucket no configurado — contacta a Renato IV',
        500,
      )
    }
    return err('STORAGE_ERROR', pdfUp.error.message, 500)
  }

  const xlsxUp = await supabase.storage.from(BUCKET).upload(xlsxPath, xlsxBuf, {
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: false,
  })
  if (xlsxUp.error) return err('STORAGE_ERROR', xlsxUp.error.message, 500)

  const { data: pdfPub } = supabase.storage.from(BUCKET).getPublicUrl(pdfPath)
  const { data: xlsxPub } = supabase.storage.from(BUCKET).getPublicUrl(xlsxPath)

  // Insert history row.
  const { data: sheetRow, error: insertErr } = await supabase
    .from('classification_sheets')
    .insert({
      trafico_id: traficoId,
      cliente_id: companyId,
      company_id: companyId,
      generated_by: `${session.companyId}:${session.role}`,
      config: config,
      partidas_count: sheet.summary.partidas_count,
      total_value: sheet.summary.total_value,
      pdf_url: pdfPub?.publicUrl ?? null,
      excel_url: xlsxPub?.publicUrl ?? null,
    })
    .select('id')
    .single()
  if (insertErr) return err('DB_ERROR', insertErr.message, 500)

  const sheetId = (sheetRow as { id: string }).id

  // Emit workflow event — fire-and-forget so generation never fails on log.
  try {
    await supabase.from('workflow_events').insert({
      trigger_id: traficoId,
      event_type: 'classification_sheet_generated',
      workflow: 'classification',
      payload: {
        sheet_id: sheetId,
        grouping_mode: config.grouping_mode,
        ordering_mode: config.ordering_mode,
        partidas_count: sheet.summary.partidas_count,
        total_value: sheet.summary.total_value,
        pdf_url: pdfPub?.publicUrl,
        excel_url: xlsxPub?.publicUrl,
      },
    })
  } catch {
    // Non-fatal.
  }

  try {
    await supabase.from('operational_decisions').insert({
      decision_type: 'classification_sheet_generated',
      entity_type: 'trafico',
      entity_id: traficoId,
      actor: `${session.companyId}:${session.role}`,
      payload: { sheet_id: sheetId, config, summary: sheet.summary },
    })
  } catch {
    // Non-fatal.
  }

  return NextResponse.json({
    data: {
      ok: true,
      sheetId,
      pdfUrl: pdfPub?.publicUrl ?? null,
      excelUrl: xlsxPub?.publicUrl ?? null,
      summary: sheet.summary,
      warnings: sheet.warnings,
    },
    error: null,
  })
}
