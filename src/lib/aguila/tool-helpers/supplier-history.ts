/**
 * search_supplier_history — given a supplier search term (name fragment,
 * alias, or RFC), return the supplier's historical shipment footprint for
 * THIS tenant: last N crossings, verde% (semáforo=0 share), top bridge,
 * risk band.
 *
 * Tenant isolation:
 *   - companyId scope enforced on both globalpc_proveedores AND traficos.
 *   - `proveedores` on traficos is a CSV-ish string blob — we match via
 *     ILIKE rather than a strict equality.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SupplierHistoryMatch {
  cve_proveedor: string | null
  nombre: string | null
  alias: string | null
  id_fiscal: string | null
  pais: string | null
}

export interface SupplierHistoryResult {
  search_term: string
  matches: SupplierHistoryMatch[]
  crossings_analyzed: number
  verde_pct: number | null
  top_aduana: string | null
  risk_band_es: 'baja' | 'media' | 'alta' | 'sin_datos'
  last_crossing_es: { trafico: string; fecha_cruce: string } | null
  rationale_es: string
}

export interface SupplierHistoryResponse {
  success: boolean
  data: SupplierHistoryResult | null
  error: string | null
}

function riskBandFromVerdePct(pct: number | null): 'baja' | 'media' | 'alta' | 'sin_datos' {
  if (pct === null) return 'sin_datos'
  if (pct >= 90) return 'baja'
  if (pct >= 75) return 'media'
  return 'alta'
}

function sanitizeTerm(raw: string): string {
  return raw.replace(/[,%()]/g, '').trim()
}

export async function searchSupplierHistory(
  supabase: SupabaseClient,
  companyId: string,
  input: { searchTerm: string; windowDays?: number },
): Promise<SupplierHistoryResponse> {
  const term = sanitizeTerm(input.searchTerm ?? '')
  if (!companyId) return { success: false, data: null, error: 'invalid_companyId' }
  if (!term) return { success: false, data: null, error: 'invalid_searchTerm' }

  const windowDays = Math.min(Math.max(input.windowDays ?? 365, 30), 1095)
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString()

  const orFilter = [
    `nombre.ilike.%${term}%`,
    `alias.ilike.%${term}%`,
    `id_fiscal.ilike.%${term}%`,
    `cve_proveedor.ilike.%${term}%`,
  ].join(',')

  const { data: provRows, error: provErr } = await supabase
    .from('globalpc_proveedores')
    .select('cve_proveedor, nombre, alias, id_fiscal, pais')
    .eq('company_id', companyId)
    .or(orFilter)
    .limit(10)

  if (provErr) return { success: false, data: null, error: `proveedores:${provErr.message}` }

  const matches: SupplierHistoryMatch[] = ((provRows ?? []) as Array<{
    cve_proveedor: string | null
    nombre: string | null
    alias: string | null
    id_fiscal: string | null
    pais: string | null
  }>).map(r => ({
    cve_proveedor: r.cve_proveedor,
    nombre: r.nombre,
    alias: r.alias,
    id_fiscal: r.id_fiscal,
    pais: r.pais,
  }))

  const { data: trafRows, error: trafErr } = await supabase
    .from('traficos')
    .select('trafico, aduana, semaforo, fecha_cruce, proveedores')
    .eq('company_id', companyId)
    .ilike('proveedores', `%${term}%`)
    .gte('fecha_llegada', since)
    .order('fecha_cruce', { ascending: false, nullsFirst: false })
    .limit(500)

  if (trafErr) return { success: false, data: null, error: `traficos:${trafErr.message}` }

  const rows = (trafRows ?? []) as Array<{
    trafico: string | null
    aduana: string | null
    semaforo: number | null
    fecha_cruce: string | null
    proveedores: string | null
  }>
  const crossed = rows.filter(r => r.fecha_cruce)
  const verdeCount = crossed.filter(r => r.semaforo === 0).length
  const verdePct = crossed.length > 0 ? Math.round((verdeCount / crossed.length) * 1000) / 10 : null

  const aduanaCounts = new Map<string, number>()
  for (const r of crossed) {
    if (!r.aduana) continue
    aduanaCounts.set(r.aduana, (aduanaCounts.get(r.aduana) ?? 0) + 1)
  }
  const topAduana = Array.from(aduanaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const lastCrossedRow = crossed[0]
  const lastCrossing = lastCrossedRow?.trafico && lastCrossedRow.fecha_cruce
    ? { trafico: lastCrossedRow.trafico, fecha_cruce: lastCrossedRow.fecha_cruce }
    : null

  const riskBand = riskBandFromVerdePct(verdePct)
  const rationale =
    crossed.length === 0
      ? `Sin cruces en la ventana de ${windowDays} días para "${term}" — banda de riesgo sin datos.`
      : `${crossed.length} cruces analizados · ${verdePct}% verde · banda ${riskBand}.`

  return {
    success: true,
    data: {
      search_term: term,
      matches,
      crossings_analyzed: crossed.length,
      verde_pct: verdePct,
      top_aduana: topAduana,
      risk_band_es: riskBand,
      last_crossing_es: lastCrossing,
      rationale_es: rationale,
    },
    error: null,
  }
}
