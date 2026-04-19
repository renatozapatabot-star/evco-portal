/**
 * PORTAL · Revenue dashboard aggregator.
 *
 * Owner-tier (admin/broker) ONLY. Aggregates ACROSS all tenants (no
 * companyId filter — invariant #31). Caller is responsible for the
 * role gate; this lib just runs the queries assuming service-role.
 *
 * Data sources:
 *   pedimentos       — count + IMMEX classification (fresh, nightly scrape)
 *   econta_facturas  — real broker fees when present (often stale; see estimator)
 *   companies        — RFC ↔ company_id ↔ display name map
 *
 * Performance: every query bounded with .limit(); no N+1; per-month
 * grouping happens in JS over capped row sets. If a single client ever
 * exceeds 5000 pedimentos in 12 months, we promote to an RPC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  classifyRegime,
  estimateFromClaves,
  pctChange,
  usdToMXN,
} from './estimator'
import type {
  ClientRevenue,
  MonthBucket,
  RevenueDashboardData,
} from './types'

const HARD_ROW_CAP = 50000
const MONTHS_BACK = 12

/** YYYY-MM key for a date. */
function ymKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Build the last N months ascending, current month last. */
function lastNMonths(n: number, ref: Date = new Date()): string[] {
  const out: string[] = []
  const cur = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1))
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cur)
    d.setUTCMonth(d.getUTCMonth() - i)
    out.push(ymKey(d))
  }
  return out
}

/** YYYY-MM of (date - 12 months). */
function ymMinusYear(ymStr: string): string {
  const [y, m] = ymStr.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

/** YYYY-MM of (date - 1 month). */
function ymMinusMonth(ymStr: string): string {
  const [y, m] = ymStr.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  return ymKey(d)
}

interface PedRow {
  rfc_importador: string | null
  clave_pedimento: string | null
  updated_at: string | null
  fecha_pago: string | null
  fecha_entrada: string | null
}

interface FacRow {
  cve_cliente: string | null
  total: number | null
  moneda: string | null
  fecha: string | null
  tipo_factura: string | null
}

interface CompanyRow {
  company_id: string | null
  rfc: string | null
  clave_cliente: string | null
  name: string | null
}

/**
 * Pick the canonical "month earned" date for a pedimento row.
 * Priority: fecha_pago > fecha_entrada > updated_at. Returns YYYY-MM.
 */
function pedimentoMonth(p: PedRow): string | null {
  const raw = p.fecha_pago || p.fecha_entrada || p.updated_at
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return ymKey(d)
}

/**
 * Determine the banner severity based on real-fee data freshness.
 *   loud   — most recent real-fee month is older than 3 months ago
 *   inform — real data exists but covers < 50% of last 12 months
 *   hide   — real data covers ≥ 50% AND is current within 3 months
 */
function bannerMode(
  realFeeCoveragePct: number,
  mostRecentRealFeeMonth: string | null,
  currentMonth: string,
): 'hide' | 'inform' | 'loud' {
  if (!mostRecentRealFeeMonth) return 'loud'
  // If real data exists but is older than 3 months, loud
  const [cy, cm] = currentMonth.split('-').map(Number)
  const [ry, rm] = mostRecentRealFeeMonth.split('-').map(Number)
  const monthsOld = (cy - ry) * 12 + (cm - rm)
  if (monthsOld > 3) return 'loud'
  if (realFeeCoveragePct < 50) return 'inform'
  return 'hide'
}

/**
 * Main entry. Pulls everything in parallel, builds per-month buckets +
 * per-client rollups, returns the full dashboard payload.
 */
export async function getRevenueDashboard(
  supabase: SupabaseClient,
  exchangeRateMXNperUSD: number,
  ref: Date = new Date(),
): Promise<RevenueDashboardData> {
  const months = lastNMonths(MONTHS_BACK, ref)
  const earliestMonth = months[0]
  const earliestDate = new Date(Date.UTC(
    Number(earliestMonth.slice(0, 4)),
    Number(earliestMonth.slice(5, 7)) - 1,
    1,
  ))
  // Look back one extra year for YoY comparisons
  const yoyEarliest = new Date(earliestDate)
  yoyEarliest.setUTCFullYear(yoyEarliest.getUTCFullYear() - 1)

  // ── Parallel fetches ────────────────────────────────────────
  const [pedRes, facRes, compRes] = await Promise.all([
    supabase
      .from('pedimentos')
      .select('rfc_importador, clave_pedimento, updated_at, fecha_pago, fecha_entrada')
      .gte('updated_at', yoyEarliest.toISOString())
      .order('updated_at', { ascending: false })
      .limit(HARD_ROW_CAP),
    supabase
      .from('econta_facturas')
      .select('cve_cliente, total, moneda, fecha, tipo_factura')
      .eq('tipo_factura', 'I')
      .gte('fecha', yoyEarliest.toISOString())
      .order('fecha', { ascending: false })
      .limit(HARD_ROW_CAP),
    supabase
      .from('companies')
      .select('company_id, rfc, clave_cliente, name')
      .limit(1000),
  ])

  const peds: PedRow[] = (pedRes.data as PedRow[] | null) ?? []
  const facs: FacRow[] = (facRes.data as FacRow[] | null) ?? []
  const companies: CompanyRow[] = (compRes.data as CompanyRow[] | null) ?? []

  // ── Lookup tables for company resolution ───────────────────
  const byRFC = new Map<string, CompanyRow>()
  const byClave = new Map<string, CompanyRow>()
  for (const c of companies) {
    if (c.rfc) byRFC.set(c.rfc.toUpperCase(), c)
    if (c.clave_cliente) byClave.set(c.clave_cliente, c)
  }

  // ── Initialize 12-month buckets ────────────────────────────
  const monthsMap = new Map<string, MonthBucket>()
  for (const m of months) {
    monthsMap.set(m, {
      month: m,
      pedimentoCount: 0,
      pedimentoCountStandard: 0,
      pedimentoCountImmex: 0,
      estimatedFeeUSD: 0,
      estimatedFeeMXN: 0,
      realFeeMXN: null,
      realFeeMXNFromMXN: 0,
      realFeeMXNFromUSD: 0,
    })
  }

  // ── Per-client rollups ─────────────────────────────────────
  const currentMonth = months[months.length - 1]
  const lastMonth = ymMinusMonth(currentMonth)
  const sameMonthLastYear = ymMinusYear(currentMonth)

  // Map company_id (or rfc fallback) → ClientRevenue
  const clientMap = new Map<string, ClientRevenue>()
  function getClient(rfc: string | null, name: string | null): ClientRevenue {
    const company = rfc ? byRFC.get(rfc.toUpperCase()) : null
    const key = company?.company_id || rfc || 'unknown'
    let entry = clientMap.get(key)
    if (!entry) {
      entry = {
        companyId: company?.company_id ?? null,
        rfc: rfc ?? company?.rfc ?? null,
        name: company?.name || name || rfc || 'Cliente sin RFC',
        pedimentoCountThisMonth: 0,
        pedimentoCountLastMonth: 0,
        pedimentoCountThisMonthLastYear: 0,
        estimatedFeeMXNThisMonth: 0,
        estimatedFeeMXNLastMonth: 0,
        realFeeMXNThisMonth: null,
        yoyGrowthPct: null,
        momGrowthPct: null,
      }
      clientMap.set(key, entry)
    }
    return entry
  }

  // ── Walk pedimentos ────────────────────────────────────────
  for (const p of peds) {
    const m = pedimentoMonth(p)
    if (!m) continue
    const regime = classifyRegime(p.clave_pedimento)
    const feeUSD = regime === 'immex' ? 400 : 125

    const bucket = monthsMap.get(m)
    if (bucket) {
      bucket.pedimentoCount++
      if (regime === 'immex') bucket.pedimentoCountImmex++
      else bucket.pedimentoCountStandard++
      bucket.estimatedFeeUSD += feeUSD
      bucket.estimatedFeeMXN += usdToMXN(feeUSD, exchangeRateMXNperUSD)
    }

    // Per-client (only for current/last/same-last-year months — keeps map small)
    if (m === currentMonth || m === lastMonth || m === sameMonthLastYear) {
      const client = getClient(p.rfc_importador, null)
      if (m === currentMonth) {
        client.pedimentoCountThisMonth++
        client.estimatedFeeMXNThisMonth += usdToMXN(feeUSD, exchangeRateMXNperUSD)
      } else if (m === lastMonth) {
        client.pedimentoCountLastMonth++
        client.estimatedFeeMXNLastMonth += usdToMXN(feeUSD, exchangeRateMXNperUSD)
      } else if (m === sameMonthLastYear) {
        client.pedimentoCountThisMonthLastYear++
      }
    }
  }

  // ── Walk econta_facturas (real billed fees) ────────────────
  for (const f of facs) {
    if (!f.fecha) continue
    const d = new Date(f.fecha)
    if (isNaN(d.getTime())) continue
    const m = ymKey(d)
    const bucket = monthsMap.get(m)
    const total = Number(f.total) || 0
    if (!total) continue
    // Currency normalization: 'MXN' / 'MXP' = pesos; 'USD' = dollars.
    const isUSD = String(f.moneda || '').toUpperCase() === 'USD'
    const totalMXN = isUSD ? usdToMXN(total, exchangeRateMXNperUSD) : total

    if (bucket) {
      bucket.realFeeMXN = (bucket.realFeeMXN ?? 0) + totalMXN
      if (isUSD) bucket.realFeeMXNFromUSD += totalMXN
      else bucket.realFeeMXNFromMXN += totalMXN
    }

    // Per-client real fee (current month only)
    if (m === currentMonth && f.cve_cliente) {
      const company = byClave.get(f.cve_cliente)
      const client = getClient(company?.rfc ?? null, company?.name ?? null)
      client.realFeeMXNThisMonth = (client.realFeeMXNThisMonth ?? 0) + totalMXN
    }
  }

  // ── Compute MoM / YoY % per client ──────────────────────────
  const clients = [...clientMap.values()]
  for (const c of clients) {
    c.momGrowthPct = pctChange(c.pedimentoCountThisMonth, c.pedimentoCountLastMonth)
    c.yoyGrowthPct = pctChange(c.pedimentoCountThisMonth, c.pedimentoCountThisMonthLastYear)
  }

  const topByRevenueThisMonth = [...clients]
    .filter((c) => c.estimatedFeeMXNThisMonth > 0)
    .sort((a, b) => b.estimatedFeeMXNThisMonth - a.estimatedFeeMXNThisMonth)
    .slice(0, 10)

  const topByYoYGrowth = [...clients]
    .filter(
      (c) =>
        c.yoyGrowthPct !== null &&
        c.yoyGrowthPct > 0 &&
        c.pedimentoCountThisMonth >= 3, // require minimum signal so a 0→2 isn't "infinite growth"
    )
    .sort((a, b) => (b.yoyGrowthPct ?? 0) - (a.yoyGrowthPct ?? 0))
    .slice(0, 10)

  // ── Coverage diagnostics for the banner ────────────────────
  const monthsArr = months.map((m) => monthsMap.get(m)!)
  const monthsWithReal = monthsArr.filter((b) => (b.realFeeMXN ?? 0) > 0).length
  const realFeeCoveragePct = (monthsWithReal / months.length) * 100
  const mostRecentRealFeeMonth =
    [...monthsArr].reverse().find((b) => (b.realFeeMXN ?? 0) > 0)?.month ?? null

  return {
    generatedAt: new Date().toISOString(),
    exchangeRateMXNperUSD,
    months: monthsArr,
    topByRevenueThisMonth,
    topByYoYGrowth,
    realFeeCoveragePct,
    mostRecentRealFeeMonth,
    estimatorBannerMode: bannerMode(realFeeCoveragePct, mostRecentRealFeeMonth, currentMonth),
  }
}

// Re-exports for the morning-alert script and tests
export { lastNMonths, ymKey, ymMinusMonth, ymMinusYear, pedimentoMonth, bannerMode }
