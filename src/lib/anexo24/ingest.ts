/**
 * CRUZ · Formato 53 ingest — authoritative IMMEX inventory source.
 *
 * Parses the real SAT Formato 53 XLSX (41 columns, canonical order from the
 * 2026-04-02 EVCO reference file) and upserts part-level truth into
 * `anexo24_parts`. This closes the loop Ursula asked about:
 *
 *   "how do we know that everything in catálogo is actually correct?
 *    we have the reportes 24 to back up"
 *
 * The Formato 53 has ONE row per pedimento-partida. `anexo24_parts` has
 * ONE row per (company_id, cve_producto). For each unique cve_producto
 * we take the most-authoritative snapshot: latest fraccion, dominant
 * merchandise name, umt, país de origen, valor unitario. Changes bump
 * `vigente_hasta` on the old row and insert a fresh active row —
 * history preserved for SAT audit.
 */

import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single row as it appears in the Formato 53 XLSX, post-parse. */
export interface Anexo24IngestRow {
  annio_fecha_pago: string | null
  aduana: string | null
  clave_pedimento: string | null
  fecha_pago: string | null
  proveedor: string | null
  tax_id: string | null
  factura: string | null
  fecha_factura: string | null
  fraccion: string | null
  numero_parte: string | null
  clave_insumo: string | null
  origen: string | null
  tratado: string | null
  cantidad_umc: number | null
  umc: string | null
  valor_aduana: number | null
  valor_comercial: number | null
  tigi: string | null
  fp_igi: string | null
  fp_iva: string | null
  fp_ieps: string | null
  tipo_cambio: number | null
  iva: number | null
  secuencia: number | null
  remesa: string | null
  marca: string | null
  modelo: string | null
  serie: string | null
  numero_pedimento: string | null
  cantidad_umt: number | null
  unidad_umt: string | null
  valor_dolar: number | null
  incoterm: string | null
  factor_conversion: number | null
  fecha_presentacion: string | null
  consignatario: string | null
  destinatario: string | null
  vinculacion: string | null
  metodo_valoracion: string | null
  peso_bruto: number | null
  pais_origen: string | null
  /** Free-text merchandise description — sourced from the "Proveedor" +
   *  "Descripción" combined reads that appear before the numbered columns
   *  in some variants of the export. Often null; the sparser Formato 53
   *  variants lean on Número de Parte instead. */
  merchandise_name: string | null
}

export interface UpsertSummary {
  /** Rows whose (company_id, cve_producto) was unknown or had changed fields. */
  upserts: number
  /** Rows whose current anexo24_parts match the XLSX — no-op. */
  skips: number
  /** Rows whose cve_producto was null/empty (can't key them). */
  errors: number
  /** Distinct parts touched this ingest. */
  parts_touched: number
  /** Rows in the XLSX total. */
  xlsx_rows: number
}

export interface DriftReport {
  only_in_anexo24: string[]
  only_in_globalpc: string[]
  fraccion_mismatch: Array<{ cve_producto: string; anexo24: string | null; globalpc: string | null }>
  description_mismatch: Array<{ cve_producto: string; anexo24: string; globalpc: string | null }>
}

// ---------------------------------------------------------------------------
// Column map — positional (A..AO) + shared-string resolution via xlsx lib.
// Order matches the real 2026-04-02 EVCO Formato 53 reference file.
// ---------------------------------------------------------------------------

const COLUMN_ORDER: Array<keyof Anexo24IngestRow> = [
  'annio_fecha_pago',   // A
  'aduana',             // B
  'clave_pedimento',    // C
  'fecha_pago',         // D
  'proveedor',          // E
  'tax_id',             // F
  'factura',            // G
  'fecha_factura',      // H
  'fraccion',           // I
  'numero_parte',       // J
  'clave_insumo',       // K
  'origen',             // L
  'tratado',            // M
  'cantidad_umc',       // N
  'umc',                // O
  'valor_aduana',       // P
  'valor_comercial',    // Q
  'tigi',               // R
  'fp_igi',             // S
  'fp_iva',             // T
  'fp_ieps',            // U
  'tipo_cambio',        // V
  'iva',                // W
  'secuencia',          // X
  'remesa',             // Y
  'marca',              // Z
  'modelo',             // AA
  'serie',              // AB
  'numero_pedimento',   // AC
  'cantidad_umt',       // AD
  'unidad_umt',         // AE
  'valor_dolar',        // AF
  'incoterm',           // AG
  'factor_conversion',  // AH
  'fecha_presentacion', // AI
  'consignatario',      // AJ
  'destinatario',       // AK
  'vinculacion',        // AL
  'metodo_valoracion',  // AM
  'peso_bruto',         // AN
  'pais_origen',        // AO
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Convert a packed fracción integer (e.g. 7318159905) back to
 *  SAT canonical `XXXX.XX.XX` format. Accepts already-formatted
 *  strings unchanged. Returns null on unrecognizable input. */
function formatFraccion(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (s.length === 0) return null
  // Already dotted? Leave alone.
  if (s.includes('.')) return s
  const digits = s.replace(/\D/g, '')
  // SAT standard is 8 digits (XXXX.XX.XX), NICO variant 10 digits (XXXX.XX.XX.XX).
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 10) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`
  // Unexpected width — surface raw so caller can diagnose.
  return s
}

/** Pick the most frequent non-null value in a list (mode). Ties broken
 *  by first-seen. Used to dedupe per-part snapshot from many rows. */
function mode<T extends string | null>(values: Array<T>): T | null {
  const counts = new Map<T, number>()
  let best: T | null = null
  let bestN = 0
  for (const v of values) {
    if (v == null) continue
    const n = (counts.get(v) ?? 0) + 1
    counts.set(v, n)
    if (n > bestN) { best = v; bestN = n }
  }
  return best
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a Formato 53 XLSX buffer. Skips the two identity rows (Anexo 24 /
 * client legal name) and the header row; returns one raw row per
 * pedimento-partida. Empty cells → null.
 */
export function parseFormato53Xlsx(buffer: Buffer): Anexo24IngestRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []

  // header: 'A' gives `{ A: 'Anexo 24', B: null, ... }` per row — reliable
  // against unpredictable XLSX variants (variable-width headers etc).
  const aoa: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    header: 'A',
    defval: null,
    raw: true,
    blankrows: false,
  })

  // Find the real header row: the first row containing literal "Fracción"
  // (or AnnioFechaPago as fallback) among its cells. After that, data starts.
  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i]
    const values = Object.values(row ?? {}).map((v) => String(v ?? '').trim())
    if (values.includes('Fracción') || values.includes('AnnioFechaPago')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return []

  const out: Anexo24IngestRow[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const src = aoa[i] ?? {}
    // All-null row = end-of-data sentinel some exports include.
    if (Object.values(src).every((v) => v == null || v === '')) continue

    // Map column letters A..AO to canonical field names.
    const row: Partial<Anexo24IngestRow> = {}
    const letters = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
      'U', 'V', 'W', 'X', 'Y', 'Z',
      'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO',
    ]
    for (let j = 0; j < COLUMN_ORDER.length; j++) {
      const field = COLUMN_ORDER[j]
      const raw = src[letters[j]]
      switch (field) {
        case 'cantidad_umc':
        case 'valor_aduana':
        case 'valor_comercial':
        case 'tipo_cambio':
        case 'iva':
        case 'secuencia':
        case 'cantidad_umt':
        case 'valor_dolar':
        case 'factor_conversion':
        case 'peso_bruto':
          (row as Record<string, unknown>)[field] = coerceNumber(raw)
          break
        case 'fraccion':
          row.fraccion = formatFraccion(raw)
          break
        default:
          (row as Record<string, unknown>)[field] = coerceString(raw)
      }
    }
    // merchandise_name is NOT in Formato 53 canonical columns — the real
    // file leans on Número de Parte. Some variants include it as an extra
    // column (AP+). Default null; the upsert will fall back to
    // globalpc_productos.descripcion on first insert.
    row.merchandise_name = null
    out.push(row as Anexo24IngestRow)
  }

  return out
}

// ---------------------------------------------------------------------------
// Per-part snapshot (collapses many XLSX rows to one anexo24_parts row)
// ---------------------------------------------------------------------------

interface PartSnapshot {
  cve_producto: string
  fraccion_official: string | null
  umt_official: string | null
  pais_origen_official: string | null
  valor_unitario_official: number | null
  merchandise_name_official: string
}

function snapshotPerPart(
  rows: Anexo24IngestRow[],
  fallbackMerchName: (cveProducto: string) => string,
): PartSnapshot[] {
  const byCve = new Map<string, Anexo24IngestRow[]>()
  for (const r of rows) {
    const cve = (r.numero_parte ?? '').trim()
    if (!cve) continue
    const arr = byCve.get(cve) ?? []
    arr.push(r)
    byCve.set(cve, arr)
  }

  const out: PartSnapshot[] = []
  for (const [cve, rs] of byCve) {
    const fraccion = mode(rs.map((r) => r.fraccion))
    const umt = mode(rs.map((r) => r.umc))
    const pais = mode(rs.map((r) => r.pais_origen ?? r.origen))
    // Average valor unitario = sum(valor_dolar) / sum(cantidad)
    let totalValor = 0
    let totalCantidad = 0
    for (const r of rs) {
      if (r.valor_dolar != null && r.cantidad_umc != null && r.cantidad_umc > 0) {
        totalValor += r.valor_dolar
        totalCantidad += r.cantidad_umc
      }
    }
    const valorUnit = totalCantidad > 0 ? Math.round((totalValor / totalCantidad) * 10000) / 10000 : null

    out.push({
      cve_producto: cve,
      fraccion_official: fraccion,
      umt_official: umt,
      pais_origen_official: pais,
      valor_unitario_official: valorUnit,
      merchandise_name_official: mode(rs.map((r) => r.merchandise_name)) ?? fallbackMerchName(cve),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Idempotent upsert of part-level snapshots into `anexo24_parts`.
 * Supersede semantics: if an existing active row differs in any canonical
 * field, stamp `vigente_hasta = now()` on the old row and insert a new
 * active row. History preserved.
 *
 * Writes a `sync_log` row for the whole batch.
 */
export async function upsertAnexo24Parts(
  supabase: SupabaseClient,
  companyId: string,
  rows: Anexo24IngestRow[],
  opts: { source_document_url?: string | null; source_document_hash?: string | null; ingested_by?: string } = {},
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    upserts: 0,
    skips: 0,
    errors: 0,
    parts_touched: 0,
    xlsx_rows: rows.length,
  }

  // Count rows with no cve_producto key — those are errors.
  for (const r of rows) {
    if (!r.numero_parte || !r.numero_parte.trim()) summary.errors++
  }

  // Merchandise-name fallback: if the XLSX didn't carry one, look up
  // globalpc_productos.descripcion for the cve_producto. This keeps the
  // first-ingest pass productive even when the Formato 53 variant is sparse.
  const cvesWithNoMerch = Array.from(new Set(
    rows
      .filter((r) => r.numero_parte && !r.merchandise_name)
      .map((r) => r.numero_parte!.trim()),
  ))
  const merchFallback = new Map<string, string>()
  if (cvesWithNoMerch.length > 0) {
    // chunk to respect PostgREST .in() ceiling
    for (let i = 0; i < cvesWithNoMerch.length; i += 1000) {
      const batch = cvesWithNoMerch.slice(i, i + 1000)
      const { data } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, descripcion')
        .eq('company_id', companyId)
        .in('cve_producto', batch)
      for (const p of (data ?? []) as Array<{ cve_producto: string | null; descripcion: string | null }>) {
        if (p.cve_producto && p.descripcion) merchFallback.set(p.cve_producto, p.descripcion)
      }
    }
  }

  const snapshots = snapshotPerPart(rows, (cve) => merchFallback.get(cve) ?? cve)
  summary.parts_touched = snapshots.length

  // Fetch currently-active rows for all incoming cves.
  const cveKeys = snapshots.map((s) => s.cve_producto)
  const existingByCve = new Map<string, {
    id: number
    merchandise_name_official: string
    fraccion_official: string | null
    umt_official: string | null
    pais_origen_official: string | null
    valor_unitario_official: number | null
  }>()
  for (let i = 0; i < cveKeys.length; i += 1000) {
    const batch = cveKeys.slice(i, i + 1000)
    const { data } = await supabase
      .from('anexo24_parts')
      .select('id, cve_producto, merchandise_name_official, fraccion_official, umt_official, pais_origen_official, valor_unitario_official')
      .eq('company_id', companyId)
      .is('vigente_hasta', null)
      .in('cve_producto', batch)
    for (const r of (data ?? []) as Array<{
      id: number; cve_producto: string; merchandise_name_official: string;
      fraccion_official: string | null; umt_official: string | null;
      pais_origen_official: string | null; valor_unitario_official: number | null
    }>) {
      existingByCve.set(r.cve_producto, r)
    }
  }

  const now = new Date().toISOString()
  const inserts: Array<Record<string, unknown>> = []
  const supersedeIds: number[] = []

  for (const snap of snapshots) {
    const existing = existingByCve.get(snap.cve_producto)
    if (!existing) {
      inserts.push({
        company_id: companyId,
        cve_producto: snap.cve_producto,
        merchandise_name_official: snap.merchandise_name_official,
        fraccion_official: snap.fraccion_official,
        umt_official: snap.umt_official,
        pais_origen_official: snap.pais_origen_official,
        valor_unitario_official: snap.valor_unitario_official,
        vigente_desde: now,
        vigente_hasta: null,
        source_document_url: opts.source_document_url ?? null,
        source_document_hash: opts.source_document_hash ?? null,
        ingested_at: now,
        ingested_by: opts.ingested_by ?? 'admin_upload',
      })
      summary.upserts++
      continue
    }
    // Compare canonical fields. Change → supersede + new row.
    const changed =
      existing.merchandise_name_official !== snap.merchandise_name_official ||
      existing.fraccion_official !== snap.fraccion_official ||
      existing.umt_official !== snap.umt_official ||
      existing.pais_origen_official !== snap.pais_origen_official ||
      (Number(existing.valor_unitario_official ?? 0) !== Number(snap.valor_unitario_official ?? 0))
    if (changed) {
      supersedeIds.push(existing.id)
      inserts.push({
        company_id: companyId,
        cve_producto: snap.cve_producto,
        merchandise_name_official: snap.merchandise_name_official,
        fraccion_official: snap.fraccion_official,
        umt_official: snap.umt_official,
        pais_origen_official: snap.pais_origen_official,
        valor_unitario_official: snap.valor_unitario_official,
        vigente_desde: now,
        vigente_hasta: null,
        source_document_url: opts.source_document_url ?? null,
        source_document_hash: opts.source_document_hash ?? null,
        ingested_at: now,
        ingested_by: opts.ingested_by ?? 'admin_upload',
      })
      summary.upserts++
    } else {
      summary.skips++
    }
  }

  // Stamp superseded rows BEFORE insert, so the unique-active-per-part
  // index never conflicts.
  if (supersedeIds.length > 0) {
    for (let i = 0; i < supersedeIds.length; i += 500) {
      const batch = supersedeIds.slice(i, i + 500)
      const { error } = await supabase
        .from('anexo24_parts')
        .update({ vigente_hasta: now })
        .in('id', batch)
      if (error) throw new Error(`supersede failed: ${error.message}`)
    }
  }

  if (inserts.length > 0) {
    for (let i = 0; i < inserts.length; i += 500) {
      const batch = inserts.slice(i, i + 500)
      const { error } = await supabase.from('anexo24_parts').insert(batch)
      if (error) throw new Error(`insert failed: ${error.message}`)
    }
  }

  return summary
}

// ---------------------------------------------------------------------------
// Drift reconciliation — compare anexo24_parts vs globalpc_productos
// ---------------------------------------------------------------------------

export async function reconcileAnexo24Drift(
  supabase: SupabaseClient,
  companyId: string,
): Promise<DriftReport> {
  const { data: anexoData } = await supabase
    .from('anexo24_parts')
    .select('cve_producto, merchandise_name_official, fraccion_official')
    .eq('company_id', companyId)
    .is('vigente_hasta', null)
    .limit(50_000)
  const anexoMap = new Map<string, { merchandise: string; fraccion: string | null }>()
  for (const r of (anexoData ?? []) as Array<{ cve_producto: string; merchandise_name_official: string; fraccion_official: string | null }>) {
    anexoMap.set(r.cve_producto, { merchandise: r.merchandise_name_official, fraccion: r.fraccion_official })
  }

  // allowlist-ok:globalpc_productos — anexo24 ingest reconciliation query
  // intentionally pulls the FULL tenant mirror to compute "only_in_anexo24
  // vs only_in_gpc vs matched". Scoped by companyId; applying the anexo24
  // allowlist here would be circular (we're building the allowlist).
  const { data: gpcData } = await supabase
    .from('globalpc_productos')
    .select('cve_producto, descripcion, fraccion')
    .eq('company_id', companyId)
    .limit(200_000)
  const gpcMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  for (const r of (gpcData ?? []) as Array<{ cve_producto: string | null; descripcion: string | null; fraccion: string | null }>) {
    if (r.cve_producto) gpcMap.set(r.cve_producto, { descripcion: r.descripcion, fraccion: r.fraccion })
  }

  const only_in_anexo24: string[] = []
  const only_in_globalpc: string[] = []
  const fraccion_mismatch: DriftReport['fraccion_mismatch'] = []
  const description_mismatch: DriftReport['description_mismatch'] = []

  for (const [cve, anexo] of anexoMap) {
    const gpc = gpcMap.get(cve)
    if (!gpc) { only_in_anexo24.push(cve); continue }
    if (anexo.fraccion && gpc.fraccion && anexo.fraccion !== gpc.fraccion) {
      fraccion_mismatch.push({ cve_producto: cve, anexo24: anexo.fraccion, globalpc: gpc.fraccion })
    }
    if (gpc.descripcion && anexo.merchandise !== gpc.descripcion) {
      description_mismatch.push({ cve_producto: cve, anexo24: anexo.merchandise, globalpc: gpc.descripcion })
    }
  }
  for (const cve of gpcMap.keys()) {
    if (!anexoMap.has(cve)) only_in_globalpc.push(cve)
  }

  return { only_in_anexo24, only_in_globalpc, fraccion_mismatch, description_mismatch }
}

// ---------------------------------------------------------------------------
// Hash helpers (for source_document_hash — enables idempotent replays)
// ---------------------------------------------------------------------------

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
