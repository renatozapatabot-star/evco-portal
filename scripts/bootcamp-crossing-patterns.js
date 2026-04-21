#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 3 — Crossing Pattern Analysis
//
// Mines 32K traficos for bridge/time/season/carrier crossing patterns.
// Extends crossing-model-train.js with deeper cross-feature analysis.
// Pure aggregation. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-crossing-patterns.js              # full batch
//   node scripts/bootcamp-crossing-patterns.js --dry-run     # preview only
//   node scripts/bootcamp-crossing-patterns.js --limit=5000  # cap rows
//
// Cron: 30 3 * * 0  (Sunday 3:30 AM — weekly incremental)
// ============================================================================

const {
  initBootcamp, fetchBatched, upsertChunked,
  saveCheckpoint, loadCheckpoint, fatalHandler,
  percentile, stdDev, mean, topN,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-crossing-patterns'

// Outlier bounds (same as crossing-model-train.js line 57)
const MIN_HOURS = 1
const MAX_HOURS = 240

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// Known holiday ranges (approximate — Semana Santa shifts yearly)
const HOLIDAYS = [
  { name: 'semana_santa', monthStart: 3, monthEnd: 4 }, // March-April window
  { name: 'navidad', monthStart: 12, monthEnd: 12 },
  { name: 'año_nuevo', monthStart: 1, monthEnd: 1 },
  { name: 'dia_independencia', monthStart: 9, monthEnd: 9 },
]

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 3: Crossing Pattern Analysis`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'FULL BATCH'}`)

  // ── Step 1: Fetch all traficos with crossing dates ────────────────────
  console.log('\n📦 Step 1: Fetching traficos with crossing data...')

  let offset = 0
  const batchSize = args.batchSize || 5000
  const features = []
  let totalFetched = 0
  let filtered = 0

  while (true) {
    const { data, error } = await supabase
      .from('traficos')
      .select('trafico, fecha_llegada, fecha_cruce, transportista_extranjero, regimen, peso_bruto, company_id, importe_total, semaforo')
      .not('fecha_llegada', 'is', null)
      .not('fecha_cruce', 'is', null)
      .range(offset, offset + batchSize - 1)

    if (error) throw new Error(`Fetch error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const t of data) {
      const llegada = new Date(t.fecha_llegada)
      const cruce = new Date(t.fecha_cruce)
      const hours = (cruce - llegada) / 3600000

      if (hours < MIN_HOURS || hours > MAX_HOURS) {
        filtered++
        continue
      }

      features.push({
        trafico: t.trafico,
        company_id: t.company_id,
        crossing_hours: Math.round(hours * 10) / 10,
        day_of_week: cruce.getDay(),
        hour_of_day: cruce.getHours(),
        month: cruce.getMonth() + 1,
        year: cruce.getFullYear(),
        carrier: (t.transportista_extranjero || 'UNKNOWN').toUpperCase().trim(),
        regimen: t.regimen || 'UNKNOWN',
        peso_bruto: t.peso_bruto || 0,
        value: Number(t.importe_total) || 0,
        semaforo: t.semaforo || null,
      })
    }

    totalFetched += data.length
    offset += batchSize
    process.stdout.write(`\r  Fetched: ${totalFetched.toLocaleString()} traficos...`)

    if (args.limit && totalFetched >= args.limit) break
    if (data.length < batchSize) break
  }

  console.log(`\r  Fetched: ${totalFetched.toLocaleString()} traficos ✓`)
  console.log(`  Valid crossings: ${features.length.toLocaleString()} (filtered ${filtered} outliers)`)

  if (features.length === 0) {
    console.log('\n⚠️ No valid crossings found. Exiting.')
    return
  }

  // ── Step 2: Day-of-week × hour-of-day heatmap ────────────────────────
  console.log('\n📊 Step 2: Building crossing heatmap...')

  const heatmap = {} // "dow:hour" → [hours]
  const dayStats = {} // dow → [hours]
  const hourStats = {} // hour → [hours]
  const monthStats = {} // month → [hours]
  const carrierStats = {} // carrier → [hours]
  const yearMonthStats = {} // "YYYY-MM" → [hours]
  const dayCarrier = {} // "dow:carrier" → [hours]
  const semaforoStats = { verde: 0, rojo: 0, total: 0 }

  for (const f of features) {
    // Heatmap
    const heatKey = `${f.day_of_week}:${f.hour_of_day}`
    if (!heatmap[heatKey]) heatmap[heatKey] = []
    heatmap[heatKey].push(f.crossing_hours)

    // Day-of-week
    if (!dayStats[f.day_of_week]) dayStats[f.day_of_week] = []
    dayStats[f.day_of_week].push(f.crossing_hours)

    // Hour-of-day
    if (!hourStats[f.hour_of_day]) hourStats[f.hour_of_day] = []
    hourStats[f.hour_of_day].push(f.crossing_hours)

    // Month
    if (!monthStats[f.month]) monthStats[f.month] = []
    monthStats[f.month].push(f.crossing_hours)

    // Carrier
    if (!carrierStats[f.carrier]) carrierStats[f.carrier] = []
    carrierStats[f.carrier].push(f.crossing_hours)

    // Year-Month (for trend analysis)
    const ymKey = `${f.year}-${String(f.month).padStart(2, '0')}`
    if (!yearMonthStats[ymKey]) yearMonthStats[ymKey] = []
    yearMonthStats[ymKey].push(f.crossing_hours)

    // Day × Carrier cross-feature
    const dcKey = `${f.day_of_week}:${f.carrier}`
    if (!dayCarrier[dcKey]) dayCarrier[dcKey] = []
    dayCarrier[dcKey].push(f.crossing_hours)

    // Semaforo
    if (f.semaforo) {
      semaforoStats.total++
      if (f.semaforo.toLowerCase().includes('verde')) semaforoStats.verde++
      if (f.semaforo.toLowerCase().includes('rojo')) semaforoStats.rojo++
    }
  }

  // ── Step 3: Build learned_patterns ────────────────────────────────────
  console.log('\n🧠 Step 3: Building learned patterns...')

  const patterns = []
  const allHours = features.map(f => f.crossing_hours).sort((a, b) => a - b)
  const overallAvg = mean(allHours)
  const overallP50 = percentile(allHours, 50)
  const overallP95 = percentile(allHours, 95)

  // Overall stats
  patterns.push({
    pattern_type: 'crossing_analysis',
    pattern_key: 'crossing:overall',
    pattern_value: {
      avg_hours: Math.round(overallAvg * 10) / 10,
      p50_hours: overallP50,
      p95_hours: overallP95,
      std_dev: Math.round(stdDev(allHours) * 10) / 10,
      total_crossings: features.length,
      semaforo_verde_pct: semaforoStats.total > 0
        ? Math.round(semaforoStats.verde / semaforoStats.total * 100)
        : null,
    },
    confidence: 0.95,
    source: 'bootcamp_crossing_patterns',
    sample_size: features.length,
    first_detected: new Date().toISOString(),
    last_confirmed: new Date().toISOString(),
    active: true,
  })

  // Per day-of-week
  for (const [dow, hours] of Object.entries(dayStats)) {
    const sorted = [...hours].sort((a, b) => a - b)
    patterns.push({
      pattern_type: 'crossing_analysis',
      pattern_key: `crossing:day:${dow}`,
      pattern_value: {
        day_of_week: Number(dow),
        day_name: DAY_NAMES[Number(dow)],
        avg_hours: Math.round(mean(hours) * 10) / 10,
        p50_hours: percentile(sorted, 50),
        p95_hours: percentile(sorted, 95),
        std_dev: Math.round(stdDev(hours) * 10) / 10,
        count: hours.length,
        vs_overall: Math.round((mean(hours) - overallAvg) * 10) / 10,
      },
      confidence: hours.length > 50 ? 0.9 : 0.7,
      source: 'bootcamp_crossing_patterns',
      sample_size: hours.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    })
  }

  // Per month (seasonal)
  for (const [month, hours] of Object.entries(monthStats)) {
    const sorted = [...hours].sort((a, b) => a - b)
    patterns.push({
      pattern_type: 'crossing_analysis',
      pattern_key: `crossing:month:${month}`,
      pattern_value: {
        month: Number(month),
        avg_hours: Math.round(mean(hours) * 10) / 10,
        p50_hours: percentile(sorted, 50),
        count: hours.length,
        vs_overall: Math.round((mean(hours) - overallAvg) * 10) / 10,
      },
      confidence: hours.length > 100 ? 0.9 : 0.6,
      source: 'bootcamp_crossing_patterns',
      sample_size: hours.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    })
  }

  // Per carrier (top 20 by volume)
  const carrierEntries = Object.entries(carrierStats)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)

  for (const [carrier, hours] of carrierEntries) {
    const sorted = [...hours].sort((a, b) => a - b)
    patterns.push({
      pattern_type: 'crossing_analysis',
      pattern_key: `crossing:carrier:${carrier}`,
      pattern_value: {
        carrier,
        avg_hours: Math.round(mean(hours) * 10) / 10,
        p50_hours: percentile(sorted, 50),
        p95_hours: percentile(sorted, 95),
        std_dev: Math.round(stdDev(hours) * 10) / 10,
        count: hours.length,
        vs_overall: Math.round((mean(hours) - overallAvg) * 10) / 10,
      },
      confidence: hours.length > 30 ? 0.85 : 0.5,
      source: 'bootcamp_crossing_patterns',
      sample_size: hours.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    })
  }

  // Top 20 day × carrier cross-feature combos (by volume)
  const dcEntries = Object.entries(dayCarrier)
    .filter(([, hours]) => hours.length >= 10)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)

  for (const [key, hours] of dcEntries) {
    const [dow, carrier] = key.split(':')
    patterns.push({
      pattern_type: 'crossing_analysis',
      pattern_key: `crossing:day_carrier:${key}`,
      pattern_value: {
        day_of_week: Number(dow),
        day_name: DAY_NAMES[Number(dow)],
        carrier,
        avg_hours: Math.round(mean(hours) * 10) / 10,
        count: hours.length,
        vs_overall: Math.round((mean(hours) - overallAvg) * 10) / 10,
      },
      confidence: hours.length > 20 ? 0.8 : 0.5,
      source: 'bootcamp_crossing_patterns',
      sample_size: hours.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    })
  }

  // Year-over-year trend
  const ymEntries = Object.entries(yearMonthStats).sort((a, b) => a[0].localeCompare(b[0]))
  const ymTrend = ymEntries.map(([ym, hours]) => ({
    period: ym,
    avg_hours: Math.round(mean(hours) * 10) / 10,
    volume: hours.length,
  }))

  patterns.push({
    pattern_type: 'crossing_analysis',
    pattern_key: 'crossing:trend:monthly',
    pattern_value: { months: ymTrend },
    confidence: 0.9,
    source: 'bootcamp_crossing_patterns',
    sample_size: features.length,
    first_detected: new Date().toISOString(),
    last_confirmed: new Date().toISOString(),
    active: true,
  })

  console.log(`  Built ${patterns.length} patterns`)

  // ── Step 4: Build heatmap for network_intelligence ────────────────────
  console.log('\n🌐 Step 4: Building network intelligence heatmap...')

  const heatmapData = {}
  for (const [key, hours] of Object.entries(heatmap)) {
    heatmapData[key] = {
      avg_hours: Math.round(mean(hours) * 10) / 10,
      count: hours.length,
    }
  }

  const networkRows = [{
    metric_type: 'crossing_heatmap',
    metric_key: 'dow_hour_heatmap',
    metric_value: heatmapData,
    sample_size: features.length,
    computed_at: new Date().toISOString(),
  }]

  // ── Step 5: Upsert ────────────────────────────────────────────────────
  if (args.dryRun) {
    console.log('\n🏁 DRY RUN — would upsert:')
    console.log(`   ${patterns.length} rows to learned_patterns`)
    console.log(`   1 row to network_intelligence`)
    console.log(`\n   Overall: avg=${overallAvg.toFixed(1)}h, p50=${overallP50}h, p95=${overallP95}h`)
    console.log(`   Top carriers:`)
    carrierEntries.slice(0, 5).forEach(([c, h]) => {
      console.log(`     ${c}: avg=${mean(h).toFixed(1)}h (n=${h.length})`)
    })
  } else {
    console.log('\n💾 Step 5: Upserting...')
    const pUpserted = await upsertChunked(supabase, 'learned_patterns', patterns, 'pattern_type,pattern_key')
    console.log(`  learned_patterns: ${pUpserted} rows`)

    await upsertChunked(supabase, 'network_intelligence', networkRows, 'metric_type,metric_key')
    console.log(`  network_intelligence: 1 row (heatmap)`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    traficos_analyzed: totalFetched,
    valid_crossings: features.length,
    outliers_filtered: filtered,
    patterns_created: patterns.length,
    unique_carriers: Object.keys(carrierStats).length,
    overall_avg_hours: Math.round(overallAvg * 10) / 10,
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 3 complete in ${elapsed}s`)
  console.log(`   ${features.length.toLocaleString()} crossings → ${patterns.length} patterns`)
  console.log(`   Overall avg: ${overallAvg.toFixed(1)}h · P50: ${overallP50}h · P95: ${overallP95}h`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 3: Crossing Patterns</b>\n` +
      `${features.length.toLocaleString()} cruces → ${patterns.length} patrones\n` +
      `Avg: ${overallAvg.toFixed(1)}h · P50: ${overallP50}h · P95: ${overallP95}h\n` +
      `Carriers: ${Object.keys(carrierStats).length} · ${elapsed}s\n` +
      `— CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
