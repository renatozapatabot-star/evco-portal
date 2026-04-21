#!/usr/bin/env node
// ============================================================================
// CRUZ Ghost Pedimento Runner — CLI
// ============================================================================
// Simulates pedimento creation against real or historical data.
// Proves CRUZ can automate customs clearance before risking a real shipment.
//
// Usage:
//   node scripts/run-ghost.js --ref Y4503
//   node scripts/run-ghost.js --latest
//   node scripts/run-ghost.js --invoice /path/to/invoice.pdf
//   node scripts/run-ghost.js --sandbox       (historical rates, no Telegram)
//   node scripts/run-ghost.js --dry-run       (no DB writes, no Telegram)
//   node scripts/run-ghost.js --verbose       (full step timing)
//   node scripts/run-ghost.js --client evco   (override company)
//   node scripts/run-ghost.js --shadow        (dev Telegram only)
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk')
const {
  runGhostPipeline,
  runGhostForFactura,
  loadActualData,
  fetchLatestFactura,
  compareWithActual,
  scoreComparison,
} = require('./lib/ghost-pipeline')

const { llmCall } = require('./lib/llm')
const SCRIPT_NAME = 'run-ghost'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const TELEGRAM_DEV_CHAT = process.env.TELEGRAM_DEV_CHAT_ID || TELEGRAM_CHAT

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Flag parsing ────────────────────────────────────────────────────────────

function parseFlags() {
  const args = process.argv.slice(2)
  const flags = {
    ref: null,
    latest: false,
    invoice: null,
    sandbox: false,
    dryRun: false,
    verbose: false,
    client: process.env.DEFAULT_COMPANY_ID || 'evco',
    shadow: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--ref=')) flags.ref = arg.split('=').slice(1).join('=')
    else if (arg === '--ref' && args[args.indexOf(arg) + 1]) flags.ref = args[args.indexOf(arg) + 1]
    else if (arg === '--latest') flags.latest = true
    else if (arg.startsWith('--invoice=')) flags.invoice = arg.split('=').slice(1).join('=')
    else if (arg === '--sandbox') flags.sandbox = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg === '--verbose') flags.verbose = true
    else if (arg.startsWith('--client=')) flags.client = arg.split('=')[1]
    else if (arg === '--shadow') flags.shadow = true
  }

  return flags
}

// ── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(msg, chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!token) { console.log(chalk.dim('[TG skip]'), msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId || TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Format currency ─────────────────────────────────────────────────────────

function fmtMXN(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
}

function fmtUSD(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
}

// ── Resolve ref from --latest ───────────────────────────────────────────────

async function resolveLatestRef(clientCode) {
  // Query aduanet_facturas directly — source of truth for financial data
  const factura = await fetchLatestFactura(clientCode, supabase)
  return factura?.referencia || null
}

// ── Invoice extraction mode ─────────────────────────────────────────────────

async function extractFromInvoice(invoicePath) {
  const fs = require('fs')
  if (!fs.existsSync(invoicePath)) throw new Error(`Invoice file not found: ${invoicePath}`)

  const { PDFParse } = require('pdf-parse')
  const buf = fs.readFileSync(invoicePath)
  const parser = new PDFParse(new Uint8Array(buf))
  const result = await parser.getText()
  const text = (result.text || result || '').toString().trim()

  if (!text || text.length < 50) throw new Error('PDF extraction yielded insufficient text')

  // Sonnet extraction
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY required for invoice extraction')

  const llmResult = await llmCall({
    modelClass: 'smart',
    system: `Extract invoice data as JSON: { "invoice_number": string, "supplier_name": string, "supplier_country": string, "total_value": number, "currency": "USD"|"MXN"|"EUR", "incoterm": string|null, "products": [{ "description": string, "quantity": number, "unit": string, "unit_value": number, "total_value": number, "country_of_origin": string }] }`,
    messages: [{ role: 'user', content: text.substring(0, 12000) }],
    maxTokens: 2000,
    callerName: 'run-ghost',
  })

  const inputTokens = llmResult.tokensIn
  const outputTokens = llmResult.tokensOut

  // Cost tracking
  supabase.from('api_cost_log').insert({
    model: llmResult.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
    action: 'ghost_invoice_extraction',
    latency_ms: llmResult.durationMs,
  }).then(() => {}, () => {})

  const responseText = llmResult.text
  const match = responseText.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Sonnet extraction returned no JSON')

  return {
    extraction: JSON.parse(match[0]),
    tokens: { input: inputTokens, output: outputTokens },
    cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
  }
}

// ── Print ghost result ──────────────────────────────────────────────────────

function printGhostResult(result, flags, comparison) {
  const line = chalk.dim('━'.repeat(50))
  const dryLabel = flags.dryRun ? chalk.yellow(' — DRY RUN') : ''

  console.log()
  console.log(line)
  console.log(chalk.bold(`GHOST PEDIMENTO${dryLabel}`))
  console.log(line)

  console.log(`Referencia:    ${chalk.bold(result.referencia)}`)
  console.log(`Proveedor:     ${result.proveedor || chalk.dim('(desconocido)')}`)
  console.log(`Factura:       ${result.invoice_number || chalk.dim('(sin número)')} / ${result.currency}`)
  console.log(`Fracción:      ${chalk.cyan(result.fraccion || 'N/A')} (${result.classification_source || 'none'} — ${result.description?.substring(0, 40) || ''})`)
  console.log(`T-MEC:         ${result.tmec ? chalk.green('Aplicado') : chalk.dim('No aplica')} (régimen: ${result.regimen || 'N/A'})`)

  console.log(line)
  console.log(`Valor:         ${chalk.bold(fmtUSD(result.valor_usd))}`)
  console.log(`Tipo cambio:   $${result.tipo_cambio} MXN/USD`)
  console.log(`Valor aduana:  ${fmtMXN(result.valor_aduana_mxn)}`)
  console.log(`IGI (${(result.igi_rate * 100).toFixed(1)}%):    ${fmtMXN(result.igi_mxn)}`)
  console.log(`DTA (fixed):   ${fmtMXN(result.dta_mxn)}`)
  console.log(`IVA base:      ${fmtMXN(result.iva_base_mxn)}`)
  console.log(`IVA (${(result.iva_rate * 100).toFixed(0)}%):     ${fmtMXN(result.iva_mxn)}`)
  console.log(line)
  console.log(`TOTAL:         ${chalk.bold.green(fmtMXN(result.total_contribuciones_mxn))}`)
  console.log(line)

  const confColor = result.confianza === 'ALTA' ? chalk.green : result.confianza === 'MEDIA' ? chalk.yellow : chalk.red
  console.log(`Confianza:     ${confColor(result.confianza)} (${result.confianza_score}/100)`)
  console.log(`Flags:         ${result.flags.length > 0 ? chalk.yellow(result.flags.join(', ')) : chalk.green('ninguno')}`)
  console.log(`Tiempo:        ${(result.latency_ms / 1000).toFixed(1)}s`)
  console.log(`Tokens:        ${result.tokens_used}`)
  console.log(`Costo est:     $${result.cost_usd.toFixed(4)} USD`)

  if (flags.dryRun) {
    console.log(line)
    console.log(chalk.yellow('[DRY RUN — nada guardado]'))
  }

  // Comparison output (sandbox/shadow mode)
  if (comparison) {
    const scored = scoreComparison(comparison)
    console.log()
    console.log(line)
    console.log(chalk.bold('COMPARACIÓN vs PEDIMENTO REAL'))
    console.log(line)

    for (const [field, val] of Object.entries(comparison.fields)) {
      if (val.incomplete) {
        console.log(`  ${field.padEnd(14)} ${chalk.dim('N/A (sin datos reales)')}`)
      } else if (val.match) {
        console.log(`  ${field.padEnd(14)} ${chalk.green('MATCH')} ${val.ghost} = ${val.actual}`)
      } else {
        const detail = val.delta_pct !== undefined ? ` (${val.delta_pct}% diff)` : ''
        console.log(`  ${field.padEnd(14)} ${chalk.red('DIFF')}  ghost=${val.ghost} actual=${val.actual}${detail}`)
      }
    }

    console.log(line)
    const scoreColor = scored.pass ? chalk.green : chalk.red
    console.log(`Score:         ${scoreColor(`${scored.overall_score}/100`)} ${scored.pass ? 'PASS' : 'FAIL'}`)
    if (scored.failure_reasons.length > 0) {
      console.log(`Razones:       ${chalk.yellow(scored.failure_reasons.join(', '))}`)
    }
  }

  if (flags.verbose) {
    console.log()
    console.log(chalk.dim('Validation checks:'))
    for (const c of result.validation.checks) {
      console.log(`  ${c.ok ? chalk.green('PASS') : chalk.red('FAIL')} ${c.message}`)
    }
  }

  console.log()
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags()
  const startTime = Date.now()

  console.log(chalk.bold('\nCRUZ Ghost Pedimento Runner'))
  console.log(chalk.dim(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`))
  console.log(chalk.dim(`  Patente 3596 · Aduana 240\n`))

  // Resolve reference
  let ref = flags.ref
  if (flags.latest) {
    ref = await resolveLatestRef(flags.client)
    if (!ref) {
      console.error(chalk.red('No tráficos found for --latest'))
      process.exit(1)
    }
    console.log(chalk.dim(`  --latest resolved to: ${ref}`))
  }

  if (flags.invoice) {
    // Invoice extraction mode
    console.log(chalk.dim(`  Extracting invoice: ${flags.invoice}`))
    const { extraction } = await extractFromInvoice(flags.invoice)
    console.log(chalk.green('  Extraction complete:'))
    console.log(`    Supplier: ${extraction.supplier_name}`)
    console.log(`    Value: ${extraction.total_value} ${extraction.currency}`)
    console.log(`    Products: ${extraction.products?.length || 0}`)
    // For invoice mode without --ref, we can't run the full pipeline against a trafico
    if (!ref) {
      console.log(chalk.yellow('\n  No --ref provided. Showing extraction only.'))
      console.log(chalk.dim('  Use --ref to compare against a specific trafico.\n'))
      return
    }
  }

  if (!ref) {
    console.log(chalk.red('Error: provide --ref=XXXX, --latest, or --invoice=/path'))
    console.log(chalk.dim('  node scripts/run-ghost.js --ref Y4503'))
    console.log(chalk.dim('  node scripts/run-ghost.js --latest'))
    console.log(chalk.dim('  node scripts/run-ghost.js --latest --sandbox --verbose'))
    process.exit(1)
  }

  // Run ghost pipeline
  const result = await runGhostPipeline(ref, supabase, {
    companyId: flags.client,
    useHistoricalRates: flags.sandbox || flags.shadow,
  })

  // Compare against actual if sandbox/shadow mode
  let comparison = null
  if (flags.sandbox || flags.shadow) {
    const actual = await loadActualData(ref, flags.client, supabase)
    if (actual) {
      comparison = compareWithActual(result, actual)
    } else {
      console.log(chalk.yellow('  No actual data found for comparison'))
    }
  }

  // Print result
  printGhostResult(result, flags, comparison)

  // Save to DB (unless dry-run)
  if (!flags.dryRun && comparison) {
    const scored = scoreComparison(comparison)
    const { error } = await supabase.from('clearance_sandbox_results').insert({
      run_id: `ghost-${new Date().toISOString().replace(/[:.]/g, '').substring(0, 15)}`,
      referencia: ref,
      company_id: flags.client,
      actual_fraccion: comparison.fields.fraccion?.actual,
      actual_valor_usd: comparison.fields.valor?.actual,
      actual_igi: comparison.fields.igi?.actual,
      actual_dta: comparison.fields.dta?.actual,
      actual_iva: comparison.fields.iva?.actual,
      actual_total: comparison.fields.total?.actual,
      actual_tmec: comparison.fields.tmec?.actual,
      actual_tipo_cambio: comparison.fields.tipo_cambio?.actual,
      ghost_fraccion: result.fraccion,
      ghost_valor_usd: result.valor_usd,
      ghost_igi: result.igi_mxn,
      ghost_dta: result.dta_mxn,
      ghost_iva: result.iva_mxn,
      ghost_total: result.total_contribuciones_mxn,
      ghost_tmec: result.tmec,
      ghost_tipo_cambio: result.tipo_cambio,
      field_scores: scored.field_scores,
      overall_score: scored.overall_score,
      pass: scored.pass,
      failure_reasons: scored.failure_reasons,
      incomplete_fields: scored.incomplete_fields,
      mode: 'single',
      ai_cost_usd: result.cost_usd,
      tokens_used: result.tokens_used,
      latency_ms: result.latency_ms,
    })

    if (error) console.error(chalk.red(`DB save error: ${error.message}`))
    else console.log(chalk.green('Result saved to clearance_sandbox_results'))
  }

  // Telegram (unless dry-run or sandbox)
  if (!flags.dryRun && !flags.sandbox) {
    const chatId = flags.shadow ? TELEGRAM_DEV_CHAT : TELEGRAM_CHAT
    const confEmoji = result.confianza === 'ALTA' ? '🟢' : result.confianza === 'MEDIA' ? '🟡' : '🔴'
    const msg = `${confEmoji} <b>Ghost Pedimento</b>\n` +
      `Ref: ${result.referencia}\n` +
      `Fracción: ${result.fraccion || 'N/A'}\n` +
      `Total: ${fmtMXN(result.total_contribuciones_mxn)}\n` +
      `Confianza: ${result.confianza} (${result.confianza_score}/100)\n` +
      `${result.flags.length > 0 ? `Flags: ${result.flags.join(', ')}\n` : ''}` +
      `Tiempo: ${(result.latency_ms / 1000).toFixed(1)}s · Costo: $${result.cost_usd.toFixed(4)} USD`

    await sendTelegram(msg, chatId)
  }
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
