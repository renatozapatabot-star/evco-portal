/**
 * CRUZ · Anexo 24 generator (13-column GlobalPC parity).
 *
 * Two entry points share the same pipeline:
 *
 *   GET  /api/reports/anexo-24/generate?format=pdf|xlsx
 *     Streams the artifact directly as a download — no storage round-trip.
 *
 *   POST /api/reports/anexo-24/generate
 *     Legacy JSON path: generates, uploads to `anexo-24-exports`, logs the
 *     decision, returns public URLs. Kept for cron + operator tooling.
 *
 * Both paths read rows from `fetchAnexo24Rows` (src/lib/anexo24/fetchRows.ts)
 * — the same helper the screen at `/anexo-24` uses, so the partidas count
 * on screen matches the export rowcount byte-for-byte.
 *
 * Truncated exports refuse to render. Anexo 24 is a regulatory artifact;
 * a partial export is worse than none — better the user narrows the
 * range than hands SAT a quietly-incomplete file.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { fetchAnexo24Rows } from '@/lib/anexo24/fetchRows'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  type Anexo24Data,
} from '@/lib/anexo-24-export'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const BUCKET = 'anexo-24-exports'

const BodySchema = z.object({
  date_from: z.string().regex(ISO_DATE).nullable().optional(),
  date_to: z.string().regex(ISO_DATE).nullable().optional(),
  company_id: z.string().min(1).nullable().optional(),
})

function jsonError(code: string, message: string, status = 500) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

type BuildResult =
  | { ok: false; error: { status: number; code: string; message: string } }
  | {
      ok: true
      data: Anexo24Data
      artifacts: { excel: Buffer; pdf: Buffer }
      session: Awaited<ReturnType<typeof verifySession>>
      companyId: string
      actor: string
      generado_en: string
    }

async function buildAnexo24(
  request: NextRequest,
  overrides: { dateFrom: string; dateTo: string; companyIdOverride?: string | null },
): Promise<BuildResult> {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return { ok: false, error: { status: 401, code: 'UNAUTHORIZED', message: 'Sesión inválida. Vuelve a iniciar sesión.' } }
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal && overrides.companyIdOverride
    ? overrides.companyIdOverride
    : session.companyId
  if (!companyId) {
    return { ok: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Sesión sin company_id resoluble.' } }
  }

  const dateFrom = overrides.dateFrom
  const dateTo = overrides.dateTo

  let rowsResult
  try {
    rowsResult = await fetchAnexo24Rows({ supabase, companyId, dateFrom, dateTo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando partidas: ${msg}` } }
  }

  if (rowsResult.truncated) {
    return {
      ok: false,
      error: {
        status: 422,
        code: 'RANGE_TRUNCATED',
        message: 'El periodo solicitado excede el límite de partidas. Reduce el rango antes de exportar.',
      },
    }
  }

  // P0-A7 cookie-fence (preserved across PR #12's 13-col collapse): rebuild
  // client name from the verified companyId, not from the forgeable
  // company_name cookie. Pre-fix the rendered Anexo-24 PDF attribution
  // could be flipped to a different tenant via cookie tamper. PR #12
  // extracted the row assembly into fetchAnexo24Rows() so the inline
  // 41-column block that lived here is gone — but the cookie-fence
  // clientName lookup stays.
  const { data: clientRow } = await supabase
    .from('companies')
    .select('name')
    .eq('company_id', companyId)
    .maybeSingle()
  const clientName = cleanCompanyDisplayName((clientRow?.name as string | undefined) ?? '') || companyId
  const actor = `${session.companyId}:${session.role}`
  const generado_en = new Date().toISOString()

  const data: Anexo24Data = {
    meta: {
      company_id: companyId,
      cliente_nombre: clientName,
      date_from: dateFrom,
      date_to: dateTo,
      generado_en,
      generado_por: actor,
      patente: PATENTE,
      aduana: ADUANA,
    },
    rows: rowsResult.rows,
  }

  let artifacts: { excel: Buffer; pdf: Buffer }
  try {
    artifacts = await generateAnexo24(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { status: 500, code: 'RENDER_ERROR', message: `Error generando el Anexo 24: ${msg}` } }
  }

  return { ok: true, data, artifacts, session, companyId, actor, generado_en }
}

/**
 * GET — streaming download triggered by the client button.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase()
  const dateFrom = url.searchParams.get('date_from') ?? `${new Date().getUTCFullYear()}-01-01`
  const dateTo = url.searchParams.get('date_to') ?? new Date().toISOString().slice(0, 10)
  const companyOverride = url.searchParams.get('company_id')

  if (format !== 'pdf' && format !== 'xlsx') {
    return jsonError('VALIDATION_ERROR', 'format debe ser "pdf" o "xlsx"', 400)
  }
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    return jsonError('VALIDATION_ERROR', 'date_from y date_to deben tener formato YYYY-MM-DD', 400)
  }
  if (dateFrom > dateTo) {
    return jsonError('VALIDATION_ERROR', 'date_from no puede ser posterior a date_to', 400)
  }

  const result = await buildAnexo24(request, { dateFrom, dateTo, companyIdOverride: companyOverride })
  if (!result.ok) {
    return jsonError(result.error.code, result.error.message, result.error.status)
  }

  void logDecision({
    company_id: result.companyId,
    decision_type: 'anexo_24_generated',
    decision: `Anexo 24 descargado (${format.toUpperCase()}, ${result.data.rows.length} partidas)`,
    reasoning: 'Descarga directa por el usuario vía botón Anexo 24.',
    dataPoints: {
      format,
      date_from: dateFrom,
      date_to: dateTo,
      row_count: result.data.rows.length,
      actor: result.actor,
      streamed: true,
    },
  }).catch(() => { /* non-fatal */ })

  const filename = `anexo24_${result.companyId}_${dateFrom}_${dateTo}.${format}`
  const body = format === 'pdf' ? result.artifacts.pdf : result.artifacts.excel
  const contentType = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, private',
      'X-Anexo24-Rows': String(result.data.rows.length),
    },
  })
}

/**
 * POST — legacy JSON path. Generates, uploads, returns public URLs.
 */
export async function POST(request: NextRequest) {
  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    /* empty body is acceptable */
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Parámetros inválidos', 400)
  }

  const today = new Date().toISOString().slice(0, 10)
  const yearStart = `${new Date().getUTCFullYear()}-01-01`
  const dateFrom = parsed.data.date_from ?? yearStart
  const dateTo = parsed.data.date_to ?? today

  const result = await buildAnexo24(request, {
    dateFrom,
    dateTo,
    companyIdOverride: parsed.data.company_id ?? null,
  })
  if (!result.ok) {
    return jsonError(result.error.code, result.error.message, result.error.status)
  }

  const ts = Date.now()
  const pdfPath = buildAnexo24StoragePath({ companyId: result.companyId, timestamp: ts, kind: 'pdf' })
  const xlsxPath = buildAnexo24StoragePath({ companyId: result.companyId, timestamp: ts, kind: 'xlsx' })

  const [pdfUp, xlsxUp] = await Promise.all([
    supabase.storage.from(BUCKET).upload(pdfPath, new Uint8Array(result.artifacts.pdf), {
      contentType: 'application/pdf',
      upsert: false,
    }),
    supabase.storage.from(BUCKET).upload(xlsxPath, new Uint8Array(result.artifacts.excel), {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    }),
  ])

  if (pdfUp.error || xlsxUp.error) {
    const detail = [pdfUp.error?.message, xlsxUp.error?.message].filter(Boolean).join(' · ')
    const streamBase = `/api/reports/anexo-24/generate?date_from=${result.data.meta.date_from ?? ''}&date_to=${result.data.meta.date_to ?? ''}`
    return NextResponse.json({
      data: {
        pdf_url: `${streamBase}&format=pdf`,
        xlsx_url: `${streamBase}&format=xlsx`,
        row_count: result.data.rows.length,
        generado_en: result.generado_en,
        storage_fallback: true,
        storage_error: detail,
      },
      error: null,
    })
  }

  const pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(pdfPath).data.publicUrl
  const xlsxUrl = supabase.storage.from(BUCKET).getPublicUrl(xlsxPath).data.publicUrl

  await logDecision({
    company_id: result.companyId,
    decision_type: 'anexo_24_generated',
    decision: `Anexo 24 generado (${result.data.rows.length} partidas)`,
    reasoning: 'Generación vía POST (upload + public URL).',
    dataPoints: {
      pdf_url: pdfUrl,
      xlsx_url: xlsxUrl,
      date_from: result.data.meta.date_from,
      date_to: result.data.meta.date_to,
      row_count: result.data.rows.length,
      actor: result.actor,
    },
  })

  return NextResponse.json({
    data: {
      pdf_url: pdfUrl,
      xlsx_url: xlsxUrl,
      row_count: result.data.rows.length,
      generado_en: result.generado_en,
    },
    error: null,
  })
}
