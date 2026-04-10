#!/usr/bin/env node
// ============================================================================
// CRUZ Clearance Sandbox — batch simulation runner
// ============================================================================
// Runs the ghost pedimento pipeline against aduanet_facturas (source of truth),
// compares CRUZ's output against what was actually filed, and tracks accuracy.
//
// Target: 99% accuracy for 30 consecutive days → pilot readiness.
//
// ARCHITECTURE: Queries aduanet_facturas directly (NOT traficos).
// aduanet_facturas has all financial data needed for comparison.
// traficos and aduanet_facturas do NOT share a direct join key.
//
// Usage:
//   node scripts/sandbox/clearance-sandbox.js --run           (last 200)
//   node scripts/sandbox/clearance-sandbox.js --run --all     (all with igi data)
//   node scripts/sandbox/clearance-sandbox.js --run --ref X   (single debug)
//   node scripts/sandbox/clearance-sandbox.js --cost-report
//   node scripts/sandbox/clearance-sandbox.js --export
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk')
const config = require('./sandbox-config.json')
const {
  runGhostForFactura,
  loadActualFromFactura,
  compareWithActual,
  scoreComparison,
} = require('../lib/ghost-pipeline')

const SCRIPT_NAME = 'clearance-sandbox'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Flag parsing ────────────────────────────────────────────────────────────

function parseFlags() {
  const args = process.argv.slice(2)
  return {
    run: args.includes('--run'),
    all: args.includes('--all'),
    ref: args.find(a => a.startsWith('--ref='))?.split('=').slice(1).join('=') || null,
    costReport: args.includes('--cost-report'),
    export: args.includes('--export'),
    client: args.find(a => a.startsWith('--client='))?.split('=')[1] || process.env.DEFAULT_COMPANY_ID || 'evco',
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10),
  }
}

// ── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!token) { console.log(chalk.dim('[TG skip]'), msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '-5085543275', text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Fetch test candidates from aduanet_facturas ─────────────────────────────

async function fetchCandidates(clientCode, flags) {
  // Single ref mode
  if (flags.ref) {
    const { data } = await supabase
      .from('aduanet_facturas')
      .select('*')
      .eq('referencia', flags.ref)
      .eq('company_id', clientCode)
      .maybeSingle()
    return data ? [data] : []
  }

  // Batch mode: query aduanet_facturas directly
  // Filter: igi IS NOT NULL and valor_usd > 0 (rows with real financial data)
  const limit = flags.limit || (flags.all ? 500 : 200)

  const { data: facturas, error } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('company_id', clientCode)
    .not('igi', 'is', null)
    .gt('valor_usd', 0)
    .order('fecha_pago', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Fetch candidates failed: ${error.message}`)
  return facturas || []
}

// ── Run batch ───────────────────────────────────────────────────────────────

async function runBatch(flags) {
  const clientCode = flags.client
  const runId = `sandbox-${new Date().toISOString().replace(/[:.]/g, '').substring(0, 15)}`
  const resultsDir = path.join(__dirname, 'results', runId)

  console.log(chalk.bold('\nCRUZ Clearance Sandbox'))
  console.log(chalk.dim(`  Run: ${runId}`))
  console.log(chalk.dim(`  Client: ${clientCode}`))
  console.log(chalk.dim(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`))

  // Fetch factura candidates
  const facturas = await fetchCandidates(clientCode, flags)
  if (facturas.length === 0) {
    console.log(chalk.yellow('No test candidates found. Need aduanet_facturas with igi IS NOT NULL and valor_usd > 0.'))
    await sendTelegram(`🟡 <b>Sandbox</b>: 0 facturas con datos financieros para ${clientCode}`)
    return
  }

  console.log(chalk.dim(`  ${facturas.length} facturas to test\n`))

  // Create results directory
  fs.mkdirSync(resultsDir, { recursive: true })

  let passed = 0
  let failed = 0
  let errors = 0
  let totalCost = 0
  let totalTokens = 0
  const failures = []

  for (let i = 0; i < facturas.length; i++) {
    const factura = facturas[i]
    const ref = factura.referencia
    const progress = `[${i + 1}/${facturas.length}]`

    try {
      // Run ghost pipeline directly on the factura row (no extra query)
      const ghost = await runGhostForFactura(factura, supabase, {
        useHistoricalRates: true,
      })

      // Extract actual data from the same factura row
      const actual = loadActualFromFactura(factura)

      // Compare
      const comparison = compareWithActual(ghost, actual)
      const scored = scoreComparison(comparison, config)

      // Save JSON
      const resultJson = {
        referencia: ref,
        clave_cliente: factura.clave_cliente,
        run_id: runId,
        ghost_fraccion: ghost.fraccion,
        actual_fraccion: actual.fraccion,
        ghost_total: ghost.total_contribuciones_mxn,
        actual_total: actual.total,
        ghost_tmec: ghost.tmec,
        actual_tmec: actual.tmec,
        overall_score: scored.overall_score,
        pass: scored.pass,
        failure_reasons: scored.failure_reasons,
        field_scores: scored.field_scores,
        cost_usd: ghost.cost_usd,
        latency_ms: ghost.latency_ms,
      }
      fs.writeFileSync(path.join(resultsDir, `${ref}.json`), JSON.stringify(resultJson, null, 2))

      // Save to Supabase (table may not exist yet — handle gracefully)
      supabase.from('clearance_sandbox_results').insert({
        run_id: runId,
        referencia: ref,
        company_id: clientCode,
        actual_fraccion: actual.fraccion,
        actual_valor_usd: actual.valor_usd,
        actual_igi: actual.igi,
        actual_dta: actual.dta,
        actual_iva: actual.iva,
        actual_total: actual.total,
        actual_tmec: actual.tmec,
        actual_tipo_cambio: actual.tipo_cambio,
        ghost_fraccion: ghost.fraccion,
        ghost_valor_usd: ghost.valor_usd,
        ghost_igi: ghost.igi_mxn,
        ghost_dta: ghost.dta_mxn,
        ghost_iva: ghost.iva_mxn,
        ghost_total: ghost.total_contribuciones_mxn,
        ghost_tmec: ghost.tmec,
        ghost_tipo_cambio: ghost.tipo_cambio,
        field_scores: scored.field_scores,
        overall_score: scored.overall_score,
        pass: scored.pass,
        failure_reasons: scored.failure_reasons,
        incomplete_fields: scored.incomplete_fields || [],
        mode: 'batch',
        ai_cost_usd: ghost.cost_usd,
        tokens_used: ghost.tokens_used,
        latency_ms: ghost.latency_ms,
      }).then(() => {}, () => {}) // fire and forget — table may not exist

      totalCost += ghost.cost_usd
      totalTokens += ghost.tokens_used

      if (scored.pass) {
        passed++
        process.stdout.write(chalk.green('.'))
      } else {
        failed++
        failures.push({ ref, reasons: scored.failure_reasons, score: scored.overall_score })
        process.stdout.write(chalk.red('x'))
      }

      // Cost guard
      if (totalCost > config.max_ai_cost_per_run_usd) {
        console.log(chalk.yellow(`\n  Cost limit reached ($${totalCost.toFixed(2)} > $${config.max_ai_cost_per_run_usd}). Stopping.`))
        break
      }

    } catch (err) {
      errors++
      process.stdout.write(chalk.yellow('?'))
      if (flags.ref) {
        // Single-ref mode: show full error
        console.error(chalk.red(`\n  ${progress} ${ref} ERROR: ${err.message}`))
        console.error(err.stack)
      }
    }
  }

  console.log() // newline after progress dots

  // Calculate summary
  const total = passed + failed
  const accuracy = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0

  // Print summary table
  const summaryLines = [
    '',
    chalk.bold('CRUZ Clearance Sandbox — Results'),
    chalk.dim('━'.repeat(50)),
    `  Facturas tested:   ${total} (${errors} errors, ${facturas.length - total - errors} skipped)`,
    `  Passed:            ${chalk.green(passed.toString())}`,
    `  Failed:            ${failed > 0 ? chalk.red(failed.toString()) : chalk.green('0')}`,
    `  Accuracy:          ${accuracy >= config.streak_min_accuracy ? chalk.green(`${accuracy}%`) : chalk.yellow(`${accuracy}%`)}`,
    `  Total cost:        $${totalCost.toFixed(4)} USD`,
    `  Total tokens:      ${totalTokens}`,
    `  Results dir:       ${resultsDir}`,
    chalk.dim('━'.repeat(50)),
  ]
  console.log(summaryLines.join('\n'))

  // Print failures
  if (failures.length > 0) {
    console.log(chalk.bold('\nTop failures:'))
    for (const f of failures.slice(0, 10)) {
      console.log(`  ${chalk.red('FAIL')} ${f.ref} — score: ${f.score} — ${f.reasons.join(', ')}`)
    }
    if (failures.length > 10) console.log(chalk.dim(`  ... and ${failures.length - 10} more`))
  }

  // Telegram summary
  const tgMsg = accuracy >= config.streak_min_accuracy
    ? `✅ <b>SANDBOX</b> — Precisión ${accuracy}% · ${total} facturas · $${totalCost.toFixed(4)} USD`
    : `🔴 <b>SANDBOX</b> — Precisión ${accuracy}% · ${failed} failures de ${total}`

  await sendTelegram(tgMsg)

  // Log to pipeline_log
  await supabase.from('pipeline_log').insert({
    script: SCRIPT_NAME,
    status: errors > 0 ? 'partial' : 'success',
    input_summary: JSON.stringify({ facturas: facturas.length, tested: total, passed, failed, accuracy }),
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {})
}

// ── Cost report ─────────────────────────────────────────────────────────────

async function costReport(clientCode) {
  const { data } = await supabase
    .from('clearance_sandbox_results')
    .select('ai_cost_usd, tokens_used, created_at')
    .eq('company_id', clientCode)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!data || data.length === 0) {
    console.log(chalk.yellow('No sandbox results found.'))
    return
  }

  const totalCost = data.reduce((sum, r) => sum + parseFloat(r.ai_cost_usd || 0), 0)
  const totalTokens = data.reduce((sum, r) => sum + (r.tokens_used || 0), 0)
  const avgCost = totalCost / data.length

  console.log(chalk.bold('\nCRUZ Sandbox Cost Report'))
  console.log(`  Total runs:     ${data.length}`)
  console.log(`  Total cost:     $${totalCost.toFixed(4)} USD`)
  console.log(`  Total tokens:   ${totalTokens.toLocaleString()}`)
  console.log(`  Avg cost/run:   $${avgCost.toFixed(6)} USD`)
  console.log(`  Gate 4 target:  $0.05 USD/run — ${avgCost <= 0.05 ? chalk.green('PASS') : chalk.red('FAIL')}`)
  console.log()
}

// ── Export to CSV ───────────────────────────────────────────────────────────

async function exportCSV(clientCode) {
  const { data } = await supabase
    .from('clearance_sandbox_results')
    .select('*')
    .eq('company_id', clientCode)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (!data || data.length === 0) {
    console.log(chalk.yellow('No results to export.'))
    return
  }

  const headers = [
    'run_id', 'referencia', 'overall_score', 'pass',
    'actual_fraccion', 'ghost_fraccion',
    'actual_total', 'ghost_total',
    'actual_tmec', 'ghost_tmec',
    'failure_reasons', 'ai_cost_usd', 'latency_ms', 'created_at',
  ]

  const csvLines = [headers.join(',')]
  for (const row of data) {
    csvLines.push(headers.map(h => {
      const val = row[h]
      if (Array.isArray(val)) return `"${val.join('; ')}"`
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return val ?? ''
    }).join(','))
  }

  const outPath = path.join(__dirname, 'results', `export-${clientCode}-${new Date().toISOString().substring(0, 10)}.csv`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, csvLines.join('\n'))
  console.log(chalk.green(`Exported ${data.length} rows to ${outPath}`))
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags()

  if (flags.costReport) return costReport(flags.client)
  if (flags.export) return exportCSV(flags.client)
  if (flags.run) return runBatch(flags)

  console.log(chalk.bold('CRUZ Clearance Sandbox'))
  console.log(chalk.dim('  --run               Run batch test'))
  console.log(chalk.dim('  --run --all         Test all historical'))
  console.log(chalk.dim('  --run --ref=X       Test single factura'))
  console.log(chalk.dim('  --cost-report       Show cost summary'))
  console.log(chalk.dim('  --export            Export CSV'))
  console.log(chalk.dim('  --client=X          Override company'))
}

main().catch(async (err) => {
  console.error(chalk.red(`\nFATAL: ${err.message}`))
  console.error(err.stack)
  try {
    await supabase.from('pipeline_log').insert({
      script: SCRIPT_NAME,
      status: 'failed',
      error_message: err.message,
      created_at: new Date().toISOString(),
    })
    await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  } catch {}
  process.exit(1)
})
