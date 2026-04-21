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

interface ProductoRow {
  id: string | number
  company_id: string | null
  cve_producto: string | null
  descripcion: string | null
  fraccion: string | null
  nom_numero: string | null
  nom_expiry: string | null
  sedue_permit: string | null
  sedue_expiry: string | null
  semarnat_cert: string | null
  semarnat_expiry: string | null
}

export async function getVencimientos(
  supabase: AnyClient,
  opts: { companyId?: string | null; isInternal: boolean; horizonDays?: number } = { isInternal: false },
): Promise<VencimientoRow[]> {
  const horizon = opts.horizonDays ?? 90
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const horizonIso = new Date(today.getTime() + horizon * 86_400_000).toISOString().slice(0, 10)

  let query = supabase
    .from('globalpc_productos')
    .select(
      'id, company_id, cve_producto, descripcion, fraccion, nom_numero, nom_expiry, sedue_permit, sedue_expiry, semarnat_cert, semarnat_expiry',
    )
    .or(
      `nom_expiry.lte.${horizonIso},sedue_expiry.lte.${horizonIso},semarnat_expiry.lte.${horizonIso}`,
    )
    .limit(500)

  if (!opts.isInternal && opts.companyId) {
    query = query.eq('company_id', opts.companyId)
  } else if (opts.companyId) {
    query = query.eq('company_id', opts.companyId)
  }

  const { data, error } = await query
  if (error || !data) return []

  const rows: VencimientoRow[] = []
  for (const raw of data as ProductoRow[]) {
    for (const kind of Object.keys(PERMIT_COLUMNS) as PermitKind[]) {
      const cols = PERMIT_COLUMNS[kind]
      const expiry = (raw as unknown as Record<string, string | null>)[cols.expiry]
      const value = (raw as unknown as Record<string, string | null>)[cols.value]
      if (!expiry || !value) continue
      if (expiry > horizonIso) continue
      const days = daysBetween(todayIso, expiry)
      rows.push({
        producto_id: String(raw.id),
        company_id: raw.company_id,
        cve_producto: raw.cve_producto,
        descripcion: raw.descripcion,
        fraccion: raw.fraccion,
        permit_kind: kind,
        permit_value: value,
        expiry_date: expiry,
        days_until: days,
        severity: severityFor(days),
      })
    }
  }

  rows.sort((a, b) => a.days_until - b.days_until)
  return rows
}

export function groupBySeverity(rows: VencimientoRow[]): Record<ExpirySeverity, VencimientoRow[]> {
  const groups: Record<ExpirySeverity, VencimientoRow[]> = { red: [], amber: [], plum: [] }
  for (const r of rows) groups[r.severity].push(r)
  return groups
}
