import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Active-parts filter — "only show SKUs this client has actually imported."
 *
 * The problem: globalpc_productos is the full part master mirror, and a
 * single company (EVCO) has ~148K rows even though only ~693 of them
 * have been imported in the last 24 months. A catalog with 148K rows
 * is noise, not a catalog. Renato's direction (2026-04-19):
 *   "Filter those out. [EVCO] only wants parts that pertain to them —
 *   not every part Milacron ever sold to anybody."
 *
 * The filter: the set of cve_productos that appear in THIS COMPANY's
 * globalpc_partidas. A part that EVCO never imported shouldn't show up
 * on EVCO's Anexo 24, catalog, or search — even if globalpc_productos
 * still carries a stale row with company_id='evco' from a historical
 * sync pass. Partidas is the ground truth for "has this client actually
 * imported this thing?"
 *
 * Session-scoped: this is ONE extra round trip (cap 50K partidas,
 * filtered by company_id, SELECT DISTINCT cve_producto), and both the
 * snapshot + by-fraccion flows call it in parallel with their existing
 * productos fetch. The cost is ~30ms for EVCO-scale tenants.
 *
 * Fresh-tenant edge case: if a client has zero partidas (brand new,
 * pre-first-shipment), this returns an empty set. Callers detect that
 * and render the appropriate calm empty state instead of a hidden-
 * everything page.
 */

export interface ActiveCveSet {
  /** Set of cve_productos this company has at least one partida for. */
  cves: Set<string>
  /** Total partidas rows scanned (for diagnostics — not displayed). */
  partidaCount: number
}

export async function getActiveCveProductos(
  supabase: AnyClient,
  companyId: string,
): Promise<ActiveCveSet> {
  if (!companyId) return { cves: new Set<string>(), partidaCount: 0 }

  // Partidas carry the truth. A fresh tenant with zero partidas returns
  // an empty set — callers treat that as "show calm empty state".
  // Cap at 50K rows — EVCO has ~290K partidas ever, most clients
  // substantially less. 50K is more than enough to cover any active-
  // usage window. If a tenant exceeds that we'll ratchet up, but 50K
  // gives us multi-year coverage for all current clients.
  const { data } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto')
    .eq('company_id', companyId)
    .not('cve_producto', 'is', null)
    .limit(50_000)

  const cves = new Set<string>()
  for (const row of (data ?? [])) {
    const cve = (row as { cve_producto: string | null }).cve_producto
    if (cve) cves.add(cve)
  }
  return { cves, partidaCount: (data ?? []).length }
}

/**
 * Convenience: return the set as a deduplicated array suitable for
 * Supabase `.in('cve_producto', [...])` filters. Sorted alphabetically
 * so the query plan is deterministic.
 */
export function activeCvesArray(set: ActiveCveSet): string[] {
  return Array.from(set.cves).sort()
}
