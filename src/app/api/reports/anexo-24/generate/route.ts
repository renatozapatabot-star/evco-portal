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
import { resolveProveedorName } from '@/lib/proveedor-names'
import { formatPedimento } from '@/lib/format/pedimento'
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

/**
 * Schema reality check (verified 2026-04-20):
 *
 *   globalpc_partidas has NO cve_trafico / descripcion / fraccion / umc.
 *   Actual columns: id, folio, cve_producto, cve_cliente, cantidad,
 *                   precio_unitario, peso, pais_origen, cve_proveedor.
 *
 *   The partida → trafico link runs through globalpc_facturas:
 *     facturas.cve_trafico = traficos.trafico
 *     partidas.folio       = facturas.folio
 *
 *   descripcion + fraccion live on globalpc_productos, resolved by
 *   (cve_cliente, cve_producto).
 *
 * This mirrors the join chain used by /embarques/[id] and
 * /api/auditoria-pdf — do not reinvent it.
 */
interface PartidaRaw {
  id: number
  folio: number | null
  cve_producto: string | null
  cve_cliente: string | null
  cantidad: number | null
  precio_unitario: number | null
  peso: number | null
  pais_origen: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  numero_item: number | null
}

interface FacturaEnriched {
  cve_trafico: string | null
  folio: number | null
  numero: string | null
  fecha_facturacion: string | null
  valor_comercial: number | null
  moneda: string | null
  incoterm: string | null
  cve_proveedor: string | null
}

interface TraficoLite {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  fecha_llegada: string | null
  proveedores: string | null
  regimen: string | null
  pais_procedencia: string | null
  aduana: string | null
  tipo_cambio: number | null
  peso_bruto: number | null
  importe_total: number | null
}

interface ProductoEnrichment {
  descripcion: string | null
  fraccion: string | null
  umt: string | null
  nico: string | null
}

interface ProveedorEnrichment {
  nombre: string | null
  rfc: string | null
}

/** Chunk an array into batches of `size` — PostgREST `.in()` clauses
 *  struggle past ~2000 values, so we paginate any bulk lookup. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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
  const activeSet = new Set(activeList)
  const hasActiveFilter = activeList.length > 0

  // --- Step 1: tráficos in window (pedimento-only filter) -------------
  // "Only Anexo 24" means only partidas that have a pedimento assigned
  // in the target window. This is the Formato 53 contract — no catalog
  // rows, only pedimento-bearing merchandise.
  let traficoQ = supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_pago, fecha_llegada, proveedores, regimen, pais_procedencia, aduana, tipo_cambio, peso_bruto, importe_total')
    .eq('company_id', companyId)
    .not('pedimento', 'is', null)
    .limit(5000)
  if (dateFrom) traficoQ = traficoQ.gte('fecha_pago', dateFrom)
  if (dateTo) traficoQ = traficoQ.lte('fecha_pago', dateTo)

  const traficoRes = await traficoQ
  if (traficoRes.error) {
    return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando tráficos: ${traficoRes.error.message}` } }
  }
  const traficos = ((traficoRes.data ?? []) as TraficoLite[]).filter((t) => !!t.trafico)
  const traficoIds = traficos.map((t) => t.trafico)
  const traficoMap = new Map<string, TraficoLite>()
  for (const t of traficos) traficoMap.set(t.trafico, t)

  // --- Step 2: facturas — enriched (numero, fecha, moneda, incoterm, cve_proveedor)
  const facturas: FacturaEnriched[] = []
  for (const batch of chunk(traficoIds, 1000)) {
    if (batch.length === 0) continue
    const res = await supabase
      .from('globalpc_facturas')
      .select('cve_trafico, folio, numero, fecha_facturacion, valor_comercial, moneda, incoterm, cve_proveedor')
      .eq('company_id', companyId)
      .in('cve_trafico', batch)
    if (res.error) {
      return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando facturas: ${res.error.message}` } }
    }
    for (const r of (res.data ?? []) as FacturaEnriched[]) facturas.push(r)
  }
  const folioToFactura = new Map<number, FacturaEnriched>()
  const folioToTrafico = new Map<number, string>()
  for (const f of facturas) {
    if (f.folio != null && f.cve_trafico) {
      folioToTrafico.set(f.folio, f.cve_trafico)
      folioToFactura.set(f.folio, f)
    }
  }
  const folios = Array.from(folioToTrafico.keys())

  // --- Step 3: partidas — enriched (marca, modelo, serie, item seq) ---
  const partidas: PartidaRaw[] = []
  for (const batch of chunk(folios, 1000)) {
    if (batch.length === 0) continue
    const res = await supabase
      .from('globalpc_partidas')
      .select('id, folio, cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen, marca, modelo, serie, numero_item')
      .eq('company_id', companyId)
      .in('folio', batch)
      .limit(DEFAULT_PARTIDAS_LIMIT)
    if (res.error) {
      return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando partidas: ${res.error.message}` } }
    }
    for (const r of (res.data ?? []) as PartidaRaw[]) partidas.push(r)
  }

  // --- Step 4: productos enrichment (descripcion, fraccion, umt, nico)
  const cvesNeeded = Array.from(new Set(partidas.map((p) => p.cve_producto).filter((x): x is string => !!x)))
  const productMap = new Map<string, ProductoEnrichment>()
  for (const batch of chunk(cvesNeeded, 1000)) {
    if (batch.length === 0) continue
    const res = await supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion, fraccion, umt, nico')
      .eq('company_id', companyId)
      .in('cve_producto', batch)
    if (res.error) {
      return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando productos: ${res.error.message}` } }
    }
    for (const p of (res.data ?? []) as Array<{ cve_producto: string | null; descripcion: string | null; fraccion: string | null; umt: string | null; nico: string | null }>) {
      if (p.cve_producto) productMap.set(p.cve_producto, { descripcion: p.descripcion, fraccion: p.fraccion, umt: p.umt, nico: p.nico })
    }
  }

  // --- Step 5: proveedores — resolve names + Tax ID/RFC ----------------
  const cveProveedoresNeeded = Array.from(new Set(facturas.map((f) => f.cve_proveedor).filter((x): x is string => !!x)))
  const proveedorMap = new Map<string, ProveedorEnrichment>()
  for (const batch of chunk(cveProveedoresNeeded, 1000)) {
    if (batch.length === 0) continue
    const res = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre, rfc')
      .eq('company_id', companyId)
      .in('cve_proveedor', batch)
    if (res.error) {
      return { ok: false, error: { status: 500, code: 'DATA_ERROR', message: `Error consultando proveedores: ${res.error.message}` } }
    }
    for (const p of (res.data ?? []) as Array<{ cve_proveedor: string | null; nombre: string | null; rfc: string | null }>) {
      if (p.cve_proveedor) proveedorMap.set(p.cve_proveedor, { nombre: p.nombre, rfc: p.rfc })
    }
  }

  // --- Assembly — 41-column Formato 53 shape --------------------------
  // Date helpers: Formato 53 renders dates DD/MM/YYYY. Pedimento numbers
  // render in SAT canonical form (`26 24 3596 6500441`).
  const fmtDate = (iso: string | null): string | null => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yy = d.getUTCFullYear()
    return `${dd}/${mm}/${yy}`
  }
  const yearOf = (iso: string | null): string | null => {
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear())
  }
  const splitPedimento = (ped: string | null): { clave: string | null; numero: string | null } => {
    if (!ped) return { clave: null, numero: null }
    // SAT pedimento is `DD AD PPPP SSSSSSS`. The "clave" is the 2-letter
    // pedimento-type code (A1, A3, IMD, ITE, etc.) which lives on the
    // trafico.regimen field for us. Return the full 15-digit number here.
    return { clave: null, numero: formatPedimento(ped) ?? ped }
  }

  const rows: Anexo24Row[] = []
  for (const p of partidas) {
    if (p.folio == null) continue
    const traficoId = folioToTrafico.get(p.folio)
    if (!traficoId) continue
    const t = traficoMap.get(traficoId)
    if (!t) continue
    // Active-parts filter — same slice as /anexo-24 page so on-screen
    // SKU count matches the export row count.
    if (hasActiveFilter && p.cve_producto && !activeSet.has(p.cve_producto)) continue

    const enr = p.cve_producto ? productMap.get(p.cve_producto) : undefined
    const factura = folioToFactura.get(p.folio)
    const proveedorRow = factura?.cve_proveedor ? proveedorMap.get(factura.cve_proveedor) : undefined

    const cantidad = typeof p.cantidad === 'number' ? p.cantidad : (p.cantidad != null ? Number(p.cantidad) : null)
    const precio = typeof p.precio_unitario === 'number' ? p.precio_unitario : (p.precio_unitario != null ? Number(p.precio_unitario) : null)
    const valorUsd = cantidad != null && precio != null && Number.isFinite(cantidad * precio)
      ? Math.round(cantidad * precio * 100) / 100
      : null
    const tc = t.tipo_cambio != null && Number.isFinite(Number(t.tipo_cambio)) ? Number(t.tipo_cambio) : null
    const valorComercial = valorUsd != null && tc != null ? Math.round(valorUsd * tc * 100) / 100 : null
    const tmec = isTmec(t.regimen)
    const pedimentoInfo = splitPedimento(t.pedimento)

    rows.push({
      annio_fecha_pago: yearOf(t.fecha_pago),
      aduana: t.aduana ?? null,
      clave_pedimento: t.regimen ?? null, // regimen = pedimento clave (A1/IMD/ITE/etc.)
      fecha_pago: fmtDate(t.fecha_pago),
      proveedor: resolveProveedorName(
        factura?.cve_proveedor ?? null,
        proveedorRow?.nombre ?? t.proveedores ?? null,
      ),
      tax_id: proveedorRow?.rfc ?? null,
      factura: factura?.numero ?? null,
      fecha_factura: fmtDate(factura?.fecha_facturacion ?? null),
      fraccion: enr?.fraccion ?? null,
      numero_parte: p.cve_producto ?? null,
      clave_insumo: p.cve_producto ?? null,
      origen: p.pais_origen ?? t.pais_procedencia ?? null,
      tratado: tmec ? 'SI' : 'No',
      cantidad_umc: cantidad,
      umc: enr?.umt ?? null,
      valor_aduana: valorComercial,
      valor_comercial: valorComercial,
      tigi: null,        // pedimento-XML only
      fp_igi: null,      // pedimento-XML only
      fp_iva: null,      // pedimento-XML only
      fp_ieps: null,     // pedimento-XML only
      tipo_cambio: tc,
      iva: null,         // requires valor_aduana + DTA + IGI — pedimento-XML only
      secuencia: typeof p.numero_item === 'number' ? p.numero_item : null,
      remesa: null,      // pedimento-XML only
      marca: p.marca ?? null,
      modelo: p.modelo ?? null,
      serie: p.serie ?? null,
      numero_pedimento: pedimentoInfo.numero,
      cantidad_umt: cantidad,  // same as UMC until pedimento-XML split lands
      unidad_umt: enr?.umt ?? null,
      valor_dolar: valorUsd,
      incoterm: factura?.incoterm ?? null,
      factor_conversion: 1,
      fecha_presentacion: fmtDate(t.fecha_llegada),
      consignatario: null,         // pedimento-XML only
      destinatario: null,          // pedimento-XML only
      vinculacion: null,           // pedimento-XML only
      metodo_valoracion: null,     // pedimento-XML only
      peso_bruto: p.peso ?? null,
      pais_origen: p.pais_origen ?? t.pais_procedencia ?? null,
      tmec,
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
