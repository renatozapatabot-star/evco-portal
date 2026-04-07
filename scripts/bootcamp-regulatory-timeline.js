#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 7 — Regulatory Timeline Builder
//
// Detects change-points in historical traficos data that indicate
// regulatory changes (rate shifts, volume drops, crossing time changes).
// Pure statistical analysis. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-regulatory-timeline.js              # full analysis
//   node scripts/bootcamp-regulatory-timeline.js --dry-run
//
// Cron: Quarterly (0 5 1 1,4,7,10 *)
// ============================================================================

const {
  initBootcamp, upsertChunked, saveCheckpoint, fatalHandler,
  mean, stdDev,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-regulatory-timeline'

// Known regulatory events (seed data — enriched by detected change-points)
const KNOWN_EVENTS = [
  { date: '2020-07-01', type: 'trade_agreement', title: 'T-MEC entra en vigor', description: 'Reemplaza TLCAN/NAFTA. Nuevas reglas de origen, requisitos laborales y medio ambiente.' },
  { date: '2020-03-18', type: 'operational', title: 'COVID-19: restricciones fronterizas', description: 'Cierre parcial de fronteras. Solo tráfico esencial.' },
  { date: '2020-06-01', type: 'operational', title: 'Reapertura gradual de fronteras', description: 'Retorno paulatino a operaciones normales en cruces internacionales.' },
  { date: '2018-12-01', type: 'political', title: 'Cambio de gobierno federal', description: 'Administración AMLO. Cambios en política comercial y aduanera.' },
  { date: '2024-10-01', type: 'political', title: 'Cambio de gobierno federal', description: 'Administración Sheinbaum. Continuidad con ajustes en política fiscal.' },
  { date: '2023-08-01', type: 'tariff_change', title: 'Decreto aranceles — sectores estratégicos', description: 'Incremento temporal de aranceles en acero, aluminio y sectores seleccionados.' },
  { date: '2025-04-03', type: 'tariff_change', title: 'US reciprocal tariffs announced', description: 'Trump administration announces 25% reciprocal tariffs on imports. USMCA-compliant goods exempt.' },
]

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 7: Regulatory Timeline Builder`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'FULL BATCH'}`)

  // ── Step 1: Fetch monthly aggregates from traficos ────────────────────
  console.log('\n📦 Step 1: Fetching traficos for monthly aggregation...')

  let offset = 0
  const batchSize = 5000
  const monthlyData = new Map() // "YYYY-MM" → { volume, values, crossingHours, semaforoVerde, semaforoTotal }

  while (true) {
    const { data, error } = await supabase
      .from('traficos')
      .select('fecha_llegada, fecha_cruce, importe_total, semaforo')
      .not('fecha_llegada', 'is', null)
      .range(offset, offset + batchSize - 1)

    if (error) throw new Error(`Fetch error: ${error.message}`)
    if (!data || data.length === 0) break

    for (const t of data) {
      const d = new Date(t.fecha_llegada)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData.has(ym)) {
        monthlyData.set(ym, { volume: 0, values: [], crossingHours: [], semaforoVerde: 0, semaforoTotal: 0 })
      }

      const entry = monthlyData.get(ym)
      entry.volume++

      const val = Number(t.importe_total) || 0
      if (val > 0) entry.values.push(val)

      if (t.fecha_cruce) {
        const hours = (new Date(t.fecha_cruce) - d) / 3600000
        if (hours >= 1 && hours <= 240) entry.crossingHours.push(hours)
      }

      if (t.semaforo) {
        entry.semaforoTotal++
        if (t.semaforo.toLowerCase().includes('verde')) entry.semaforoVerde++
      }
    }

    offset += batchSize
    process.stdout.write(`\r  Fetched: ${offset.toLocaleString()} traficos...`)
    if (data.length < batchSize) break
  }

  const months = [...monthlyData.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  console.log(`\r  ${months.length} months of data (${months[0]?.[0]} to ${months[months.length - 1]?.[0]}) ✓`)

  // ── Step 2: Compute monthly metrics ───────────────────────────────────
  console.log('\n📊 Step 2: Computing monthly metrics...')

  const metrics = months.map(([ym, data]) => ({
    period: ym,
    volume: data.volume,
    avg_value: data.values.length > 0 ? mean(data.values) : null,
    avg_crossing_hours: data.crossingHours.length > 0 ? mean(data.crossingHours) : null,
    reconocimiento_rate: data.semaforoTotal > 0
      ? (1 - data.semaforoVerde / data.semaforoTotal)
      : null,
  }))

  // ── Step 3: Change-point detection ────────────────────────────────────
  console.log('\n🔍 Step 3: Detecting change-points...')

  const detectedEvents = []
  const metricNames = ['volume', 'avg_value', 'avg_crossing_hours', 'reconocimiento_rate']

  for (const metricName of metricNames) {
    const values = metrics
      .map(m => ({ period: m.period, value: m[metricName] }))
      .filter(v => v.value !== null && v.value !== undefined)

    if (values.length < 6) continue

    // Compute month-over-month deltas
    const deltas = []
    for (let i = 1; i < values.length; i++) {
      const prev = values[i - 1].value
      const curr = values[i].value
      if (prev === 0) continue
      deltas.push({
        period: values[i].period,
        delta_pct: ((curr - prev) / Math.abs(prev)) * 100,
        prev_value: prev,
        curr_value: curr,
      })
    }

    if (deltas.length < 3) continue

    const deltaMean = mean(deltas.map(d => d.delta_pct))
    const deltaStdDev = stdDev(deltas.map(d => d.delta_pct))

    // Flag months with delta > 2 standard deviations from mean
    const threshold = deltaStdDev * 2
    const outliers = deltas.filter(d => Math.abs(d.delta_pct - deltaMean) > threshold)

    for (const outlier of outliers) {
      // Determine event type from metric
      let eventType = 'operational'
      if (metricName === 'avg_value') eventType = 'rate_change'
      if (metricName === 'reconocimiento_rate') eventType = 'enforcement_change'
      if (metricName === 'volume') eventType = 'volume_shift'

      const direction = outlier.delta_pct > 0 ? 'increase' : 'decrease'

      detectedEvents.push({
        event_date: `${outlier.period}-15`, // approximate mid-month
        event_type: eventType,
        title: `${metricName.replace(/_/g, ' ')} ${direction}: ${Math.abs(outlier.delta_pct).toFixed(1)}%`,
        description: `Detected ${Math.abs(outlier.delta_pct).toFixed(1)}% ${direction} in ${metricName.replace(/_/g, ' ')} from ${outlier.period}. Previous: ${outlier.prev_value?.toFixed?.(1) || outlier.prev_value}, Current: ${outlier.curr_value?.toFixed?.(1) || outlier.curr_value}.`,
        impact_metrics: {
          metric: metricName,
          delta_pct: Math.round(outlier.delta_pct * 10) / 10,
          prev_value: outlier.prev_value,
          curr_value: outlier.curr_value,
          threshold_std_devs: Math.round(Math.abs(outlier.delta_pct - deltaMean) / deltaStdDev * 10) / 10,
        },
        source: 'detected',
        confidence: Math.abs(outlier.delta_pct - deltaMean) / deltaStdDev > 3 ? 0.9 : 0.7,
      })
    }
  }

  // ── Step 4: Merge with known events ───────────────────────────────────
  console.log('\n🗓️ Step 4: Merging detected + known events...')

  const allEvents = [
    ...KNOWN_EVENTS.map(e => ({
      event_date: e.date,
      event_type: e.type,
      title: e.title,
      description: e.description,
      impact_metrics: null,
      source: 'known',
      confidence: 1.0,
    })),
    ...detectedEvents,
  ]

  // Deduplicate: if a detected event is within 30 days of a known event, enrich the known one
  const merged = []
  const usedDetected = new Set()

  for (const known of allEvents.filter(e => e.source === 'known')) {
    const knownDate = new Date(known.event_date).getTime()
    const nearby = detectedEvents.filter(d => {
      const detectedDate = new Date(d.event_date).getTime()
      return Math.abs(detectedDate - knownDate) < 30 * 86400000
    })

    if (nearby.length > 0) {
      // Enrich known event with detected impact metrics
      known.impact_metrics = nearby.reduce((acc, n) => {
        acc[n.impact_metrics.metric] = n.impact_metrics
        return acc
      }, {})
      nearby.forEach(n => usedDetected.add(JSON.stringify(n)))
    }

    merged.push(known)
  }

  // Add detected events not matched to known events
  for (const detected of detectedEvents) {
    if (!usedDetected.has(JSON.stringify(detected))) {
      merged.push(detected)
    }
  }

  // Sort by date
  merged.sort((a, b) => a.event_date.localeCompare(b.event_date))

  console.log(`  Known events: ${KNOWN_EVENTS.length}`)
  console.log(`  Detected change-points: ${detectedEvents.length}`)
  console.log(`  Merged total: ${merged.length}`)

  // ── Step 5: Upsert ────────────────────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n🏁 DRY RUN — would write ${merged.length} regulatory timeline events`)
    merged.forEach(e => {
      console.log(`  ${e.event_date} [${e.event_type}] ${e.title} (${e.source})`)
    })
  } else {
    console.log('\n💾 Step 5: Writing to regulatory_timeline...')

    // Clear and re-insert (timeline is small and fully recomputed)
    await supabase.from('regulatory_timeline').delete().neq('id', 0)

    const rows = merged.map(e => ({
      event_date: e.event_date,
      event_type: e.event_type,
      title: e.title,
      description: e.description,
      impact_metrics: e.impact_metrics,
      source: e.source,
      confidence: e.confidence,
    }))

    const { error: insertErr } = await supabase.from('regulatory_timeline').insert(rows)
    if (insertErr) throw new Error(`Insert regulatory_timeline: ${insertErr.message}`)
    console.log(`  Wrote ${rows.length} events`)

    // Also write trend to learned_patterns
    const trendPattern = {
      pattern_type: 'regulatory_intelligence',
      pattern_key: 'regulatory:timeline_summary',
      pattern_value: {
        total_events: merged.length,
        known_events: KNOWN_EVENTS.length,
        detected_events: detectedEvents.length,
        recent_events: merged.filter(e => e.event_date > '2024-01-01').length,
        event_types: merged.reduce((acc, e) => {
          acc[e.event_type] = (acc[e.event_type] || 0) + 1
          return acc
        }, {}),
      },
      confidence: 0.85,
      source: 'bootcamp_regulatory_timeline',
      sample_size: months.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    }

    await upsertChunked(supabase, 'learned_patterns', [trendPattern], 'pattern_type,pattern_key')
    console.log('  Wrote timeline summary to learned_patterns')
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    months_analyzed: months.length,
    known_events: KNOWN_EVENTS.length,
    detected_events: detectedEvents.length,
    total_events: merged.length,
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 7 complete in ${elapsed}s`)
  console.log(`   ${months.length} months analyzed → ${merged.length} regulatory events`)
  console.log(`   Known: ${KNOWN_EVENTS.length} · Detected: ${detectedEvents.length}`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 7: Regulatory Timeline</b>\n` +
      `${months.length} meses → ${merged.length} eventos regulatorios\n` +
      `Conocidos: ${KNOWN_EVENTS.length} · Detectados: ${detectedEvents.length}\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
