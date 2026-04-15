import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface CatalogoRow {
  id: string
  cve_producto: string | null
  descripcion: string
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

/**
 * Merge a batch of raw productos with a supplier-name map and a per-descripcion
 * aggregate (last-trafico + YTD totals). Exported pure so tests can exercise it.
 */
export function mergeCatalogoRows(
  productos: RawProducto[],
  proveedorMap: Map<string, string>,
  partidaAgg: Map<string, { count: number; valor: number; lastTrafico: string | null; lastFecha: string | null }>,
): CatalogoRow[] {
  return productos
    .filter((p) => (p.descripcion ?? '').trim().length > 0)
    .map((p) => {
      const descripcion = (p.descripcion ?? '').trim()
      const key = descripcion.toUpperCase()
      const agg = partidaAgg.get(key)
      return {
        id: String(p.id),
        cve_producto: p.cve_producto,
        descripcion,
        fraccion: p.fraccion,
        fraccion_source: p.fraccion_source,
        fraccion_classified_at: p.fraccion_classified_at,
        cve_proveedor: p.cve_proveedor,
        proveedor_nombre: p.cve_proveedor ? proveedorMap.get(p.cve_proveedor) ?? null : null,
        pais_origen: p.pais_origen,
        veces_importado: agg?.count ?? 0,
        valor_ytd_usd: agg ? agg.valor : null,
        ultimo_cve_trafico: agg?.lastTrafico ?? null,
        ultima_fecha_llegada: agg?.lastFecha ?? null,
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

export async function getCatalogo(
  supabase: AnyClient,
  companyId: string,
  opts: { q?: string; limit?: number } = {},
): Promise<CatalogoRow[]> {
  if (!companyId) return []
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const q = (opts.q ?? '').trim()

  let productoQuery = supabase
    .from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion, fraccion_source, fraccion_classified_at, cve_proveedor, pais_origen')
    .eq('company_id', companyId)
    .order('fraccion_classified_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (q.length > 0) {
    const safe = q.replace(/[%_]/g, '')
    productoQuery = productoQuery.or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
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

  return mergeCatalogoRows(productos, proveedorMap, partidaAgg)
}
