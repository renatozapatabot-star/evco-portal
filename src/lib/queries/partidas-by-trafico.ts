/**
 * Given a trafico id (ref string like "9254-X3435"), return its partidas
 * with enrichment from globalpc_productos (fraccion + descripcion + umt).
 *
 * Why this module exists:
 *   `globalpc_partidas` does NOT have cve_trafico, fraccion,
 *   fraccion_arancelaria, descripcion, umc, or valor_comercial columns.
 *   All of those are phantoms. The real canonical path is a 3-hop join:
 *
 *     traficos.trafico (the ref string)
 *       → globalpc_facturas.cve_trafico → globalpc_facturas.folio
 *       → globalpc_partidas.folio → globalpc_partidas.cve_producto
 *       → globalpc_productos.fraccion + .descripcion + .umt
 *
 *   Each partida's valor_comercial is derived per-partida as
 *   `cantidad × precio_unitario` (the factura-level valor_comercial is a
 *   different, folio-level number).
 *
 * Design:
 *   Complements `src/lib/queries/partidas-trafico-link.ts` (which goes
 *   the OTHER direction: partida → trafico). This one goes
 *   trafico → partidas. Both are the canonical join sites for this repo.
 *
 * Tenant safety:
 *   Every sub-query filters by `company_id` (defense-in-depth beyond RLS).
 *   A caller passing a wrong companyId gets an empty array — never
 *   cross-tenant data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PartidaWithEnrichment {
  /** partida row id */
  id: number | null
  /** factura folio this partida belongs to */
  folio: number | null
  /** SKU code (joinable to productos.cve_producto) */
  cve_producto: string | null
  /** client code (part of the productos join key) */
  cve_cliente: string | null
  /** partida's own supplier code */
  cve_proveedor: string | null
  /** line quantity */
  cantidad: number | null
  /** unit price (derived valor = cantidad * precio_unitario) */
  precio_unitario: number | null
  /** line weight */
  peso: number | null
  /** origin country */
  pais_origen: string | null
  /** line index within the invoice */
  numero_item: number | null
  /** sync timestamp (useful as fecha_llegada proxy when trafico lacks it) */
  created_at: string | null

  // Enrichment from productos (null if no matching product row).
  /** canonical descripcion from productos */
  descripcion: string | null
  /** SAT fracción (dotted or bare — use formatFraccion() to render) */
  fraccion: string | null
  /** alias of fraccion for back-compat with code that asked for `fraccion_arancelaria` */
  fraccion_arancelaria: string | null
  /** unit of measure (productos.umt) */
  umt: string | null

  // Computed values.
  /** per-partida total = cantidad * precio_unitario (never null — 0 when either input is null) */
  valor_comercial: number
}

export interface ResolveOptions {
  /** Max partidas to return. Default 2000, max 5000. */
  limit?: number
}

/**
 * Given a trafico id, return all its partidas with productos + factura
 * enrichment. Tenant-scoped by companyId.
 */
export async function partidasByTrafico(
  supabase: SupabaseClient,
  companyId: string,
  traficoId: string,
  opts: ResolveOptions = {},
): Promise<PartidaWithEnrichment[]> {
  if (!companyId || !traficoId) return []
  const limit = Math.min(Math.max(opts.limit ?? 2000, 1), 5000)

  // Hop 1: trafico → folios
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('cve_trafico', traficoId)
    .eq('company_id', companyId)
  const folios = (facturas ?? [])
    .map((f: { folio: number | null }) => f.folio)
    .filter((x): x is number => x != null)
  if (folios.length === 0) return []

  // Hop 2: folios → partidas (real columns only)
  type PartidaRaw = {
    id: number | null
    folio: number | null
    cve_producto: string | null
    cve_cliente: string | null
    cve_proveedor: string | null
    cantidad: number | null
    precio_unitario: number | null
    peso: number | null
    pais_origen: string | null
    numero_item: number | null
    created_at: string | null
  }
  const { data: partidaRaw } = await supabase
    .from('globalpc_partidas')
    .select('id, folio, cve_producto, cve_cliente, cve_proveedor, cantidad, precio_unitario, peso, pais_origen, numero_item, created_at')
    .in('folio', folios)
    .eq('company_id', companyId)
    .limit(limit)
  const partidas = (partidaRaw ?? []) as PartidaRaw[]
  if (partidas.length === 0) return []

  // Hop 3: partidas.cve_producto → productos enrichment
  const cves = Array.from(
    new Set(partidas.map((p) => p.cve_producto).filter((c): c is string => !!c)),
  )
  const productMap = new Map<
    string,
    { descripcion: string | null; fraccion: string | null; umt: string | null }
  >()
  if (cves.length > 0) {
    // Chunk to avoid PostgREST URL-too-long on very wide invoices.
    for (let i = 0; i < cves.length; i += 500) {
      const slice = cves.slice(i, i + 500)
      const { data: prods } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, cve_cliente, descripcion, fraccion, umt')
        .in('cve_producto', slice)
        .eq('company_id', companyId)
      for (const p of (prods ?? []) as Array<{
        cve_producto: string | null
        cve_cliente: string | null
        descripcion: string | null
        fraccion: string | null
        umt: string | null
      }>) {
        productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, {
          descripcion: p.descripcion,
          fraccion: p.fraccion,
          umt: p.umt,
        })
      }
    }
  }

  return partidas.map((p) => {
    const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
    const cantidad = Number(p.cantidad) || 0
    const precio = Number(p.precio_unitario) || 0
    return {
      id: p.id,
      folio: p.folio,
      cve_producto: p.cve_producto,
      cve_cliente: p.cve_cliente,
      cve_proveedor: p.cve_proveedor,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
      peso: p.peso,
      pais_origen: p.pais_origen,
      numero_item: p.numero_item,
      created_at: p.created_at,
      descripcion: enr?.descripcion ?? null,
      fraccion: enr?.fraccion ?? null,
      fraccion_arancelaria: enr?.fraccion ?? null,
      umt: enr?.umt ?? null,
      valor_comercial: cantidad * precio,
    }
  })
}
