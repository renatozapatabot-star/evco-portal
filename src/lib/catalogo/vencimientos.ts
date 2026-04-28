/**
 * Catálogo vencimientos — regulatory permit expiry reader.
 *
 * Pulls products whose NOM / SEDUE / SEMARNAT dates fall within the
 * 90-day window (past or future) and assigns each a severity bucket.
 *
 * Severity rules:
 *   · red     — expired OR expires in ≤30 days
 *   · amber   — 31–60 days
 *   · plum    — 61–90 days (watch list)
 *
 * Types use ISO date strings; downstream UI formats in America/Chicago.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * M16 phantom-column note: the NOM / SEDUE / SEMARNAT permit columns
 * (nom_numero, nom_expiry, sedue_permit, sedue_expiry, semarnat_cert,
 * semarnat_expiry) were designed but never migrated onto
 * globalpc_productos. Until that schema work lands, getVencimientos()
 * returns an empty array instead of 400-ing against PostgREST.
 *
 * When the permit schema ships:
 *   1. Add the 6 columns to globalpc_productos (or a side table).
 *   2. Re-enable the commented-out query block below.
 *   3. Remove the `return []` short-circuit.
 *   4. Update the phantom ratchet to expect the lower count.
 */
export type PermitKind = 'nom' | 'sedue' | 'semarnat'
export type ExpirySeverity = 'red' | 'amber' | 'plum'

export interface VencimientoRow {
  producto_id: string
  company_id: string | null
  cve_producto: string | null
  descripcion: string | null
  fraccion: string | null
  permit_kind: PermitKind
  permit_value: string
  expiry_date: string
  days_until: number
  severity: ExpirySeverity
}

const PERMIT_COLUMNS: Record<PermitKind, { value: string; expiry: string }> = {
  nom: { value: 'nom_numero', expiry: 'nom_expiry' },
  sedue: { value: 'sedue_permit', expiry: 'sedue_expiry' },
  semarnat: { value: 'semarnat_cert', expiry: 'semarnat_expiry' },
}

function daysBetween(todayIso: string, expiryIso: string): number {
  const ms = new Date(expiryIso).getTime() - new Date(todayIso).getTime()
  return Math.floor(ms / 86_400_000)
}

function severityFor(daysUntil: number): ExpirySeverity {
  if (daysUntil <= 30) return 'red'
  if (daysUntil <= 60) return 'amber'
  return 'plum'
}

// ProductoRow interface removed post-M16 stub; see unblock recipe above.
// When the permit schema ships, reintroduce it with the 6 permit columns.

export async function getVencimientos(
  supabase: AnyClient,
  opts: { companyId?: string | null; isInternal: boolean; horizonDays?: number } = { isInternal: false },
): Promise<VencimientoRow[]> {
  // Short-circuit: the 6 permit columns don't exist on globalpc_productos
  // yet (M16 phantom-column note above). Return empty until the schema
  // migration ships. Keeping the function signature stable so callers
  // don't need to branch.
  void supabase
  void opts
  void PERMIT_COLUMNS
  void severityFor
  void daysBetween
  return []

}

export function groupBySeverity(rows: VencimientoRow[]): Record<ExpirySeverity, VencimientoRow[]> {
  const groups: Record<ExpirySeverity, VencimientoRow[]> = { red: [], amber: [], plum: [] }
  for (const r of rows) groups[r.severity].push(r)
  return groups
}
