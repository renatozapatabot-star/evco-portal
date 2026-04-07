#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 6 — Anomaly Pattern Library
//
// Mines anomaly_log for recurring patterns, periodicity, and auto-resolution.
// Builds pattern signatures so the anomaly detector starts smart on day 1.
// Pure aggregation. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-anomaly-library.js              # full batch
//   node scripts/bootcamp-anomaly-library.js --dry-run
//
// Cron: 0 5 1-7 * 0  (first Sunday of month, 5 AM)
// ============================================================================

const {
  initBootcamp, upsertChunked, saveCheckpoint, fatalHandler,
  mean, stdDev,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-anomaly-library'

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 6: Anomaly Pattern Library`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'FULL BATCH'}`)

  // ── Step 1: Fetch all anomaly_log entries ─────────────────────────────
  console.log('\n📦 Step 1: Fetching anomaly_log...')

  const { data: anomalies, error } = await supabase
    .from('anomaly_log')
    .select('*')
    .order('check_date', { ascending: true })

  if (error) throw new Error(`Fetch anomaly_log: ${error.message}`)
  if (!anomalies || anomalies.length === 0) {
    console.log('  No anomaly data found. Run anomaly-detector.js first.')
    return
  }

  console.log(`  Found ${anomalies.length.toLocaleString()} anomaly entries`)

  // ── Step 2: Group by client × metric ──────────────────────────────────
  console.log('\n🔍 Step 2: Grouping by client × metric...')

  const groups = new Map() // "client|metric" → [entries]

  for (const a of anomalies) {
    const key = `${a.client || 'unknown'}|${a.metric}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(a)
  }

  console.log(`  Groups: ${groups.size}`)

  // ── Step 3: Analyze patterns ──────────────────────────────────────────
  console.log('\n📊 Step 3: Analyzing patterns...')

  const patterns = []

  for (const [key, entries] of groups) {
    const [client, metric] = key.split('|')

    // Count by severity
    const severityCounts = { ok: 0, warning: 0, critical: 0 }
    for (const e of entries) {
      severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1
    }

    const warningRate = (severityCounts.warning + severityCounts.critical) / entries.length
    if (warningRate < 0.05 && entries.length < 10) continue // skip boring groups

    // Detect periodicity — look for repeating patterns
    const warningDates = entries
      .filter(e => e.severity !== 'ok')
      .map(e => new Date(e.check_date).getTime())
      .sort((a, b) => a - b)

    let periodicity = null
    if (warningDates.length >= 3) {
      const gaps = []
      for (let i = 1; i < warningDates.length; i++) {
        gaps.push((warningDates[i] - warningDates[i - 1]) / 86400000) // days
      }
      const avgGap = mean(gaps)
      const gapStdDev = stdDev(gaps)

      if (gapStdDev < avgGap * 0.5 && avgGap > 0) {
        // Relatively regular interval
        if (avgGap >= 25 && avgGap <= 35) periodicity = 'monthly'
        else if (avgGap >= 5 && avgGap <= 9) periodicity = 'weekly'
        else if (avgGap >= 80 && avgGap <= 100) periodicity = 'quarterly'
        else periodicity = `~${Math.round(avgGap)}d`
      }
    }

    // Auto-resolution: do warnings self-resolve?
    let autoResolves = false
    let avgResolutionDays = null
    const warningRuns = []
    let currentRun = null

    for (const e of entries) {
      if (e.severity !== 'ok') {
        if (!currentRun) currentRun = { start: e.check_date, entries: [] }
        currentRun.entries.push(e)
      } else if (currentRun) {
        currentRun.end = e.check_date
        warningRuns.push(currentRun)
        currentRun = null
      }
    }

    if (warningRuns.length > 0) {
      const resolutionDays = warningRuns
        .filter(r => r.end)
        .map(r => (new Date(r.end) - new Date(r.start)) / 86400000)

      if (resolutionDays.length > 0) {
        avgResolutionDays = Math.round(mean(resolutionDays) * 10) / 10
        autoResolves = resolutionDays.filter(d => d <= 3).length > resolutionDays.length * 0.7
      }
    }

    // Delta analysis
    const deltas = entries
      .filter(e => e.delta_pct !== null && e.delta_pct !== undefined)
      .map(e => Number(e.delta_pct))

    const avgDelta = deltas.length > 0 ? mean(deltas) : null
    const maxDelta = deltas.length > 0 ? Math.max(...deltas.map(Math.abs)) : null

    patterns.push({
      pattern_type: 'anomaly_signature',
      pattern_key: `anomaly:${client}:${metric}`,
      pattern_value: {
        client,
        metric,
        total_observations: entries.length,
        severity_distribution: severityCounts,
        warning_rate: Math.round(warningRate * 100),
        periodicity,
        auto_resolves: autoResolves,
        avg_resolution_days: avgResolutionDays,
        avg_delta_pct: avgDelta ? Math.round(avgDelta * 10) / 10 : null,
        max_delta_pct: maxDelta ? Math.round(maxDelta * 10) / 10 : null,
        last_warning: warningDates.length > 0
          ? new Date(warningDates[warningDates.length - 1]).toISOString().split('T')[0]
          : null,
        trigger_conditions: {
          typical_delta: avgDelta ? `>${Math.abs(avgDelta).toFixed(1)}%` : 'unknown',
          typical_severity: severityCounts.critical > severityCounts.warning ? 'critical' : 'warning',
        },
        recommendation: autoResolves
          ? 'Monitor only — typically self-resolves within ' + (avgResolutionDays || '?') + ' days'
          : warningRate > 0.3
            ? 'Investigate — frequent anomaly pattern, requires intervention'
            : 'Low risk — occasional fluctuation',
      },
      confidence: entries.length > 20 ? 0.9 : entries.length > 5 ? 0.7 : 0.4,
      source: 'bootcamp_anomaly_library',
      sample_size: entries.length,
      first_detected: new Date().toISOString(),
      last_confirmed: new Date().toISOString(),
      active: true,
    })
  }

  // Sort by warning rate descending
  patterns.sort((a, b) => b.pattern_value.warning_rate - a.pattern_value.warning_rate)

  console.log(`  Patterns built: ${patterns.length}`)
  console.log(`  Top concerns:`)
  patterns.slice(0, 5).forEach(p => {
    const v = p.pattern_value
    console.log(`    ${v.client}/${v.metric}: ${v.warning_rate}% warning rate, periodicity=${v.periodicity || 'none'}, auto-resolves=${v.auto_resolves}`)
  })

  // ── Step 4: Upsert ────────────────────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n🏁 DRY RUN — would write ${patterns.length} anomaly signatures`)
  } else {
    console.log('\n💾 Step 4: Writing to learned_patterns...')
    const upserted = await upsertChunked(supabase, 'learned_patterns', patterns, 'pattern_type,pattern_key')
    console.log(`  Upserted: ${upserted} anomaly signatures`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    anomaly_entries: anomalies.length,
    patterns_created: patterns.length,
    high_risk: patterns.filter(p => p.pattern_value.warning_rate > 30).length,
    auto_resolving: patterns.filter(p => p.pattern_value.auto_resolves).length,
    elapsed_s: elapsed,
  }

  console.log(`\n✅ Bootcamp 6 complete in ${elapsed}s`)
  console.log(`   ${anomalies.length} anomalies → ${patterns.length} signatures`)
  console.log(`   High risk: ${summary.high_risk} · Auto-resolving: ${summary.auto_resolving}`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 6: Anomaly Library</b>\n` +
      `${anomalies.length} anomalías → ${patterns.length} firmas\n` +
      `Alto riesgo: ${summary.high_risk} · Auto-resuelven: ${summary.auto_resolving}\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
