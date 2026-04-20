/**
 * Prospect data aggregator.
 *
 * Single source of truth for the /prospect/[token] cockpit. Takes an RFC,
 * aggregates everything we know about that importer from aduanet_facturas
 * (public Aduana 240 customs records), and shapes it into the contract the
 * cockpit renders. Honest by design: returns only what's verifiable, never
 * synthesizes missing data.
 *
 * Why aduanet_facturas (not trade_prospects):
 *   trade_prospects is a derived/aggregated table populated by
 *   scripts/prospect-intelligence.js. It may or may not exist in a given
 *   environment. aduanet_facturas is the authoritative source — every
 *   prospect_intelligence run reads from it. This lib reads it directly so
 *   the cockpit works whether or not the intelligence cron has run.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProspectFactura {
  pedimento: string | null
  fecha_pago: string | null
  valor_usd: number | null
  proveedor: string | null
  patente: string | null
  cve_documento: string | null
  num_factura: string | null
  incoterm: string | null
}

export interface ProspectSupplier {
  name: string
  shipments: number
  total_usd: number
  last_seen: string | null
}

export interface ProspectMonthlyBucket {
  month: string // YYYY-MM
  pedimentos: number
  valor_usd: number
}

export interface ProspectCompetitor {
  patente: string
  shipments: number
  share_pct: number // 0–100
}

export interface ProspectData {
  rfc: string
  razon_social: string | null
  total_pedimentos: number
  total_valor_usd: number
  avg_valor_per_pedimento: number
  first_seen: string | null
  last_seen: string | null
  active_window_days: number | null
  /** Distinct months with at least one shipment in window. */
  months_active: number
  /** Avg days between consecutive pedimentos. */
  avg_days_between: number | null
  top_suppliers: ProspectSupplier[]
  monthly: ProspectMonthlyBucket[]
  competitors: ProspectCompetitor[]
  /** Most-used patente (could be us or a competitor). */
  primary_patente: string | null
  primary_patente_is_us: boolean
  /** Pedimentos processed by Patente 3596 (us). */
  pedimentos_with_us: number
  recent_facturas: ProspectFactura[]
  /** When the snapshot was generated. */
  generated_at: string
  /** True when the underlying source has zero rows for this RFC. */
  empty: boolean
}

const PATENTE_3596 = '3596'

export interface ProspectIdentity {
  rfc: string
  razon_social: string | null
}

/**
 * Resolve the most likely razon social for an RFC. Picks the most common
 * name across aduanet_facturas (legal entities sometimes have two-three
 * spelling variants in customs records).
 */
export async function resolveProspectIdentity(
  supabase: SupabaseClient,
  rfc: string
): Promise<ProspectIdentity | null> {
  const cleanRfc = rfc.trim().toUpperCase()
  const { data, error } = await supabase
    .from('aduanet_facturas')
    .select('rfc, nombre_cliente')
    .eq('rfc', cleanRfc)
    .limit(50)

  if (error || !data || data.length === 0) return null

  const counts = new Map<string, number>()
  for (const row of data) {
    const name = (row.nombre_cliente || '').trim()
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return {
    rfc: cleanRfc,
    razon_social: sorted.length > 0 ? sorted[0][0] : null,
  }
}

/**
 * Aggregate everything we know about an importer from aduanet_facturas.
 * Returns null only if the RFC is malformed; returns ProspectData with
 * empty=true when the RFC is well-formed but absent from the source.
 */
export async function getProspectByRfc(
  supabase: SupabaseClient,
  rfc: string
): Promise<ProspectData | null> {
  const cleanRfc = rfc.trim().toUpperCase()
  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(cleanRfc)) return null

  const { data, error } = await supabase
    .from('aduanet_facturas')
    .select('pedimento, patente, fecha_pago, valor_usd, proveedor, cve_documento, num_factura, incoterm, nombre_cliente')
    .eq('rfc', cleanRfc)
    .order('fecha_pago', { ascending: false })
    .limit(2000)

  if (error) {
    return {
      rfc: cleanRfc,
      razon_social: null,
      total_pedimentos: 0,
      total_valor_usd: 0,
      avg_valor_per_pedimento: 0,
      first_seen: null,
      last_seen: null,
      active_window_days: null,
      months_active: 0,
      avg_days_between: null,
      top_suppliers: [],
      monthly: [],
      competitors: [],
      primary_patente: null,
      primary_patente_is_us: false,
      pedimentos_with_us: 0,
      recent_facturas: [],
      generated_at: new Date().toISOString(),
      empty: true,
    }
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return {
      rfc: cleanRfc,
      razon_social: null,
      total_pedimentos: 0,
      total_valor_usd: 0,
      avg_valor_per_pedimento: 0,
      first_seen: null,
      last_seen: null,
      active_window_days: null,
      months_active: 0,
      avg_days_between: null,
      top_suppliers: [],
      monthly: [],
      competitors: [],
      primary_patente: null,
      primary_patente_is_us: false,
      pedimentos_with_us: 0,
      recent_facturas: [],
      generated_at: new Date().toISOString(),
      empty: true,
    }
  }

  const nameCounts = new Map<string, number>()
  for (const r of rows) {
    const n = (r.nombre_cliente || '').trim()
    if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1)
  }
  const razon_social = nameCounts.size > 0
    ? [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null

  const distinctPedimentos = new Set<string>()
  let totalUsd = 0
  let pedimentosWithUs = 0
  const supplierMap = new Map<string, { shipments: number; total_usd: number; last_seen: string | null }>()
  const monthMap = new Map<string, { pedimentos: Set<string>; valor_usd: number }>()
  const patenteMap = new Map<string, number>()
  const dateList: string[] = []

  for (const r of rows) {
    const ped = (r.pedimento || '').trim()
    if (ped) distinctPedimentos.add(ped)
    totalUsd += Number(r.valor_usd || 0)

    const patente = (r.patente || '').trim()
    if (patente) {
      patenteMap.set(patente, (patenteMap.get(patente) || 0) + 1)
      if (patente === PATENTE_3596 && ped) pedimentosWithUs++
    }

    const supplier = (r.proveedor || '').trim()
    if (supplier) {
      const cur = supplierMap.get(supplier) || { shipments: 0, total_usd: 0, last_seen: null as string | null }
      cur.shipments++
      cur.total_usd += Number(r.valor_usd || 0)
      if (r.fecha_pago && (!cur.last_seen || r.fecha_pago > cur.last_seen)) cur.last_seen = r.fecha_pago
      supplierMap.set(supplier, cur)
    }

    if (r.fecha_pago) {
      dateList.push(r.fecha_pago)
      const month = String(r.fecha_pago).slice(0, 7)
      const cur = monthMap.get(month) || { pedimentos: new Set<string>(), valor_usd: 0 }
      if (ped) cur.pedimentos.add(ped)
      cur.valor_usd += Number(r.valor_usd || 0)
      monthMap.set(month, cur)
    }
  }

  const sortedDates = dateList.sort()
  const first_seen = sortedDates[0] ?? null
  const last_seen = sortedDates[sortedDates.length - 1] ?? null
  const active_window_days = first_seen && last_seen
    ? Math.max(1, Math.round((new Date(last_seen).getTime() - new Date(first_seen).getTime()) / 86_400_000))
    : null

  const total_pedimentos = distinctPedimentos.size
  const avg_valor_per_pedimento = total_pedimentos > 0 ? totalUsd / total_pedimentos : 0
  const avg_days_between = total_pedimentos > 1 && active_window_days
    ? Math.round(active_window_days / (total_pedimentos - 1))
    : null

  const top_suppliers: ProspectSupplier[] = [...supplierMap.entries()]
    .map(([name, v]) => ({ name, shipments: v.shipments, total_usd: v.total_usd, last_seen: v.last_seen }))
    .sort((a, b) => b.shipments - a.shipments)
    .slice(0, 5)

  const monthly: ProspectMonthlyBucket[] = [...monthMap.entries()]
    .map(([month, v]) => ({ month, pedimentos: v.pedimentos.size, valor_usd: v.valor_usd }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const totalShipmentsForShare = [...patenteMap.values()].reduce((acc, n) => acc + n, 0)
  const competitors: ProspectCompetitor[] = [...patenteMap.entries()]
    .map(([patente, shipments]) => ({
      patente,
      shipments,
      share_pct: totalShipmentsForShare > 0 ? Math.round((shipments / totalShipmentsForShare) * 100) : 0,
    }))
    .sort((a, b) => b.shipments - a.shipments)

  const primary_patente = competitors[0]?.patente ?? null
  const primary_patente_is_us = primary_patente === PATENTE_3596

  const recent_facturas: ProspectFactura[] = rows.slice(0, 10).map(r => ({
    pedimento: r.pedimento ?? null,
    fecha_pago: r.fecha_pago ?? null,
    valor_usd: r.valor_usd ?? null,
    proveedor: r.proveedor ?? null,
    patente: r.patente ?? null,
    cve_documento: r.cve_documento ?? null,
    num_factura: r.num_factura ?? null,
    incoterm: r.incoterm ?? null,
  }))

  return {
    rfc: cleanRfc,
    razon_social,
    total_pedimentos,
    total_valor_usd: totalUsd,
    avg_valor_per_pedimento,
    first_seen,
    last_seen,
    active_window_days,
    months_active: monthMap.size,
    avg_days_between,
    top_suppliers,
    monthly,
    competitors,
    primary_patente,
    primary_patente_is_us,
    pedimentos_with_us: pedimentosWithUs,
    recent_facturas,
    generated_at: new Date().toISOString(),
    empty: false,
  }
}

/**
 * Build the 12-month sparkline series the cockpit renders. Always 12 buckets
 * (current month + previous 11), zero-filled for missing months. Returns
 * pedimento counts (deltas, not cumulative) so the sparkline reads as activity.
 */
export function buildMonthlySparkline(monthly: ProspectMonthlyBucket[], anchor = new Date()): number[] {
  const result: number[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const bucket = monthly.find(m => m.month === key)
    result.push(bucket?.pedimentos ?? 0)
  }
  return result
}
