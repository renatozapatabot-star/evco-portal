import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveProveedorName } from '@/lib/proveedor-names'
import { formatFraccion } from '@/lib/format/fraccion'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Source-of-truth provenance for a catalog row.
 *  - 'anexo24_parts' = matched a current anexo24_parts row (SAT-filed truth).
 *  - 'globalpc_productos' = only in the GlobalPC sync mirror. */
export type SourceOfTruth = 'anexo24_parts' | 'globalpc_productos'

/** Drift classification per row, surfaced as audit chips in the UI. */
export type CatalogoDrift = 'none' | 'fraccion_mismatch' | 'description_mismatch' | 'only_in_globalpc'

export interface CatalogoRow {
  id: string
  cve_producto: string | null
  descripcion: string
  /** Canonical merchandise name — reflects anexo24_parts when available. */
  merchandise: string
  fraccion: string | null
  fraccion_source: string | null
  fraccion_classified_at: string | null
  cve_proveedor: string | null
  proveedor_nombre: string | null
  pais_origen: string | null
  veces_importado: number
  valor_ytd_usd: number | null
  ultimo_cve_trafico: string | null
  ultima_fecha_llegada: string | null
  /** Where this row's canonical name + fracción came from. */
  source_of_truth: SourceOfTruth
  /** Relationship between anexo24_parts + globalpc_productos for this cve. */
  drift: CatalogoDrift
}

interface RawProducto {
  id: string | number
  cve_producto: string | null
  descripcion: string | null
  fraccion: string | null
  fraccion_source: string | null
  fraccion_classified_at: string | null
  cve_proveedor: string | null
  pais_origen: string | null
}

interface RawProveedor {
  cve_proveedor: string | null
  nombre: string | null
}

interface RawPartida {
  cve_trafico: string | null
  descripcion: string | null
  valor_comercial: number | string | null
  fecha_llegada: string | null
}

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Canonical anexo24_parts overlay — maps cve_producto → Formato 53 truth. */
export interface Anexo24Overlay {
  merchandise: string
  fraccion: string | null
  umt: string | null
  pais_origen: string | null
}

/**
 * Merge a batch of raw productos with supplier-name map, partida aggregate,
 * and the Formato 53 overlay. Drift classification + source_of_truth
 * computed per row. Pure so tests can exercise it.
 */
export function mergeCatalogoRows(
  productos: RawProducto[],
  proveedorMap: Map<string, string>,
  partidaAgg: Map<string, { count: number; valor: number; lastTrafico: string | null; lastFecha: string | null }>,
  anexoOverlay: Map<string, Anexo24Overlay> = new Map(),
): CatalogoRow[] {
  return productos
    .filter((p) => (p.descripcion ?? '').trim().length > 0)
    .map((p) => {
      const descripcion = (p.descripcion ?? '').trim()
      const key = descripcion.toUpperCase()
      const agg = partidaAgg.get(key)
      const anexo = p.cve_producto ? anexoOverlay.get(p.cve_producto) : undefined

      // Prefer the anexo24 overlay values for canonical display.
      const merchandise = anexo?.merchandise ?? descripcion
      const fraccionCanonical = anexo?.fraccion ?? p.fraccion
      const paisCanonical = anexo?.pais_origen ?? p.pais_origen

      // Source of truth + drift classification.
      let sourceOfTruth: SourceOfTruth = 'globalpc_productos'
      let drift: CatalogoDrift = 'only_in_globalpc'
      if (anexo) {
        sourceOfTruth = 'anexo24_parts'
        drift = 'none'
        if (p.fraccion && anexo.fraccion && p.fraccion !== anexo.fraccion) drift = 'fraccion_mismatch'
        else if (descripcion && anexo.merchandise && descripcion !== anexo.merchandise) drift = 'description_mismatch'
      }

      return {
        id: String(p.id),
        cve_producto: p.cve_producto,
        descripcion,
        merchandise,
        fraccion: fraccionCanonical,
        fraccion_source: p.fraccion_source,
        fraccion_classified_at: p.fraccion_classified_at,
        cve_proveedor: p.cve_proveedor,
        // Never surface raw PRV_#### codes — resolver coalesces to display.
        proveedor_nombre: resolveProveedorName(
          p.cve_proveedor,
          p.cve_proveedor ? proveedorMap.get(p.cve_proveedor) : null,
        ),
        pais_origen: paisCanonical,
        veces_importado: agg?.count ?? 0,
        valor_ytd_usd: agg ? agg.valor : null,
        ultimo_cve_trafico: agg?.lastTrafico ?? null,
        ultima_fecha_llegada: agg?.lastFecha ?? null,
        source_of_truth: sourceOfTruth,
        drift,
      }
    })
}

export interface CatalogoFraccionGroup {
  fraccion: string
  primary_descripcion: string
  variant_count: number
  total_imports: number
  valor_ytd_usd: number | null
  supplier_names: string[]
  last_trafico: string | null
  last_fecha: string | null
  variants: CatalogoRow[]
}

export function groupCatalogoByFraccion(rows: CatalogoRow[]): CatalogoFraccionGroup[] {
  const byFrac = new Map<string, CatalogoRow[]>()
  for (const r of rows) {
    const frac = (r.fraccion ?? '').trim()
    if (!frac) continue
    if (!byFrac.has(frac)) byFrac.set(frac, [])
    byFrac.get(frac)!.push(r)
  }
  const groups: CatalogoFraccionGroup[] = []
  for (const [fraccion, variants] of byFrac) {
    const suppliers = new Set<string>()
    let totalImports = 0
    let totalValor = 0
    let hasValor = false
    let lastTrafico: string | null = null
    let lastFecha: string | null = null
    for (const v of variants) {
      if (v.proveedor_nombre) suppliers.add(v.proveedor_nombre)
      totalImports += v.veces_importado
      if (v.valor_ytd_usd != null) {
        totalValor += v.valor_ytd_usd
        hasValor = true
      }
      if (v.ultima_fecha_llegada && (!lastFecha || v.ultima_fecha_llegada > lastFecha)) {
        lastFecha = v.ultima_fecha_llegada
        lastTrafico = v.ultimo_cve_trafico
      }
    }
    const primary = [...variants].sort((a, b) => {
      if (b.veces_importado !== a.veces_importado) return b.veces_importado - a.veces_importado
      return b.descripcion.length - a.descripcion.length
    })[0]
    groups.push({
      fraccion,
      primary_descripcion: primary?.descripcion ?? variants[0]?.descripcion ?? '',
      variant_count: variants.length,
      total_imports: totalImports,
      valor_ytd_usd: hasValor ? totalValor : null,
      supplier_names: Array.from(suppliers).sort(),
      last_trafico: lastTrafico,
      last_fecha: lastFecha,
      variants,
    })
  }
  groups.sort((a, b) => {
    if (b.variant_count !== a.variant_count) return b.variant_count - a.variant_count
    return b.total_imports - a.total_imports
  })
  return groups
}

export interface CatalogoSummary {
  total_products: number
  classified_count: number
  unclassified_count: number
  fraccion_count: number
  consolidation_candidates: number
  dedup_pool: number
}

export function summarizeCatalogo(
  rows: CatalogoRow[],
  groups: CatalogoFraccionGroup[],
): CatalogoSummary {
  let classified = 0
  for (const r of rows) if (r.fraccion) classified += 1
  let candidates = 0
  let dedup = 0
  for (const g of groups) {
    if (g.variant_count >= 5) candidates += 1
    if (g.variant_count >= 2) dedup += g.variant_count - 1
  }
  return {
    total_products: rows.length,
    classified_count: classified,
    unclassified_count: rows.length - classified,
    fraccion_count: groups.length,
    consolidation_candidates: candidates,
    dedup_pool: dedup,
  }
}

export type CatalogoSort = 'alfabetico' | 'mas_usado' | 'mas_reciente' | 'valor_ytd'
export type CatalogoClassifiedFilter = 'all' | 'classified' | 'unclassified'
export type CatalogoSourceFilter = 'all' | 'anexo24' | 'only_globalpc' | 'drift'

export interface GetCatalogoOptions {
  q?: string
  limit?: number
  activeOnly?: boolean
  proveedor_id?: string
  fraccion_prefix?: string
  classified?: CatalogoClassifiedFilter
  source_filter?: CatalogoSourceFilter
  sort?: CatalogoSort
}

export async function getCatalogo(
  supabase: AnyClient,
  companyId: string,
  opts: GetCatalogoOptions = {},
): Promise<CatalogoRow[]> {
  if (!companyId) return []
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const q = (opts.q ?? '').trim()
  // activeOnly defaults to true — the catalog surface should match the
  // Anexo 24 surface's contract ("parts this client has actually
  // imported"). Internal tooling that explicitly wants the full mirror
  // can opt out with activeOnly: false.
  const activeOnly = opts.activeOnly ?? true

  let activeList: string[] = []
  if (activeOnly) {
    // Dynamic import to avoid a compile-time cycle between
    // lib/catalogo/products.ts and lib/anexo24/active-parts.ts (both
    // sit close enough in the module graph that static import
    // circled). Loaded once at first call, cached by the bundler.
    const { getActiveCveProductos, activeCvesArray } = await import('@/lib/anexo24/active-parts')
    const set = await getActiveCveProductos(supabase, companyId)
    activeList = activeCvesArray(set)
    if (activeList.length === 0) return []
  }

  // Deterministic ordering: primary key = classified-at desc (brings newly
  // classified parts to the top), secondary = cve_producto asc (tiebreaker
  // for batch-classified rows that share a timestamp). Without the
  // secondary, Supabase returns batch rows in insertion order, which
  // varies across requests and made Catálogo KPIs shift 487→500→475 on
  // consecutive refreshes (audit 2026-04-17).
  let productoQuery = supabase
    .from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion, fraccion_source, fraccion_classified_at, cve_proveedor, pais_origen')
    .eq('company_id', companyId)
    .order('fraccion_classified_at', { ascending: false, nullsFirst: false })
    .order('cve_producto', { ascending: true })
    .limit(limit)
  if (activeList.length > 0) productoQuery = productoQuery.in('cve_producto', activeList)

  if (q.length > 0) {
    const safe = q.replace(/[%_]/g, '')
    productoQuery = productoQuery.or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
  }

  // Server-side filters — prefix-match on fraccion, proveedor equality,
  // classified-or-not. Applied via PostgREST where possible.
  if (opts.proveedor_id && opts.proveedor_id.trim().length > 0) {
    productoQuery = productoQuery.eq('cve_proveedor', opts.proveedor_id.trim())
  }
  if (opts.fraccion_prefix && opts.fraccion_prefix.trim().length > 0) {
    const safe = opts.fraccion_prefix.trim().replace(/[%_]/g, '')
    productoQuery = productoQuery.ilike('fraccion', `${safe}%`)
  }
  if (opts.classified === 'classified') {
    productoQuery = productoQuery.not('fraccion', 'is', null)
  } else if (opts.classified === 'unclassified') {
    productoQuery = productoQuery.is('fraccion', null)
  }

  const { data: rawProductos } = await productoQuery
  const productos: RawProducto[] = (rawProductos ?? []) as RawProducto[]
  if (productos.length === 0) return []

  const proveedorIds = Array.from(new Set(
    productos.map((p) => p.cve_proveedor).filter((x): x is string => Boolean(x)),
  ))
  const descripciones = Array.from(new Set(
    productos.map((p) => (p.descripcion ?? '').trim().toUpperCase()).filter((x) => x.length > 0),
  ))

  const [proveedoresRes, partidasRes] = await Promise.all([
    proveedorIds.length > 0
      ? supabase
          .from('globalpc_proveedores')
          .select('cve_proveedor, nombre')
          .in('cve_proveedor', proveedorIds)
      : Promise.resolve({ data: [] as RawProveedor[] }),
    descripciones.length > 0
      ? supabase
          .from('globalpc_partidas')
          .select('cve_trafico, descripcion, valor_comercial, fecha_llegada')
          .eq('company_id', companyId)
          .in('descripcion', descripciones.slice(0, 200))
          .limit(5000)
      : Promise.resolve({ data: [] as RawPartida[] }),
  ])

  const proveedorMap = new Map<string, string>()
  for (const p of (proveedoresRes.data ?? []) as RawProveedor[]) {
    if (p.cve_proveedor && p.nombre) proveedorMap.set(p.cve_proveedor, p.nombre)
  }

  const partidaAgg = new Map<string, { count: number; valor: number; lastTrafico: string | null; lastFecha: string | null }>()
  for (const row of (partidasRes.data ?? []) as RawPartida[]) {
    const desc = (row.descripcion ?? '').trim().toUpperCase()
    if (!desc) continue
    const prev = partidaAgg.get(desc) ?? { count: 0, valor: 0, lastTrafico: null, lastFecha: null }
    prev.count += 1
    prev.valor += toNumber(row.valor_comercial)
    if (row.fecha_llegada && (!prev.lastFecha || row.fecha_llegada > prev.lastFecha)) {
      prev.lastFecha = row.fecha_llegada
      prev.lastTrafico = row.cve_trafico
    }
    partidaAgg.set(desc, prev)
  }

  // Formato 53 overlay — when USE_ANEXO24_CANONICAL=true, fetch the
  // current anexo24_partidas rows for the resolved cve_productos and
  // surface them as the source of truth + drift classification. Each
  // part's snapshot comes from its most-recent partida (by fecha_pago).
  const anexoOverlay = new Map<string, Anexo24Overlay>()
  const canonicalEnabled = (process.env.USE_ANEXO24_CANONICAL ?? '').toLowerCase() === 'true'
  if (canonicalEnabled) {
    const cves = productos.map((p) => p.cve_producto).filter((x): x is string => !!x)
    for (let i = 0; i < cves.length; i += 1000) {
      const batch = cves.slice(i, i + 1000)
      const { data } = await supabase
        .from('anexo24_partidas')
        .select('numero_parte, descripcion, fraccion, um_comercial, pais_origen, fecha_pago')
        .eq('company_id', companyId)
        .in('numero_parte', batch)
        .limit(10000)
      // Group by numero_parte → most-recent by fecha_pago (DD/MM/YYYY).
      const latest = new Map<string, { desc: string | null; frac: string | null; umc: string | null; pais: string | null; ts: number }>()
      for (const r of (data ?? []) as Array<{ numero_parte: string | null; descripcion: string | null; fraccion: string | null; um_comercial: string | null; pais_origen: string | null; fecha_pago: string | null }>) {
        if (!r.numero_parte) continue
        const m = r.fecha_pago ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.fecha_pago.trim()) : null
        const ts = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`).getTime() : 0
        const prev = latest.get(r.numero_parte)
        if (!prev || ts > prev.ts) {
          latest.set(r.numero_parte, { desc: r.descripcion, frac: r.fraccion, umc: r.um_comercial, pais: r.pais_origen, ts })
        }
      }
      for (const [cve, l] of latest) {
        // Unpack packed fracciones (39012001 → 3901.20.01) so drift
        // comparison matches by canonical dotted form, not by
        // raw-vs-packed.
        anexoOverlay.set(cve, {
          merchandise: l.desc ?? cve,
          fraccion: l.frac ? (formatFraccion(l.frac) ?? l.frac) : null,
          umt: l.umc,
          pais_origen: l.pais,
        })
      }
    }
  }

  let merged = mergeCatalogoRows(productos, proveedorMap, partidaAgg, anexoOverlay)

  // Source-of-truth filter at the row level (post-merge, so the drift
  // classification is already populated).
  if (opts.source_filter === 'anexo24') {
    merged = merged.filter((r) => r.source_of_truth === 'anexo24_parts')
  } else if (opts.source_filter === 'only_globalpc') {
    merged = merged.filter((r) => r.drift === 'only_in_globalpc')
  } else if (opts.source_filter === 'drift') {
    merged = merged.filter((r) => r.drift === 'fraccion_mismatch' || r.drift === 'description_mismatch')
  }

  // Sort (JS, post-merge) — Postgres sort already primed the slice by
  // classified-at-desc + cve_producto-asc. This re-sorts the final set.
  const sort = opts.sort ?? 'mas_reciente'
  switch (sort) {
    case 'alfabetico':
      merged.sort((a, b) => a.merchandise.localeCompare(b.merchandise, 'es', { sensitivity: 'base' }))
      break
    case 'mas_usado':
      merged.sort((a, b) => (b.veces_importado ?? 0) - (a.veces_importado ?? 0))
      break
    case 'valor_ytd':
      merged.sort((a, b) => (Number(b.valor_ytd_usd) || 0) - (Number(a.valor_ytd_usd) || 0))
      break
    case 'mas_reciente':
    default:
      merged.sort((a, b) => (b.fraccion_classified_at ?? '').localeCompare(a.fraccion_classified_at ?? ''))
  }

  return merged
}
