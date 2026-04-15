/**
 * AGUILA · V1.5 F3 — AR/AP aging calculations.
 *
 * AR source  = `invoices` (company_id scoped, status not paid/cancelled).
 * AP source  = `aduanet_facturas` (legacy table, scoped via companies.clave_cliente).
 *               If the clave lookup fails, callers receive { sourceMissing: true }
 *               and the UI renders the graceful "Datos pendientes" tile.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+'
  count: number
  amount: number
}

export interface Debtor {
  id: string
  label: string
  amount: number
  daysOverdue: number
}

export interface AgingResult {
  total: number
  count: number
  byBucket: AgingBucket[]
  topDebtors: Debtor[]
  sourceMissing?: boolean
  currency: 'MXN' | 'USD'
}

const EMPTY_BUCKETS: AgingBucket[] = [
  { bucket: '0-30', count: 0, amount: 0 },
  { bucket: '31-60', count: 0, amount: 0 },
  { bucket: '61-90', count: 0, amount: 0 },
  { bucket: '90+', count: 0, amount: 0 },
]

function bucketFor(days: number): AgingBucket['bucket'] {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/**
 * AR aging from `econta_cartera` — the live cartera synced from
 * econta. Sources were confirmed 2026-04-15: the legacy `invoices`
 * table is empty; real data is in (econta_cartera, econta_facturas).
 *
 * econta_cartera joins via `cve_cliente` (the 4-digit clave), so when
 * a `companyId` slug is passed we first resolve companies → clave_cliente,
 * then filter by that. companyId === null → broker aggregate across
 * every cve_cliente.
 *
 * Aging bucket = today − fecha_vencimiento (fallback: fecha + 30d).
 * Only rows with `saldo > 0` are counted as outstanding.
 */
export async function computeARAging(
  supabase: SupabaseClient,
  companyId: string | null,
): Promise<AgingResult> {
  // Resolve companyId slug → clave_cliente if a specific tenant is requested.
  let claveFilter: string | null = null
  if (companyId) {
    const { data: co } = await supabase
      .from('companies')
      .select('clave_cliente')
      .eq('company_id', companyId)
      .maybeSingle()
    const clave = (co as { clave_cliente: string | null } | null)?.clave_cliente
    if (!clave) {
      // No clave on this company — no AR data available.
      return { total: 0, count: 0, byBucket: EMPTY_BUCKETS.map(b => ({ ...b })), topDebtors: [], currency: 'MXN' }
    }
    claveFilter = clave
  }

  let q = supabase
    .from('econta_cartera')
    .select('id, consecutivo, referencia, fecha, fecha_vencimiento, importe, saldo, moneda, cve_cliente, tipo')
    .gt('saldo', 0)
    .limit(10000)
  if (claveFilter) q = q.eq('cve_cliente', claveFilter)
  const { data, error } = await q

  if (error || !data) {
    return { total: 0, count: 0, byBucket: EMPTY_BUCKETS.map(b => ({ ...b })), topDebtors: [], currency: 'MXN' }
  }

  const now = new Date()
  const buckets = EMPTY_BUCKETS.map(b => ({ ...b }))
  let total = 0

  const rows = (data as Array<{
    id: string | number
    consecutivo: string | null
    referencia: string | null
    fecha: string | null
    fecha_vencimiento: string | null
    importe: number | null
    saldo: number | null
    moneda: string | null
    cve_cliente: string | null
    tipo: string | null
  }>).map((row) => {
    const saldo = Number(row.saldo) || 0
    const anchor = row.fecha_vencimiento
      ? new Date(row.fecha_vencimiento)
      : row.fecha
        ? new Date(new Date(row.fecha).getTime() + 30 * 86_400_000)
        : now
    const days = daysBetween(anchor, now)
    return {
      id: String(row.id),
      label: row.referencia || row.consecutivo || `#${row.id}`,
      amount: saldo,
      days,
    }
  })

  for (const r of rows) {
    total += r.amount
    const b = buckets.find(x => x.bucket === bucketFor(r.days))!
    b.count += 1
    b.amount += r.amount
  }

  const topDebtors: Debtor[] = rows
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(r => ({ id: r.id, label: r.label, amount: r.amount, daysOverdue: r.days }))

  return {
    total: Math.round(total),
    count: rows.length,
    byBucket: buckets,
    topDebtors,
    currency: 'MXN',
  }
}

/**
 * AP aging from legacy `aduanet_facturas`. Needs companies.clave_cliente
 * lookup — if missing we return { sourceMissing: true } so the UI can show
 * a graceful placeholder.
 */
export async function computeAPAging(
  supabase: SupabaseClient,
  companyId: string | null,
): Promise<AgingResult> {
  const empty: AgingResult = {
    total: 0,
    count: 0,
    byBucket: EMPTY_BUCKETS.map(b => ({ ...b })),
    topDebtors: [],
    currency: 'USD',
    sourceMissing: true,
  }

  // companyId === null → broker aggregate across all tenants.
  let claveFilter: string | null = null
  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('clave_cliente')
      .eq('company_id', companyId)
      .maybeSingle()
    const clave = (company as { clave_cliente: string | null } | null)?.clave_cliente
    if (!clave) return empty
    claveFilter = clave
  }

  let q = supabase
    .from('aduanet_facturas')
    .select('pedimento, referencia, valor_usd, fecha_factura, fecha_pago, proveedor')
    .is('fecha_pago', null)
    .not('fecha_factura', 'is', null)
    .limit(1000)
  if (claveFilter) q = q.eq('clave_cliente', claveFilter)
  const { data, error } = await q

  if (error || !data || data.length === 0) {
    return { ...empty, sourceMissing: false }
  }

  const now = new Date()
  const buckets = EMPTY_BUCKETS.map(b => ({ ...b }))
  let total = 0

  const rows = data.map((row) => {
    const amount = Number((row as { valor_usd: number | null }).valor_usd) || 0
    const fecha = (row as { fecha_factura: string | null }).fecha_factura
    const days = fecha ? daysBetween(new Date(fecha), now) : 0
    const ref = (row as { referencia: string | null }).referencia
    const ped = (row as { pedimento: string | null }).pedimento
    const prov = (row as { proveedor: string | null }).proveedor
    return {
      id: ref || ped || `${Math.random()}`,
      label: prov || ped || ref || 'Proveedor',
      amount,
      days,
    }
  })

  for (const r of rows) {
    total += r.amount
    const b = buckets.find(x => x.bucket === bucketFor(r.days))!
    b.count += 1
    b.amount += r.amount
  }

  const topDebtors: Debtor[] = rows
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(r => ({ id: r.id, label: r.label, amount: r.amount, daysOverdue: r.days }))

  return {
    total: Math.round(total),
    count: rows.length,
    byBucket: buckets,
    topDebtors,
    currency: 'USD',
    sourceMissing: false,
  }
}
