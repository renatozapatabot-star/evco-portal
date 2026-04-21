#!/usr/bin/env node
// ============================================================================
// CRUZ Clearance Sandbox Dashboard — terminal UI
// ============================================================================
// Displays accuracy metrics from sandbox runs.
// Reads from local JSON results (always available) and Supabase (when tables exist).
//
// Usage:
//   node scripts/sandbox/dashboard.js
//   node scripts/sandbox/dashboard.js --client=evco
//   node scripts/sandbox/dashboard.js --json
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const fs = require('fs')
const chalk = require('chalk')
const config = require('./sandbox-config.json')

// ── Flag parsing ────────────────────────────────────────────────────────────

function parseFlags() {
  const args = process.argv.slice(2)
  return {
    client: args.find(a => a.startsWith('--client='))?.split('=')[1] || process.env.DEFAULT_COMPANY_ID || 'evco',
    json: args.includes('--json'),
  }
}

// ── Load results from local JSON files ──────────────────────────────────────

function loadLocalResults() {
  const resultsBase = path.join(__dirname, 'results')
  if (!fs.existsSync(resultsBase)) return []

  const runDirs = fs.readdirSync(resultsBase)
    .filter(d => d.startsWith('sandbox-'))
    .sort()
    .reverse()

  const allResults = []
  for (const dir of runDirs) {
    const runDir = path.join(resultsBase, dir)
    const stat = fs.statSync(runDir)
    if (!stat.isDirectory()) continue

    const files = fs.readdirSync(runDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(runDir, file), 'utf8'))
        data._run_dir = dir
        data._run_date = dir.replace('sandbox-', '').substring(0, 10)
        allResults.push(data)
      } catch {}
    }
  }

  return allResults
}

// ── Aggregate results by run ────────────────────────────────────────────────

function aggregateByRun(results) {
  const runs = {}
  for (const r of results) {
    const key = r.run_id || r._run_dir
    if (!runs[key]) runs[key] = { run_id: key, date: r._run_date, results: [] }
    runs[key].results.push(r)
  }

  return Object.values(runs).map(run => {
    const total = run.results.length
    const passed = run.results.filter(r => r.pass).length
    const failed = total - passed
    const accuracy = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0
    const totalCost = run.results.reduce((s, r) => s + (r.cost_usd || 0), 0)
    return { ...run, total, passed, failed, accuracy, totalCost }
  }).sort((a, b) => b.run_id.localeCompare(a.run_id))
}

// ── Compute per-field accuracy ──────────────────────────────────────────────

function computeFieldAccuracy(results) {
  const fields = ['fraccion', 'valor', 'igi', 'dta', 'iva', 'total', 'tmec', 'tipo_cambio']
  const stats = {}

  for (const field of fields) {
    let matched = 0
    let total = 0
    for (const r of results) {
      const fs = r.field_scores?.[field]
      if (fs && !fs.incomplete) {
        total++
        if (fs.match) matched++
      }
    }
    stats[field] = { matched, total, accuracy: total > 0 ? Math.round((matched / total) * 10000) / 100 : null }
  }
  return stats
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags()

  const allResults = loadLocalResults()
  if (allResults.length === 0) {
    console.log(chalk.yellow('\nNo sandbox results found. Run: node scripts/sandbox/clearance-sandbox.js --run --all\n'))
    return
  }

  const runs = aggregateByRun(allResults)
  const latestRun = runs[0]
  const fieldAccuracy = computeFieldAccuracy(allResults)
  const latestFieldAccuracy = computeFieldAccuracy(latestRun.results)

  if (flags.json) {
    console.log(JSON.stringify({ runs, fieldAccuracy, latestFieldAccuracy }, null, 2))
    return
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const line = '═'.repeat(58)

  console.log()
  console.log(chalk.bold(`╔${line}╗`))
  console.log(chalk.bold(`║   CRUZ CLEARANCE SANDBOX — ACCURACY DASHBOARD            ║`))
  console.log(chalk.bold(`║   Patente 3596 · Aduana 240 · Nuevo Laredo               ║`))
  console.log(chalk.bold(`╠${line}╣`))

  // Latest run summary
  console.log(chalk.bold(`║  LATEST RUN: ${latestRun.run_id}`))
  const accColor = latestRun.accuracy >= config.streak_min_accuracy ? chalk.green : latestRun.accuracy >= 50 ? chalk.yellow : chalk.red
  console.log(`║  Accuracy:     ${accColor(`${latestRun.accuracy}%`)} (${latestRun.passed}/${latestRun.total} passed)`)
  console.log(`║  Failed:       ${latestRun.failed > 0 ? chalk.red(latestRun.failed.toString()) : chalk.green('0')}`)
  console.log(`║  Cost:         $${latestRun.totalCost.toFixed(4)} USD`)
  console.log(`║  Total runs:   ${runs.length} (${allResults.length} total facturas tested)`)
  console.log(chalk.bold(`╠${line}╣`))

  // Per-field accuracy table
  console.log(chalk.bold(`║  FIELD ACCURACY`))
  console.log(chalk.dim(`║  ${'Field'.padEnd(16)} ${'Latest'.padEnd(10)} ${'All-time'.padEnd(10)} ${'Target'.padEnd(10)}`))
  console.log(chalk.dim(`║  ${'─'.repeat(46)}`))

  const thresholds = config.accuracy_thresholds
  const metricsMap = [
    ['Fracción', 'fraccion', thresholds.fraccion_accuracy],
    ['Valor', 'valor', thresholds.valor_accuracy],
    ['IGI', 'igi', thresholds.igi_accuracy],
    ['DTA', 'dta', thresholds.dta_accuracy],
    ['IVA', 'iva', thresholds.iva_accuracy],
    ['Total', 'total', thresholds.total_accuracy],
    ['T-MEC', 'tmec', thresholds.tmec_detection_rate],
    ['Tipo cambio', 'tipo_cambio', null],
  ]

  const fmt = (val, tgt) => {
    if (val === null || val === undefined) return chalk.dim('—'.padEnd(8))
    const s = `${val}%`
    if (tgt && val >= tgt) return chalk.green(s.padEnd(8))
    if (tgt && val >= tgt - 5) return chalk.yellow(s.padEnd(8))
    return chalk.red(s.padEnd(8))
  }

  for (const [label, key, target] of metricsMap) {
    const latest = latestFieldAccuracy[key]?.accuracy
    const allTime = fieldAccuracy[key]?.accuracy
    const tgtStr = target ? `${target}%` : '—'
    console.log(`║  ${label.padEnd(16)} ${fmt(latest, target)}  ${fmt(allTime, target)}  ${tgtStr}`)
  }

  console.log(chalk.bold(`╠${line}╣`))

  // Run history
  console.log(chalk.bold(`║  RUN HISTORY (last ${Math.min(runs.length, 10)})`))
  console.log(chalk.dim(`║  ${'Run ID'.padEnd(28)} ${'Tests'.padEnd(7)} ${'Pass'.padEnd(7)} ${'Acc%'.padEnd(8)} ${'Cost'.padEnd(8)}`))
  console.log(chalk.dim(`║  ${'─'.repeat(54)}`))

  for (const run of runs.slice(0, 10)) {
    const rAccColor = run.accuracy >= config.streak_min_accuracy ? chalk.green : run.accuracy >= 50 ? chalk.yellow : chalk.red
    console.log(`║  ${run.run_id.padEnd(28)} ${String(run.total).padEnd(7)} ${String(run.passed).padEnd(7)} ${rAccColor((`${run.accuracy}%`).padEnd(8))} $${run.totalCost.toFixed(4)}`)
  }

  // Top failures from latest run
  const failures = latestRun.results.filter(r => !r.pass).sort((a, b) => (a.overall_score || 0) - (b.overall_score || 0))
  if (failures.length > 0) {
    console.log(chalk.bold(`╠${line}╣`))
    console.log(chalk.bold(`║  TOP FAILURES (latest run)`))
    for (const f of failures.slice(0, 8)) {
      const reasons = (f.failure_reasons || []).join(', ')
      const isCritical = reasons.includes('CRITICAL')
      const icon = isCritical ? chalk.red('!!') : chalk.yellow(' !')
      console.log(`║  ${icon} ${(f.referencia || '').padEnd(18)} score: ${String(f.overall_score || 0).padEnd(6)} ${chalk.dim(reasons)}`)
    }
    if (failures.length > 8) console.log(chalk.dim(`║  ... and ${failures.length - 8} more`))
  }

  // Pilot readiness
  console.log(chalk.bold(`╠${line}╣`))
  const ready = latestRun.accuracy >= config.streak_min_accuracy
  const readinessColor = ready ? chalk.green.bold : chalk.yellow.bold
  console.log(readinessColor(`║  PILOT READINESS: ${ready ? 'LISTO' : 'NOT YET'} · Need ${config.streak_target_days}-day streak ≥${config.streak_min_accuracy}%`))
  console.log(chalk.bold(`╚${line}╝`))
  console.log()
}

main().catch(err => {
  console.error(chalk.red(`Error: ${err.message}`))
  process.exit(1)
})
