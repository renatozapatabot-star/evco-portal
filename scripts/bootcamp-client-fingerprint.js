#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 5 — Client Operation Fingerprinting
//
// Builds operational fingerprint per company from historical data.
// When CRUZ activates a new client, it already knows their patterns.
// Pure aggregation. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-client-fingerprint.js              # all companies
//   node scripts/bootcamp-client-fingerprint.js --dry-run
//   node scripts/bootcamp-client-fingerprint.js --company=evco
//
// Cron: 30 4 * * 1  (Monday 4:30 AM — weekly)
// ============================================================================

const {
  initBootcamp, upsertChunked, saveCheckpoint, fatalHandler,
  percentile, stdDev, mean,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-client-fingerprint'
const MIN_HOURS = 1
const MAX_HOURS = 240

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 5: Client Operation Fingerprinting`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'FULL BATCH'}`)

  // ── Step 1: Fetch all traficos grouped by company ─────────────────────
  console.log('\n📦 Step 1: Fetching traficos...')

  let offset = 0
  const batchSize = 5000
  const companyMap = new Map() // company_id → [traficos]

  while (true) {
    let query = supabase
      .from('traficos')
      .select('trafico, company_id, estatus, fecha_llegada, fecha_cruce, importe_total, regimen, pais_procedencia, descripcion_mercancia, proveedores, semaforo')

    if (args.company) query = query.eq('company_id', args.company)

    const { data, error } = await query.range(offset, offset + batchSize - 1)
    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data || data.length === 0) break

    for (const t of data) {
      const cid = t.company_id || 'unknown'
      if (!companyMap.has(cid)) companyMap.set(cid, [])
      companyMap.get(cid).push(t)
    }

    offset += batchSize
    process.stdout.write(`\r  Fetched: ${offset.toLocaleString()} traficos...`)
    if (data.length < batchSize) break
  }

  const totalTraficos = [...companyMap.values()].reduce((s, arr) => s + arr.length, 0)
  console.log(`\r  Fetched: ${totalTraficos.toLocaleString()} traficos across ${companyMap.size} companies ✓`)

  // ── Step 2: Compute fingerprints ──────────────────────────────────────
  console.log('\n📊 Step 2: Computing fingerprints...')

  // Get network averages for comparison
  const allCrossingHours = []
  for (const traficos of companyMap.values()) {
    for (const t of traficos) {
      if (t.fecha_llegada && t.fecha_cruce) {
        const h = (new Date(t.fecha_cruce) - new Date(t.fecha_llegada)) / 3600000
        if (h >= MIN_HOURS && h <= MAX_HOURS) allCrossingHours.push(h)
      }
    }
  }
  const networkAvgHours = mean(allCrossingHours)

  const fingerprints = []

  for (const [companyId, traficos] of companyMap) {
    if (traficos.length < 3) continue // skip tiny clients

    // Monthly volume
    const monthlyVolume = new Map()
    const yearlyVolume = new Map()
    const values = []
    const crossingHours = []
    const suppliers = new Map()
    const fracciones = new Set()
    const countries = new Map()
    const regimens = new Map()
    let semaforoVerde = 0
    let semaforoTotal = 0

    for (const t of traficos) {
      // Monthly distribution
      if (t.fecha_llegada) {
        const d = new Date(t.fecha_llegada)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyVolume.set(ym, (monthlyVolume.get(ym) || 0) + 1)
        const y = d.getFullYear()
        yearlyVolume.set(y, (yearlyVolume.get(y) || 0) + 1)
      }

      // Values
      const val = Number(t.importe_total) || 0
      if (val > 0) values.push(val)

      // Crossing
      if (t.fecha_llegada && t.fecha_cruce) {
        const h = (new Date(t.fecha_cruce) - new Date(t.fecha_llegada)) / 3600000
        if (h >= MIN_HOURS && h <= MAX_HOURS) crossingHours.push(h)
      }

      // Suppliers
      const provs = (t.proveedores || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
      for (const p of provs) suppliers.set(p, (suppliers.get(p) || 0) + 1)

      // Countries
      if (t.pais_procedencia) countries.set(t.pais_procedencia, (countries.get(t.pais_procedencia) || 0) + 1)

      // Regimen
      if (t.regimen) regimens.set(t.regimen, (regimens.get(t.regimen) || 0) + 1)

      // Semaforo
      if (t.semaforo) {
        semaforoTotal++
        if (t.semaforo.toLowerCase().includes('verde')) semaforoVerde++
      }
    }

    // Trend: monthly volumes
    const monthlyVols = [...monthlyVolume.values()]
    const avgMonthly = monthlyVols.length > 0 ? mean(monthlyVols) : 0
    const monthlyStdDev = monthlyVols.length > 1 ? stdDev(monthlyVols) : 0
    const seasonalStrength = avgMonthly > 0 ? Math.round(monthlyStdDev / avgMonthly * 100) / 100 : 0

    // Yearly trend
    const years = [...yearlyVolume.entries()].sort((a, b) => a[0] - b[0])
    let volumeTrend = 'stable'
    if (years.length >= 2) {
      const lastYear = years[years.length - 1][1]
      const prevYear = years[years.length - 2][1]
      if (prevYear > 0) {
        const ratio = lastYear / prevYear
        if (ratio > 1.2) volumeTrend = 'growing'
        else if (ratio < 0.8) volumeTrend = 'declining'
      }
    }

    // Supplier concentration (Herfindahl index)
    const totalSupplierOps = [...suppliers.values()].reduce((a, b) => a + b, 0)
    const herfindahl = totalSupplierOps > 0
      ? [...suppliers.values()].reduce((sum, count) => {
        const share = count / totalSupplierOps
        return sum + share * share
      }, 0)
      : 1

    // Peak months
    const monthCounts = new Array(12).fill(0)
    for (const t of traficos) {
      if (t.fecha_llegada) {
        const m = new Date(t.fecha_llegada).getMonth()
        monthCounts[m]++
      }
    }
    const avgMonthCount = mean(monthCounts.filter(c => c > 0))
    const peakMonths = monthCounts
      .map((c, i) => ({ month: i + 1, count: c }))
      .filter(m => m.count > avgMonthCount * 1.5)
      .map(m => m.month)

    // Crossing vs network
    const avgCrossing = crossingHours.length > 0 ? mean(crossingHours) : null
    const crossingVsNetwork = avgCrossing && networkAvgHours
      ? Math.round((avgCrossing - networkAvgHours) * 10) / 10
      : null

    const fingerprint = {
      company_id: companyId,
      total_operations: traficos.length,
      volume_trend: volumeTrend,
      avg_monthly_volume: Math.round(avgMonthly * 10) / 10,
      seasonal_strength: seasonalStrength,
      peak_months: peakMonths,
      avg_shipment_value: values.length > 0 ? Math.round(mean(values) * 100) / 100 : null,
      total_value: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      supplier_count: suppliers.size,
      supplier_concentration: Math.round(herfindahl * 1000) / 1000, // 1.0 = single supplier
      top_suppliers: [...suppliers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s),
      primary_countries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c),
      primary_regimens: [...regimens.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r),
      avg_crossing_hours: avgCrossing ? Math.round(avgCrossing * 10) / 10 : null,
      crossing_vs_network_hours: crossingVsNetwork,
      reconocimiento_rate: semaforoTotal > 0
        ? Math.round((1 - semaforoVerde / semaforoTotal) * 100)
        : null,
      first_operation: traficos.map(t => t.fecha_llegada).filter(Boolean).sort()[0]?.split('T')[0] || null,
      last_operation: traficos.map(t => t.fecha_llegada).filter(Boolean).sort().pop()?.split('T')[0] || null,
    }

    fingerprints.push(fingerprint)
  }

  fingerprints.sort((a, b) => b.total_operations - a.total_operations)

  console.log(`  Fingerprints built: ${fingerprints.length}`)
  console.log(`  Top 5:`)
  fingerprints.slice(0, 5).forEach(f => {
    console.log(`    ${f.company_id}: ${f.total_operations} ops, trend=${f.volume_trend}, suppliers=${f.supplier_count}, hhi=${f.supplier_concentration}`)
  })

  // ── Step 3: Write to cruz_memory ──────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n🏁 DRY RUN — would write ${fingerprints.length} fingerprints to cruz_memory`)
  } else {
    console.log('\n💾 Step 3: Writing to cruz_memory...')

    const memoryRows = fingerprints.map(f => ({
      company_id: f.company_id,
      pattern_type: 'client_fingerprint',
      pattern_key: `fingerprint:${f.company_id}`,
      pattern_value: f,
      confidence: f.total_operations > 50 ? 0.9 : f.total_operations > 10 ? 0.7 : 0.4,
      observations: f.total_operations,
      source: 'bootcamp_client_fingerprint',
      last_seen: new Date().toISOString(),
    }))

    await upsertChunked(supabase, 'cruz_memory', memoryRows, 'company_id,pattern_key')
    console.log(`  Wrote ${memoryRows.length} client fingerprints`)

    // Also write network-wide summary to network_intelligence
    const networkSummary = {
      metric_type: 'client_landscape',
      metric_key: 'fingerprint_summary',
      metric_value: {
        total_companies: fingerprints.length,
        active_companies: fingerprints.filter(f => f.volume_trend !== 'declining').length,
        growing_companies: fingerprints.filter(f => f.volume_trend === 'growing').length,
        avg_operations: Math.round(mean(fingerprints.map(f => f.total_operations))),
        avg_suppliers_per_client: Math.round(mean(fingerprints.map(f => f.supplier_count)) * 10) / 10,
        avg_reconocimiento_rate: Math.round(mean(fingerprints.filter(f => f.reconocimiento_rate !== null).map(f => f.reconocimiento_rate))),
      },
      sample_size: fingerprints.length,
      computed_at: new Date().toISOString(),
    }

    await upsertChunked(supabase, 'network_intelligence', [networkSummary], 'metric_type,metric_key')
    console.log(`  Wrote network landscape summary`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    companies_fingerprinted: fingerprints.length,
    total_traficos: totalTraficos,
    growing: fingerprints.filter(f => f.volume_trend === 'growing').length,
    stable: fingerprints.filter(f => f.volume_trend === 'stable').length,
    declining: fingerprints.filter(f => f.volume_trend === 'declining').length,
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 5 complete in ${elapsed}s`)
  console.log(`   ${fingerprints.length} companies fingerprinted`)
  console.log(`   Growing: ${summary.growing} · Stable: ${summary.stable} · Declining: ${summary.declining}`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 5: Client Fingerprints</b>\n` +
      `${fingerprints.length} clientes · ${totalTraficos.toLocaleString()} tráficos\n` +
      `📈 ${summary.growing} growing · 📊 ${summary.stable} stable · 📉 ${summary.declining} declining\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
