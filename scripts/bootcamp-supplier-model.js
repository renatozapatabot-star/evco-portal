#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 4 — Supplier Behavior Modeling
//
// Builds per-supplier profiles from traficos + facturas.
// Reliability scores, turnaround metrics, seasonal patterns.
// Pure aggregation. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-supplier-model.js              # full batch
//   node scripts/bootcamp-supplier-model.js --dry-run     # preview only
//   node scripts/bootcamp-supplier-model.js --company=evco # single company
//
// Cron: 0 4 * * 1  (Monday 4 AM — weekly)
// ============================================================================

const {
  initBootcamp, upsertChunked, saveCheckpoint, fatalHandler,
  percentile, stdDev, mean,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-supplier-model'
const MIN_HOURS = 1
const MAX_HOURS = 240

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 4: Supplier Behavior Modeling`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'FULL BATCH'}`)

  // ── Step 1: Fetch all traficos with supplier data ─────────────────────
  console.log('\n📦 Step 1: Fetching traficos...')

  let offset = 0
  const batchSize = 5000
  const allTraficos = []

  while (true) {
    let query = supabase
      .from('traficos')
      .select('trafico, company_id, proveedores, fecha_llegada, fecha_cruce, importe_total, regimen, pais_procedencia, semaforo')
      .not('proveedores', 'is', null)

    if (args.company) query = query.eq('company_id', args.company)

    const { data, error } = await query.range(offset, offset + batchSize - 1)
    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data || data.length === 0) break

    allTraficos.push(...data)
    offset += batchSize
    process.stdout.write(`\r  Fetched: ${allTraficos.length.toLocaleString()} traficos...`)
    if (data.length < batchSize) break
  }

  console.log(`\r  Fetched: ${allTraficos.length.toLocaleString()} traficos ✓`)

  // ── Step 2: Group by supplier × company ───────────────────────────────
  console.log('\n🔍 Step 2: Grouping by supplier...')

  // supplierKey = "supplierCode|companyId"
  const supplierMap = new Map()

  for (const t of allTraficos) {
    // proveedores can be a comma-separated string or a single name
    const suppliers = (t.proveedores || '').split(/[,;]/).map(s => s.trim().toUpperCase()).filter(Boolean)
    if (suppliers.length === 0) continue

    for (const supplier of suppliers) {
      const key = `${supplier}|${t.company_id}`
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_code: supplier,
          company_id: t.company_id,
          traficos: [],
        })
      }
      supplierMap.get(key).traficos.push(t)
    }
  }

  console.log(`  Unique supplier-company pairs: ${supplierMap.size.toLocaleString()}`)

  // ── Step 3: Compute profiles ──────────────────────────────────────────
  console.log('\n📊 Step 3: Computing supplier profiles...')

  const profiles = []

  for (const [, data] of supplierMap) {
    const traficos = data.traficos
    if (traficos.length < 2) continue // skip one-off suppliers

    const values = traficos.map(t => Number(t.importe_total) || 0).filter(v => v > 0)
    const crossingHours = []
    const months = new Map()
    const countries = new Map()
    let semaforoVerde = 0
    let semaforoTotal = 0

    for (const t of traficos) {
      // Crossing time
      if (t.fecha_llegada && t.fecha_cruce) {
        const hours = (new Date(t.fecha_cruce) - new Date(t.fecha_llegada)) / 3600000
        if (hours >= MIN_HOURS && hours <= MAX_HOURS) {
          crossingHours.push(hours)
        }
      }

      // Monthly distribution
      if (t.fecha_llegada) {
        const m = new Date(t.fecha_llegada).getMonth() + 1
        months.set(m, (months.get(m) || 0) + 1)
      }

      // Country
      if (t.pais_procedencia) {
        countries.set(t.pais_procedencia, (countries.get(t.pais_procedencia) || 0) + 1)
      }

      // Semaforo
      if (t.semaforo) {
        semaforoTotal++
        if (t.semaforo.toLowerCase().includes('verde')) semaforoVerde++
      }
    }

    // Calculate turnaround (crossing time as proxy)
    const sortedHours = [...crossingHours].sort((a, b) => a - b)
    const avgHours = crossingHours.length > 0 ? mean(crossingHours) : null
    const avgDays = avgHours ? avgHours / 24 : null

    // Peak months (>1.5× average monthly volume)
    const avgMonthlyVol = traficos.length / 12
    const peakMonths = [...months.entries()]
      .filter(([, count]) => count > avgMonthlyVol * 1.5)
      .map(([m]) => m)
      .sort((a, b) => a - b)

    // Trend: compare last 6 months vs prior 6 months
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)
    const recent = traficos.filter(t => t.fecha_llegada && new Date(t.fecha_llegada) >= sixMonthsAgo).length
    const prior = traficos.filter(t => t.fecha_llegada && new Date(t.fecha_llegada) >= twelveMonthsAgo && new Date(t.fecha_llegada) < sixMonthsAgo).length

    let trend = 'stable'
    if (prior > 0) {
      const ratio = recent / prior
      if (ratio > 1.3) trend = 'growing'
      else if (ratio < 0.7) trend = 'declining'
    } else if (recent === 0) {
      trend = 'dormant'
    }

    // Reliability score (0-100)
    // Weighted: on-time crossing (40%) + value consistency (30%) + semaforo verde rate (30%)
    const valueStdDev = values.length > 1 ? stdDev(values) : 0
    const valueCV = values.length > 1 && mean(values) > 0 ? valueStdDev / mean(values) : 0
    const valueConsistency = Math.max(0, 100 - valueCV * 100) // lower CV = higher consistency

    const onTimePct = crossingHours.length > 0
      ? (crossingHours.filter(h => h <= (avgHours || 48)).length / crossingHours.length) * 100
      : 50 // neutral if no crossing data

    const semaforoRate = semaforoTotal > 0
      ? (semaforoVerde / semaforoTotal) * 100
      : 50 // neutral

    const reliabilityScore = Math.round(
      onTimePct * 0.4 +
      Math.min(valueConsistency, 100) * 0.3 +
      semaforoRate * 0.3
    )

    // Dates
    const dates = traficos
      .map(t => t.fecha_llegada)
      .filter(Boolean)
      .sort()
    const firstOp = dates[0] ? dates[0].split('T')[0] : null
    const lastOp = dates[dates.length - 1] ? dates[dates.length - 1].split('T')[0] : null

    profiles.push({
      supplier_code: data.supplier_code,
      supplier_name: data.supplier_code, // same until we have a name lookup
      company_id: data.company_id,
      total_operations: traficos.length,
      total_value_usd: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      avg_value_usd: values.length > 0 ? Math.round(mean(values) * 100) / 100 : null,
      avg_crossing_hours: avgHours ? Math.round(avgHours * 10) / 10 : null,
      p50_crossing_hours: sortedHours.length > 0 ? percentile(sortedHours, 50) : null,
      p95_crossing_hours: sortedHours.length > 0 ? percentile(sortedHours, 95) : null,
      reliability_score: reliabilityScore,
      on_time_pct: crossingHours.length > 0
        ? Math.round(onTimePct * 10) / 10
        : null,
      avg_turnaround_days: avgDays ? Math.round(avgDays * 10) / 10 : null,
      peak_months: peakMonths.length > 0 ? peakMonths : null,
      primary_fracciones: null, // enriched later from fraccion_patterns
      primary_countries: [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c),
      first_operation: firstOp,
      last_operation: lastOp,
      trend,
      computed_at: new Date().toISOString(),
    })
  }

  // Sort by total operations descending
  profiles.sort((a, b) => b.total_operations - a.total_operations)

  console.log(`  Profiles built: ${profiles.length.toLocaleString()}`)
  console.log(`  Top 5:`)
  profiles.slice(0, 5).forEach(p => {
    console.log(`    ${p.supplier_code} (${p.company_id}): ${p.total_operations} ops, reliability=${p.reliability_score}, trend=${p.trend}`)
  })

  // ── Step 4: Upsert ────────────────────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n🏁 DRY RUN — would upsert ${profiles.length} supplier profiles`)
  } else {
    console.log('\n💾 Step 4: Upserting to supplier_profiles...')
    const upserted = await upsertChunked(supabase, 'supplier_profiles', profiles, 'supplier_code,company_id')
    console.log(`  Upserted: ${upserted} rows`)

    // Write top supplier summaries to cruz_memory per company
    console.log('\n🧠 Step 5: Writing to cruz_memory...')
    const companies = [...new Set(profiles.map(p => p.company_id))]
    const memoryRows = []

    for (const companyId of companies) {
      const companySuppliers = profiles
        .filter(p => p.company_id === companyId)
        .sort((a, b) => b.total_operations - a.total_operations)

      memoryRows.push({
        company_id: companyId,
        pattern_type: 'supplier_summary',
        pattern_key: `suppliers:${companyId}:top`,
        pattern_value: {
          total_suppliers: companySuppliers.length,
          top_5: companySuppliers.slice(0, 5).map(s => ({
            code: s.supplier_code,
            ops: s.total_operations,
            reliability: s.reliability_score,
            avg_hours: s.avg_crossing_hours,
            trend: s.trend,
          })),
          avg_reliability: Math.round(mean(companySuppliers.map(s => s.reliability_score))),
        },
        confidence: companySuppliers.length > 5 ? 0.9 : 0.6,
        observations: companySuppliers.length,
        source: 'bootcamp_supplier_model',
        last_seen: new Date().toISOString(),
      })
    }

    await upsertChunked(supabase, 'cruz_memory', memoryRows, 'company_id,pattern_key')
    console.log(`  Wrote ${memoryRows.length} company supplier summaries`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    traficos_analyzed: allTraficos.length,
    supplier_profiles: profiles.length,
    companies: [...new Set(profiles.map(p => p.company_id))].length,
    avg_reliability: Math.round(mean(profiles.map(p => p.reliability_score))),
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 4 complete in ${elapsed}s`)
  console.log(`   ${profiles.length} supplier profiles across ${summary.companies} companies`)
  console.log(`   Avg reliability: ${summary.avg_reliability}/100`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 4: Supplier Model</b>\n` +
      `${profiles.length} proveedores · ${summary.companies} clientes\n` +
      `Reliability avg: ${summary.avg_reliability}/100\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
