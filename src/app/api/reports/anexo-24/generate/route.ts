/**
 * CRUZ · Anexo 24 Formato 53 generator.
 *
 * Two entry points share the same pipeline:
 *
 *   GET  /api/reports/anexo-24/generate?format=pdf|xlsx
 *     Streams the artifact directly as a download. This is the
 *     primary path used by the client button — no storage round-trip,
 *     no waiting for upload, no secondary click.
 *
 *   POST /api/reports/anexo-24/generate
 *     Legacy JSON path: generates, uploads both artifacts to
 *     `anexo-24-exports`, logs the decision, returns public URLs.
 *     Kept alive for cron + operator tooling that depends on the
 *     upload-then-link flow.
 *
 * Both paths use the SAME row set as `/anexo-24` (active-parts
 * filtered) so the SKU count on screen matches the partidas in the
 * export — no more "shows 44, exports 10000".
 *
 * Error discipline: every failure returns a real diagnostic message
 * (bucket name, row count, SQL error) instead of the generic
 * "Intenta de nuevo en unos minutos" — the user can't fix what the
 * portal won't describe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  type Anexo24Row,
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
const DEFAULT_PARTIDAS_LIMIT = 20000

const BodySchema = z.object({
  date_from: z.string().regex(ISO_DATE).nullable().optional(),
  date_to: z.string().regex(ISO_DATE).nullable().optional(),
  company_id: z.string().min(1).nullable().optional(),
})

interface PartidaRow {
  cve_trafico: string | null
  cve_producto: string | null
  fraccion_arancelaria: string | null
  fraccion: string | null
  descripcion: string | null
  cantidad: number | null
  precio_unitario: number | null
  umc: string | null
}

interface TraficoLite {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  proveedores: string | null
  regimen: string | null
  pais_procedencia: string | null
}

function isTmec(regimen: string | null): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}

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

/**
 * Shared core — resolves session, pulls rows, generates both artifacts.
 * Returns the buffers + meta; route handlers decide whether to stream,
 * upload, or both.
 */
async function buildFormato53(request: NextRequest, overrides?: { dateFrom?: string; dateTo?: string; companyIdOverride?: string | null }): Promise<BuildResult> {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return { ok: false, error: { status: 401, code: 'UNAUTHORIZED', message: 'Sesión inválida. Vuelve a iniciar sesión.' } }
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal && overrides?.companyIdOverride
    ? overrides.companyIdOverride
    : session.companyId

  const dateFrom = overrides?.dateFrom ?? null
  const dateTo = overrides?.dateTo ?? null

  // Active parts — the same filter the /anexo-24 page uses. Without
  // this the export contains the full 290K partidas mirror instead of
  // the ~693 parts the client actually imported.
  const active = await getActiveCveProductos(supabase, companyId)
  const activeList = activeCvesArray(active)

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_pago, fecha_llegada, proveedores, regimen, pais_procedencia')
    .eq('company_id', companyId)
    .limit(5000)
  if (dateFrom) traficoQ = traficoQ.gte('fecha_llegada', dateFrom)
  if (dateTo) traficoQ = traficoQ.lte('fecha_llegada', dateTo)

  let partidaQ = supabase
    .from('globalpc_partidas')
    .select('cve_trafico, cve_producto, fraccion_arancelaria, fraccion, descripcion, cantidad, precio_unitario, umc')
    .eq('company_id', companyId)
    .limit(DEFAULT_PARTIDAS_LIMIT)
  if (activeList.length > 0) {
    partidaQ = partidaQ.in('cve_producto', activeList)
  }

  const [partidaRes, traficoRes] = await Promise.all([partidaQ, traficoQ])

  if (partidaRes.error) {
    return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando partidas: ${partidaRes.error.message}` } }
  }
  if (traficoRes.error) {
    return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando tráficos: ${traficoRes.error.message}` } }
  }

  const partidas = (partidaRes.data ?? []) as PartidaRow[]
  const traficos = (traficoRes.data ?? []) as TraficoLite[]
  const traficoMap = new Map<string, TraficoLite>()
  for (const t of traficos) traficoMap.set(t.trafico, t)

  const rows: Anexo24Row[] = []
  let seq = 0
  for (const p of partidas) {
    if (!p.cve_trafico) continue
    const t = traficoMap.get(p.cve_trafico)
    if (!t) continue
    const fecha = t.fecha_pago ?? t.fecha_llegada ?? null
    if (dateFrom && fecha && fecha < dateFrom) continue
    if (dateTo && fecha && fecha > dateTo) continue
    seq++
    rows.push({
      consecutivo: seq,
      pedimento: t.pedimento,
      fecha,
      trafico: t.trafico,
      fraccion: p.fraccion_arancelaria ?? p.fraccion,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      umc: p.umc,
      valor_usd: p.precio_unitario,
      proveedor: t.proveedores,
      pais_origen: t.pais_procedencia,
      regimen: t.regimen,
      tmec: isTmec(t.regimen),
    })
  }

  // Zero-row guard — stream still works but surface the reality.
  // The PDF renders the empty-rows table cleanly; the caller sees
  // row_count: 0 and can decide whether to abort (client button does).
  const rawClientName = decodeURIComponent(request.cookies.get('company_name')?.value ?? '')
  const clientName = cleanCompanyDisplayName(rawClientName) || companyId

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
    rows,
  }

  let artifacts: { excel: Buffer; pdf: Buffer }
  try {
    artifacts = await generateAnexo24(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { status: 500, code: 'RENDER_ERROR', message: `Error generando el Formato 53: ${msg}` } }
  }

  return {
    ok: true,
    data,
    artifacts,
    session,
    companyId,
    actor,
    generado_en,
  }
}

/**
 * GET — streaming download. Triggered by the client button so the user
 * gets a real browser download (respects iOS save-to-Files behavior,
 * no blocked popups, no secondary tap).
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

  const result = await buildFormato53(request, { dateFrom, dateTo, companyIdOverride: companyOverride })
  if (!result.ok) {
    return jsonError(result.error.code, result.error.message, result.error.status)
  }

  // Audit log — fire-and-forget. Don't block the download on a log write.
  // The client still sees the PDF even if the log fails; the ops team
  // sees a Telegram alert on logDecision errors via its own path.
  void logDecision({
    company_id: result.companyId,
    decision_type: 'anexo_24_generated',
    decision: `Formato 53 descargado (${format.toUpperCase()}, ${result.data.rows.length} partidas)`,
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
 * Kept for cron/operator tooling. On upload failure, returns URLs for
 * the streaming GET fallback so the caller can still retrieve the
 * artifact by re-requesting.
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

  const result = await buildFormato53(request, {
    dateFrom: parsed.data.date_from ?? undefined,
    dateTo: parsed.data.date_to ?? undefined,
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

  // Upload failures fall back to the streaming URLs — a real diagnostic
  // message travels back to the caller so they know which surface to
  // expect when they render the result.
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
