// Anexo 24 · single-source query helper (2026-04-28).
//
// One join helper, one row shape, one tenant gate. The screen at
// `/anexo-24`, the PDF + XLSX exports at `/api/reports/anexo-24/generate`,
// and the CSV at `/api/anexo-24/csv` all call this — that's how the
// 13-column GlobalPC-parity contract stays consistent across surfaces
// instead of three separate joins drifting apart again.
//
// Tenant isolation: `eq('company_id', companyId)` on every step. Active-
// parts filter applied by default so on-screen partidas count matches
// the export row count. Truncation is surfaced (`truncated: true`)
// rather than silently capped — Anexo 24 is a regulatory artifact, a
// partial export is worse than a refused one.

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatPedimento } from '@/lib/format/pedimento'
import { formatFraccion } from '@/lib/format/fraccion'
import { resolveProveedorName } from '@/lib/proveedor-names'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'
import { isTmecRegimen } from '@/lib/anexo24/columns'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Anexo24Row {
  consecutivo: number
  pedimento: string | null
  fecha: string | null         // raw ISO; formatters render DD/MM/YYYY at the boundary
  embarque: string             // `<clave_cliente>-<trafico>` to match GlobalPC display
  fraccion: string | null      // dotted form `XXXX.XX.XX`
  descripcion: string | null
  cantidad: number | null
  umc: string | null
  valor_usd: number | null     // computed cantidad × precio_unitario
  proveedor: string
  pais: string | null
  regimen: string | null
  tmec: boolean
}

export interface Anexo24FetchInput {
  supabase: AnyClient
  companyId: string
  dateFrom: string             // ISO `YYYY-MM-DD`
  dateTo: string               // ISO `YYYY-MM-DD`
  /** When true (default), restrict to parts this client has actually
   *  imported (set returned by `getActiveCveProductos`). Set to false
   *  for legacy callers that need the full mirror slice. */
  applyActiveFilter?: boolean
}

export interface Anexo24FetchResult {
  rows: Anexo24Row[]
  truncated: boolean           // any of the per-step caps was hit
  partidaCount: number         // post-filter; same as rows.length
}

const TRAFICO_CAP = 50_000
const PARTIDA_CAP = 100_000
const BATCH_SIZE = 1000

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface TraficoLite {
  trafico: string
  pedimento: string | null
  fecha_pago: string | null
  regimen: string | null
  aduana: string | null
  pais_procedencia: string | null
  proveedores: string | null
}

interface FacturaLite {
  folio: number | null
  cve_trafico: string | null
  numero: string | null
  cve_proveedor: string | null
}

interface PartidaLite {
  id: number
  folio: number | null
  cve_producto: string | null
  cantidad: number | null
  precio_unitario: number | null
  pais_origen: string | null
  numero_item: number | null
}

interface ProductoLite {
  cve_producto: string | null
  descripcion: string | null
  fraccion: string | null
  umt: string | null
}

/**
 * Compose the 13-column Anexo 24 row set for one tenant + date window.
 * The five-step join (`traficos → globalpc_facturas → globalpc_partidas
 * → globalpc_productos → globalpc_proveedores`) mirrors the legacy
 * Formato 53 generator — same data, fewer columns, one place to fix.
 */
export async function fetchAnexo24Rows(
  input: Anexo24FetchInput,
): Promise<Anexo24FetchResult> {
  const { supabase, companyId, dateFrom, dateTo } = input
  const applyActiveFilter = input.applyActiveFilter !== false

  if (!companyId) {
    return { rows: [], truncated: false, partidaCount: 0 }
  }

  // Look up clave_cliente once — used to build "Embarque" as
  // `<clave>-<trafico>` (matches the GlobalPC export display).
  const { data: companyRow } = await supabase
    .from('companies')
    .select('clave_cliente')
    .eq('company_id', companyId)
    .maybeSingle()
  const clave = (companyRow as { clave_cliente: string | null } | null)?.clave_cliente ?? null

  // --- Step 1 · traficos in window ---------------------------------
  const traficoRes = await supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_pago, regimen, aduana, pais_procedencia, proveedores')
    .eq('company_id', companyId)
    .gte('fecha_pago', dateFrom)
    .lte('fecha_pago', dateTo)
    .not('fecha_pago', 'is', null)
    .not('pedimento', 'is', null)
    .order('fecha_pago', { ascending: true })
    .limit(TRAFICO_CAP)

  const traficos = ((traficoRes.data ?? []) as TraficoLite[]).filter((t) => !!t.trafico)
  let truncated = traficos.length >= TRAFICO_CAP

  if (traficos.length === 0) {
    return { rows: [], truncated, partidaCount: 0 }
  }
  const traficoMap = new Map<string, TraficoLite>()
  for (const t of traficos) traficoMap.set(t.trafico, t)
  const traficoIds = Array.from(traficoMap.keys())

  // --- Step 2 · facturas (numero + cve_proveedor) ------------------
  const facturas: FacturaLite[] = []
  for (const batch of chunk(traficoIds, BATCH_SIZE)) {
    const res = await supabase
      .from('globalpc_facturas')
      .select('folio, cve_trafico, numero, cve_proveedor')
      .eq('company_id', companyId)
      .in('cve_trafico', batch)
    for (const f of ((res.data ?? []) as FacturaLite[])) facturas.push(f)
  }
  const folioToFactura = new Map<number, FacturaLite>()
  for (const f of facturas) {
    if (f.folio != null) folioToFactura.set(f.folio, f)
  }
  const folios = Array.from(folioToFactura.keys())
  if (folios.length === 0) {
    return { rows: [], truncated, partidaCount: 0 }
  }

  // --- Step 3 · partidas -------------------------------------------
  const partidas: PartidaLite[] = []
  for (const batch of chunk(folios, BATCH_SIZE)) {
    if (partidas.length >= PARTIDA_CAP) {
      truncated = true
      break
    }
    const remaining = PARTIDA_CAP - partidas.length
    const res = await supabase
      .from('globalpc_partidas')
      .select('id, folio, cve_producto, cantidad, precio_unitario, pais_origen, numero_item')
      .eq('company_id', companyId)
      .in('folio', batch)
      .limit(remaining)
    for (const p of ((res.data ?? []) as PartidaLite[])) partidas.push(p)
  }
  if (partidas.length >= PARTIDA_CAP) truncated = true
  if (partidas.length === 0) {
    return { rows: [], truncated, partidaCount: 0 }
  }

  // Active-parts filter — same slice the catalog surfaces use so a
  // client only sees parts they've actually imported.
  let activeSet: Set<string> | null = null
  if (applyActiveFilter) {
    const active = await getActiveCveProductos(supabase, companyId)
    if (active.cves.size > 0) activeSet = active.cves
  }

  // --- Step 4 · productos (descripción / fracción / UMC) -----------
  const cvesNeeded = new Set<string>()
  for (const p of partidas) {
    if (p.cve_producto) cvesNeeded.add(p.cve_producto)
  }
  const productMap = new Map<string, ProductoLite>()
  for (const batch of chunk(Array.from(cvesNeeded), BATCH_SIZE)) {
    const res = await supabase
      .from('globalpc_productos')
      .select('cve_producto, descripcion, fraccion, umt')
      .eq('company_id', companyId)
      .in('cve_producto', batch)
    for (const r of ((res.data ?? []) as ProductoLite[])) {
      // Dedupe — `globalpc_productos` carries duplicates when the same
      // SKU re-syncs under multiple clave variants. Keep the first
      // non-null descripcion; first non-null umt wins per field.
      const existing = productMap.get(r.cve_producto ?? '')
      if (!existing) {
        productMap.set(r.cve_producto ?? '', r)
      } else {
        if (!existing.descripcion && r.descripcion) existing.descripcion = r.descripcion
        if (!existing.fraccion && r.fraccion) existing.fraccion = r.fraccion
        if (!existing.umt && r.umt) existing.umt = r.umt
      }
    }
  }

  // --- Step 5 · proveedores (resolve names) ------------------------
  const cveProveedores = new Set<string>()
  for (const f of facturas) {
    if (f.cve_proveedor) cveProveedores.add(f.cve_proveedor)
  }
  const proveedorNameByCve = new Map<string, string | null>()
  for (const batch of chunk(Array.from(cveProveedores), BATCH_SIZE)) {
    const res = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', companyId)
      .in('cve_proveedor', batch)
    for (const r of ((res.data ?? []) as Array<{ cve_proveedor: string | null; nombre: string | null }>)) {
      if (r.cve_proveedor) proveedorNameByCve.set(r.cve_proveedor, r.nombre ?? null)
    }
  }

  // --- Assembly · 13-column rows ------------------------------------
  const rows: Anexo24Row[] = []
  let consecutivo = 0

  // Sort partidas by trafico-fecha then by id so consecutivo numbers
  // flow chronologically — matches the GlobalPC reference Excel.
  partidas.sort((a, b) => {
    const fa = folioToFactura.get(a.folio ?? -1)?.cve_trafico ?? ''
    const fb = folioToFactura.get(b.folio ?? -1)?.cve_trafico ?? ''
    const ta = traficoMap.get(fa)?.fecha_pago ?? ''
    const tb = traficoMap.get(fb)?.fecha_pago ?? ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return (a.id ?? 0) - (b.id ?? 0)
  })

  for (const p of partidas) {
    if (p.folio == null) continue
    const factura = folioToFactura.get(p.folio)
    if (!factura?.cve_trafico) continue
    const trafico = traficoMap.get(factura.cve_trafico)
    if (!trafico) continue

    if (activeSet && p.cve_producto && !activeSet.has(p.cve_producto)) continue

    const enr = p.cve_producto ? productMap.get(p.cve_producto) : undefined
    const cantidad = typeof p.cantidad === 'number' ? p.cantidad : (p.cantidad != null ? Number(p.cantidad) : null)
    const precio = typeof p.precio_unitario === 'number' ? p.precio_unitario : (p.precio_unitario != null ? Number(p.precio_unitario) : null)
    const valorUsd = cantidad != null && precio != null && Number.isFinite(cantidad * precio)
      ? Math.round(cantidad * precio * 100) / 100
      : null

    const proveedorNombre = factura.cve_proveedor
      ? proveedorNameByCve.get(factura.cve_proveedor) ?? null
      : null
    const proveedorFallback = trafico.proveedores ?? null
    const proveedor = resolveProveedorName(
      factura.cve_proveedor,
      proveedorNombre ?? proveedorFallback,
    )

    consecutivo += 1
    rows.push({
      consecutivo,
      pedimento: trafico.pedimento ? formatPedimento(trafico.pedimento) ?? trafico.pedimento : null,
      fecha: trafico.fecha_pago,
      embarque: clave ? `${clave}-${trafico.trafico}` : trafico.trafico,
      fraccion: enr?.fraccion ? formatFraccion(enr.fraccion) ?? enr.fraccion : null,
      descripcion: enr?.descripcion ?? null,
      cantidad,
      umc: enr?.umt ?? null,
      valor_usd: valorUsd,
      proveedor,
      pais: p.pais_origen ?? trafico.pais_procedencia ?? null,
      regimen: trafico.regimen ?? null,
      tmec: isTmecRegimen(trafico.regimen),
    })
  }

  return { rows, truncated, partidaCount: rows.length }
}
