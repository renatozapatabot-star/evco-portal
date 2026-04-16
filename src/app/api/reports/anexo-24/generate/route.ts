/**
 * CRUZ · Block 10 — Anexo 24 generator API.
 *
 * POST /api/reports/anexo-24/generate
 *   body: { date_from?: string|null, date_to?: string|null, company_id?: string|null }
 *
 * Pipeline:
 *   1. verifySession — tenant-scoped; broker/admin can pass company_id override
 *   2. Build tenant-scoped row set from globalpc_partidas + traficos joins
 *   3. Call pure `generateAnexo24` — returns { pdf, excel } Buffers
 *   4. Upload BOTH to `anexo-24-exports` bucket
 *   5. Log `operational_decisions` with decision_type='anexo_24_generated'
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { PATENTE, ADUANA } from '@/lib/client-config'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  type Anexo24Row,
  type Anexo24Data,
} from '@/lib/anexo-24-export'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const BodySchema = z.object({
  date_from: z.string().regex(ISO_DATE).nullable().optional(),
  date_to: z.string().regex(ISO_DATE).nullable().optional(),
  company_id: z.string().min(1).nullable().optional(),
})

const BUCKET = 'anexo-24-exports'

interface PartidaRow {
  cve_trafico: string | null
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

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // empty body is acceptable
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Parámetros inválidos' } },
      { status: 400 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal && parsed.data.company_id
    ? parsed.data.company_id
    : session.companyId

  const dateFrom = parsed.data.date_from ?? null
  const dateTo = parsed.data.date_to ?? null

  const clientName = decodeURIComponent(request.cookies.get('company_name')?.value ?? '')

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_pago, fecha_llegada, proveedores, regimen, pais_procedencia')
    .eq('company_id', companyId)
    .limit(5000)
  if (dateFrom) traficoQ = traficoQ.gte('fecha_llegada', dateFrom)
  if (dateTo) traficoQ = traficoQ.lte('fecha_llegada', dateTo)

  const [partidaRes, traficoRes] = await Promise.all([
    supabase
      .from('globalpc_partidas')
      .select('cve_trafico, fraccion_arancelaria, fraccion, descripcion, cantidad, precio_unitario, umc')
      .eq('company_id', companyId)
      .limit(10000),
    traficoQ,
  ])

  if (partidaRes.error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: partidaRes.error.message } },
      { status: 500 },
    )
  }
  if (traficoRes.error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: traficoRes.error.message } },
      { status: 500 },
    )
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
    if (!t) continue // tenant-scoped: no trafico in range → skip
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

  const actor = `${session.companyId}:${session.role}`
  const generado_en = new Date().toISOString()

  const data: Anexo24Data = {
    meta: {
      company_id: companyId,
      cliente_nombre: clientName || companyId,
      date_from: dateFrom,
      date_to: dateTo,
      generado_en,
      generado_por: actor,
      patente: PATENTE,
      aduana: ADUANA,
    },
    rows,
  }

  const { pdf, excel } = await generateAnexo24(data)

  const ts = Date.now()
  const pdfPath = buildAnexo24StoragePath({ companyId, timestamp: ts, kind: 'pdf' })
  const xlsxPath = buildAnexo24StoragePath({ companyId, timestamp: ts, kind: 'xlsx' })

  const [pdfUp, xlsxUp] = await Promise.all([
    supabase.storage.from(BUCKET).upload(pdfPath, new Uint8Array(pdf), {
      contentType: 'application/pdf',
      upsert: false,
    }),
    supabase.storage.from(BUCKET).upload(
      xlsxPath,
      new Uint8Array(excel),
      {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      },
    ),
  ])

  if (pdfUp.error || xlsxUp.error) {
    const msg = pdfUp.error?.message ?? xlsxUp.error?.message ?? 'Storage error'
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500 },
    )
  }

  const pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(pdfPath).data.publicUrl
  const xlsxUrl = supabase.storage.from(BUCKET).getPublicUrl(xlsxPath).data.publicUrl

  await logDecision({
    company_id: companyId,
    decision_type: 'anexo_24_generated',
    decision: `Anexo 24 generado para ${companyId} (${rows.length} partidas)`,
    reasoning:
      'Generación placeholder; verificar columnas contra muestra de GlobalPC antes de uso oficial.',
    dataPoints: {
      pdf_url: pdfUrl,
      xlsx_url: xlsxUrl,
      date_from: dateFrom,
      date_to: dateTo,
      row_count: rows.length,
      actor,
    },
  })

  return NextResponse.json({
    data: {
      pdf_url: pdfUrl,
      xlsx_url: xlsxUrl,
      row_count: rows.length,
      generado_en,
    },
    error: null,
  })
}
