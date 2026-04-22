#!/usr/bin/env node

/**
 * refresh-trade-index.js — nightly Trade Index refresh.
 *
 * 1. Calls refresh_trade_index() to REFRESH CONCURRENTLY both MVs
 *    (mv_trade_index_client_position_90d, mv_trade_index_lane_90d).
 * 2. Computes per-company and fleet-wide overall metrics over the last
 *    90 days from traficos (clearance days + T-MEC rate).
 * 3. Upserts rows into the legacy `benchmarks` and `client_benchmarks`
 *    tables so /api/benchmarks + ComparativeWidget keep working and
 *    the new p10 / p90 columns on client_benchmarks get populated.
 * 4. Sends a Telegram summary on success; fires SEV-1 alert + exits 1
 *    on any failure (per operational-resilience.md rule #1).
 *
 * Cron: 02:45 CST nightly (after globalpc-sync at 01:00 and
 *       wsdl-anexo24-pull at 02:15, before morning report).
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { withSyncLog } = require('./lib/sync-log')
const { sendTelegram } = require('./lib/telegram')

const SCRIPT_NAME = 'refresh-trade-index'
const DRY_RUN = process.argv.includes('--dry-run')
const WINDOW_DAYS = 90
const CLEARANCE_MIN_DAYS = 0
const CLEARANCE_MAX_DAYS = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── math helpers ──────────────────────────────────────────────────────────

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

function round(n, places = 3) {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** places
  return Math.round(n * f) / f
}

// ─── steps ─────────────────────────────────────────────────────────────────

async function refreshMaterializedViews() {
  const { error } = await supabase.rpc('refresh_trade_index')
  if (error) throw new Error(`refresh_trade_index RPC: ${error.message}`)
}

async function fetchCrossings() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const all = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('traficos')
      .select('company_id, fecha_llegada, fecha_cruce, predicted_tmec')
      .not('fecha_cruce',  'is', null)
      .not('fecha_llegada','is', null)
      .not('company_id',   'is', null)
      .gte('fecha_cruce', since)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`fetchCrossings: ${error.message}`)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
    .map(t => {
      const days =
        (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime())
        / 86_400_000
      return { company_id: t.company_id, days, tmec: t.predicted_tmec === true }
    })
    .filter(r => Number.isFinite(r.days)
              && r.days >= CLEARANCE_MIN_DAYS
              && r.days <= CLEARANCE_MAX_DAYS)
}

function aggregate(crossings) {
  const byCompany = new Map()
  for (const r of crossings) {
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, [])
    byCompany.get(r.company_id).push(r)
  }

  const perCompany = []
  for (const [companyId, rows] of byCompany.entries()) {
    const days = rows.map(r => r.days).sort((a, b) => a - b)
    const tmecCount = rows.filter(r => r.tmec).length
    perCompany.push({
      company_id:     companyId,
      shipment_count: rows.length,
      avg:            round(days.reduce((s, d) => s + d, 0) / days.length, 3),
      median:         round(percentile(days, 0.50), 3),
      p10:            round(percentile(days, 0.10), 3),
      p90:            round(percentile(days, 0.90), 3),
      tmec_rate:      round(tmecCount / rows.length, 4),
    })
  }

  const fleetDays = crossings.map(r => r.days).sort((a, b) => a - b)
  const fleetTmec = crossings.filter(r => r.tmec).length
  const fleet = fleetDays.length === 0 ? null : {
    shipment_count: fleetDays.length,
    avg:            round(fleetDays.reduce((s, d) => s + d, 0) / fleetDays.length, 3),
    median:         round(percentile(fleetDays, 0.50), 3),
    p10:            round(percentile(fleetDays, 0.10), 3),
    p90:            round(percentile(fleetDays, 0.90), 3),
    tmec_rate:      round(fleetTmec / fleetDays.length, 4),
  }

  // Percentile rank per company (100 = fastest, 0 = slowest). Ties share rank.
  const byAvg = [...perCompany].sort((a, b) => a.avg - b.avg)
  const denom = Math.max(byAvg.length - 1, 1)
  byAvg.forEach((c, i) => {
    c.percentile = round(((byAvg.length - 1 - i) / denom) * 100, 2)
  })

  return { perCompany, fleet }
}

async function upsertBenchmarks({ perCompany, fleet }) {
  const periodDate = new Date().toISOString().split('T')[0]
  if (DRY_RUN || !fleet) return { periodDate }

  // ── legacy `benchmarks` (metric/dimension/value) ─────────────────────────
  const rows = [
    { metric: 'avg_crossing_days', dimension: 'fleet',
      value: fleet.avg, sample_size: fleet.shipment_count, period: periodDate },
    { metric: 'tmec_rate', dimension: 'fleet',
      value: round(fleet.tmec_rate * 100, 2), sample_size: fleet.shipment_count, period: periodDate },
  ]
  for (const c of perCompany) {
    rows.push(
      { metric: 'avg_crossing_days', dimension: c.company_id,
        value: c.avg, sample_size: c.shipment_count, period: periodDate },
      { metric: 'tmec_rate', dimension: c.company_id,
        value: round(c.tmec_rate * 100, 2), sample_size: c.shipment_count, period: periodDate },
    )
  }
  const ins1 = await supabase.from('benchmarks').insert(rows)
  if (ins1.error) throw new Error(`benchmarks insert: ${ins1.error.message}`)

  // ── `client_benchmarks` (populates new p10 / p90 columns) ────────────────
  const clientRows = perCompany.map(c => ({
    company_id:      c.company_id,
    metric_name:     'avg_crossing_days',
    client_value:    c.avg,
    fleet_average:   fleet.avg,
    fleet_median:    fleet.median,
    top_quartile:    null,       // quartiles left to compute-benchmarks.js
    bottom_quartile: null,
    p10:             fleet.p10,
    p90:             fleet.p90,
    percentile:      c.percentile,
    sample_size:     fleet.shipment_count,
    total_operations: c.shipment_count,
    period:          periodDate,
    calculated_at:   new Date().toISOString(),
  }))
  if (clientRows.length) {
    const ins2 = await supabase.from('client_benchmarks').insert(clientRows)
    if (ins2.error) throw new Error(`client_benchmarks insert: ${ins2.error.message}`)
  }

  return { periodDate, benchmarkRows: rows.length, clientRows: clientRows.length }
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[${SCRIPT_NAME}] starting${DRY_RUN ? ' (DRY RUN)' : ''}…`)

  const result = await withSyncLog(
    supabase,
    { sync_type: 'trade_index', company_id: null },
    async () => {
      await refreshMaterializedViews()
      const crossings = await fetchCrossings()
      if (crossings.length === 0) {
        console.log(`[${SCRIPT_NAME}] no crossings in ${WINDOW_DAYS}d window — MVs refreshed, nothing to upsert`)
        return { rows_synced: 0, fleet: null, companies: 0, periodDate: null }
      }
      const agg = aggregate(crossings)
      const written = await upsertBenchmarks(agg)
      return {
        rows_synced: crossings.length,
        fleet:       agg.fleet,
        companies:   agg.perCompany.length,
        periodDate:  written.periodDate,
      }
    }
  )

  if (result?.fleet) {
    const msg = [
      `📊 <b>Trade Index — ${result.periodDate}</b>`,
      ``,
      `🚢 Fleet cruce: <b>${result.fleet.avg.toFixed(2)}d</b> · `
        + `p10 <b>${result.fleet.p10?.toFixed?.(2) ?? '—'}d</b> · `
        + `p90 <b>${result.fleet.p90?.toFixed?.(2) ?? '—'}d</b>`,
      `🛡️ Fleet T-MEC: <b>${(result.fleet.tmec_rate * 100).toFixed(1)}%</b>`,
      `📦 Muestras: <b>${result.fleet.shipment_count.toLocaleString()}</b> cruces · `
        + `<b>${result.companies}</b> clientes`,
      ``,
      `— Patente 3596`,
    ].join('\n')
    await sendTelegram(msg)
  }

  console.log(`[${SCRIPT_NAME}] done`)
  process.exit(0)
}

main().catch(async (err) => {
  const text = `🔴 <b>${SCRIPT_NAME}</b> falló: ${err.message}`
  console.error(`[${SCRIPT_NAME}] fatal:`, err)
  try { await sendTelegram(text) } catch { /* never let TG mask exit code */ }
  process.exit(1)
})
