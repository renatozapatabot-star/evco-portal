/**
 * Partidas → Traficos linkage helper.
 *
 * Why this module exists:
 *   `globalpc_partidas` does NOT have a direct `cve_trafico` column
 *   (schema-drift finding from M11). Three code paths in the repo
 *   — /api/catalogo/partes/[cveProducto], lib/catalogo/products.ts,
 *   lib/intelligence/crossing-insights.ts — all reached for that
 *   phantom column and silently 400'd in production, masked by
 *   soft-query wrappers.
 *
 *   The REAL linkage is a 2-hop join via `globalpc_facturas`:
 *
 *     globalpc_partidas.folio
 *       → globalpc_facturas.folio  (pivot — facturas is the document)
 *       → globalpc_facturas.cve_trafico
 *       → traficos.trafico         (the ref string, e.g. "9254-Y1302")
 *
 *   facturas carries everything the phantom-column code was trying to
 *   get (cve_trafico, fecha_facturacion as proxy for llegada,
 *   valor_comercial for line-item totals).
 *
 * Design:
 *   This module exposes ONE function — `resolvePartidaLinks` — that
 *   takes a batch of partidas and returns a map from partida identity
 *   to the joined trafico. All three call-sites use this helper, so
 *   the next schema-drift discovery hits one place not three.
 *
 * Tenant safety:
 *   Every query in this module filters by `company_id` (defense in
 *   depth beyond RLS). A caller passing a wrong companyId gets an
 *   empty map — never cross-tenant data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Input shape — the minimum a partida provides about itself. */
export interface PartidaLike {
  folio: number | null
  cve_cliente?: string | null
  cve_proveedor?: string | null
  cve_producto?: string | null
  numero_item?: number | null
  cantidad?: number | null
  precio_unitario?: number | null
  created_at?: string | null
}

/** Output shape — the trafico-level enrichment a partida gets. */
export interface PartidaTraficoLink {
  /** traficos.trafico (the ref string like "9254-Y1302"). */
  cve_trafico: string | null
  /** SAT pedimento number (kept as-is from traficos; format via formatPedimento). */
  pedimento: string | null
  /** When the trailer actually crossed. Null until filed. */
  fecha_cruce: string | null
  /** When the merchandise arrived at the warehouse. */
  fecha_llegada: string | null
  /** 0 verde · 1 amarillo · 2 rojo · null unknown. */
  semaforo: number | null
  /** Facturas.fecha_facturacion — the invoice date. */
  fecha_facturacion: string | null
  /** Facturas.valor_comercial — line-item-rolled-up USD. */
  valor_comercial: number | null
}

export interface ResolvedLinks {
  /** Map: partidas.folio → joined trafico info. Missing folios = no match. */
  byFolio: Map<number, PartidaTraficoLink>
  /** Every distinct cve_trafico surfaced by the join. Useful for
   * downstream aggregations (e.g. crossings summary). */
  distinctCveTraficos: string[]
}

/**
 * Given a batch of partidas (with their folios), join to facturas +
 * traficos and return the enrichment map.
 *
 * Two queries — one for facturas, one for traficos. Joined in JS so
 * we can chunk the .in() clauses without blowing PostgREST limits.
 *
 * @param supabase — service-role client (route handlers only; this
 *   bypasses RLS and trusts companyId as the filter)
 * @param companyId — tenant scope (filtered on BOTH facturas + traficos)
 * @param partidas — the rows being enriched
 */
export async function resolvePartidaLinks(
  supabase: SupabaseClient,
  companyId: string,
  partidas: PartidaLike[],
): Promise<ResolvedLinks> {
  const empty: ResolvedLinks = { byFolio: new Map(), distinctCveTraficos: [] }
  if (!companyId || partidas.length === 0) return empty

  // ── 1. Distinct folios ────────────────────────────────────────
  const folios = Array.from(
    new Set(
      partidas
        .map((p) => p.folio)
        .filter((f): f is number => typeof f === 'number'),
    ),
  )
  if (folios.length === 0) return empty

  // ── 2. Fetch facturas for those folios ─────────────────────────
  // Facturas carries: folio (pivot), cve_trafico (→ traficos), and the
  // fecha_facturacion + valor_comercial enrichment fields that the
  // phantom-column code was trying to read off partidas.
  const facturasByFolio = new Map<
    number,
    { cve_trafico: string | null; fecha_facturacion: string | null; valor_comercial: number | null }
  >()
  for (let i = 0; i < folios.length; i += 500) {
    const batch = folios.slice(i, i + 500)
    const { data } = await supabase
      .from('globalpc_facturas')
      .select('folio, cve_trafico, fecha_facturacion, valor_comercial')
      .eq('company_id', companyId)
      .in('folio', batch)
    for (const f of (data ?? []) as Array<{
      folio: number | null
      cve_trafico: string | null
      fecha_facturacion: string | null
      valor_comercial: number | null
    }>) {
      if (f.folio == null) continue
      // A folio can have multiple facturas (partial invoices). Take the
      // first cve_trafico — they all point to the same trafico. The
      // valor_comercial we surface is per-factura (caller aggregates
      // if they need a totals view).
      if (!facturasByFolio.has(f.folio)) {
        facturasByFolio.set(f.folio, {
          cve_trafico: f.cve_trafico,
          fecha_facturacion: f.fecha_facturacion,
          valor_comercial: f.valor_comercial,
        })
      }
    }
  }

  // ── 3. Fetch traficos for the distinct cve_traficos from step 2 ─
  const distinctCveTraficos = Array.from(
    new Set(
      Array.from(facturasByFolio.values())
        .map((f) => f.cve_trafico)
        .filter((t): t is string => typeof t === 'string' && t.length > 0),
    ),
  )
  const traficoByRef = new Map<
    string,
    { pedimento: string | null; fecha_cruce: string | null; fecha_llegada: string | null; semaforo: number | null }
  >()
  for (let i = 0; i < distinctCveTraficos.length; i += 500) {
    const batch = distinctCveTraficos.slice(i, i + 500)
    const { data } = await supabase
      .from('traficos')
      .select('trafico, pedimento, fecha_cruce, fecha_llegada, semaforo')
      .eq('company_id', companyId)
      .in('trafico', batch)
    for (const t of (data ?? []) as Array<{
      trafico: string | null
      pedimento: string | null
      fecha_cruce: string | null
      fecha_llegada: string | null
      semaforo: number | null
    }>) {
      if (!t.trafico) continue
      traficoByRef.set(t.trafico, {
        pedimento: t.pedimento,
        fecha_cruce: t.fecha_cruce,
        fecha_llegada: t.fecha_llegada,
        semaforo:
          t.semaforo === 0 || t.semaforo === 1 || t.semaforo === 2
            ? t.semaforo
            : null,
      })
    }
  }

  // ── 4. Build the final byFolio map — 2-hop join in JS ──────────
  const byFolio = new Map<number, PartidaTraficoLink>()
  for (const [folio, factura] of facturasByFolio) {
    const trafico = factura.cve_trafico
      ? traficoByRef.get(factura.cve_trafico)
      : null
    byFolio.set(folio, {
      cve_trafico: factura.cve_trafico,
      pedimento: trafico?.pedimento ?? null,
      fecha_cruce: trafico?.fecha_cruce ?? null,
      fecha_llegada: trafico?.fecha_llegada ?? null,
      semaforo: trafico?.semaforo ?? null,
      fecha_facturacion: factura.fecha_facturacion,
      valor_comercial: factura.valor_comercial,
    })
  }

  return { byFolio, distinctCveTraficos }
}

/**
 * Convenience: enrich a single partida with its trafico link, returning
 * a safely-typed merged object. Handy when a call site has exactly one
 * partida and doesn't want to manage the map lookup.
 */
export function applyPartidaLink<T extends PartidaLike>(
  partida: T,
  links: ResolvedLinks,
): T & { link: PartidaTraficoLink | null } {
  const link =
    partida.folio != null ? (links.byFolio.get(partida.folio) ?? null) : null
  return { ...partida, link }
}
