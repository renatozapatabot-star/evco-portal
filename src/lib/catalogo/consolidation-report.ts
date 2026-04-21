import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export interface ConsolidationClientRow {
  company_id: string
  company_name: string
  company_clave: string | null
  total_products: number
  classified_count: number
  unclassified_count: number
  fraccion_count: number
  consolidation_candidates: number
  dedup_pool: number
}

interface RawProducto {
  company_id: string | null
  descripcion: string | null
  fraccion: string | null
}

interface RawCompany {
  id: string
  name: string | null
  clave_cliente: string | null
}

/**
 * Admin/broker-only pre-audit heat map. Aggregates globalpc_productos
 * across every tenant and returns per-client consolidation stats:
 * how many variants could fold into fewer fracciones.
 *
 * Sorted by dedup_pool desc so the worst offenders surface first —
 * that's the queue for the consolidation work.
 */
export async function getConsolidationReport(
  supabase: AnyClient,
): Promise<ConsolidationClientRow[]> {
  const [productosRes, companiesRes] = await Promise.all([
    supabase
      .from('globalpc_productos')
      .select('company_id, descripcion, fraccion')
      .limit(50000),
    supabase
      .from('companies')
      .select('id, name, clave_cliente')
      .limit(500),
  ])

  const companies = new Map<string, RawCompany>()
  for (const c of (companiesRes.data ?? []) as RawCompany[]) {
    if (c.id) companies.set(c.id, c)
  }

  // Build per-company fracción counts.
  const perCompany = new Map<
    string,
    { total: number; classified: number; fracciones: Map<string, number> }
  >()
  for (const p of (productosRes.data ?? []) as RawProducto[]) {
    const cid = p.company_id
    if (!cid) continue
    const desc = (p.descripcion ?? '').trim()
    if (!desc) continue
    const frac = (p.fraccion ?? '').trim()
    const entry = perCompany.get(cid) ?? { total: 0, classified: 0, fracciones: new Map<string, number>() }
    entry.total += 1
    if (frac) {
      entry.classified += 1
      entry.fracciones.set(frac, (entry.fracciones.get(frac) ?? 0) + 1)
    }
    perCompany.set(cid, entry)
  }

  const rows: ConsolidationClientRow[] = []
  for (const [cid, agg] of perCompany) {
    const company = companies.get(cid)
    let candidates = 0
    let dedup = 0
    for (const [, count] of agg.fracciones) {
      if (count >= 5) candidates += 1
      if (count >= 2) dedup += count - 1
    }
    rows.push({
      company_id: cid,
      company_name: company?.name ?? cid,
      company_clave: company?.clave_cliente ?? null,
      total_products: agg.total,
      classified_count: agg.classified,
      unclassified_count: agg.total - agg.classified,
      fraccion_count: agg.fracciones.size,
      consolidation_candidates: candidates,
      dedup_pool: dedup,
    })
  }

  rows.sort((a, b) => {
    if (b.dedup_pool !== a.dedup_pool) return b.dedup_pool - a.dedup_pool
    return b.total_products - a.total_products
  })
  return rows
}
