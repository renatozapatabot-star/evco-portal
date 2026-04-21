#!/usr/bin/env node
// ============================================================================
// CRUZ Clearance Sandbox — Pilot Readiness Assessment
// ============================================================================
// Evaluates 5 gates before pilot shipment is authorized.
// Exits 0 if all pass, 1 otherwise.
//
// Usage:
//   node scripts/sandbox/pilot-readiness.js
//   node scripts/sandbox/pilot-readiness.js --client=evco
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk')
const config = require('./sandbox-config.json')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const companyId = process.argv.find(a => a.startsWith('--client='))?.split('=')[1] || process.env.DEFAULT_COMPANY_ID || 'evco'

// ── Gate 1: 30-day accuracy streak ──────────────────────────────────────────

async function gate1_streak() {
  const { data: daily } = await supabase
    .from('sandbox_daily_scores')
    .select('run_date, accuracy_pct, total_tests')
    .eq('company_id', companyId)
    .order('run_date', { ascending: false })
    .limit(90)

  if (!daily || daily.length === 0) return { pass: false, value: '0/30', detail: 'No data' }

  let streak = 0
  for (const day of daily) {
    if (parseFloat(day.accuracy_pct) >= config.streak_min_accuracy && day.total_tests >= 1) {
      streak++
    } else {
      break
    }
  }

  return {
    pass: streak >= config.streak_target_days,
    value: `${streak}/${config.streak_target_days}`,
    detail: streak >= config.streak_target_days ? 'Target met' : `${config.streak_target_days - streak} days remaining`,
  }
}

// ── Gate 2: Coverage (>= 200 traficos tested) ───────────────────────────────

async function gate2_coverage() {
  const { count } = await supabase
    .from('sandbox_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const target = 200
  return {
    pass: (count || 0) >= target,
    value: `${count || 0}`,
    detail: (count || 0) >= target ? 'Target met' : `Need ${target - (count || 0)} more`,
  }
}

// ── Gate 3: T-MEC detection 100% (zero false negatives) ─────────────────────

async function gate3_tmec() {
  // Count cases where actual_tmec=true but ghost_tmec=false (false negatives)
  const { count: falseNegatives } = await supabase
    .from('sandbox_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('actual_tmec', true)
    .eq('ghost_tmec', false)

  // Count total T-MEC cases
  const { count: totalTmec } = await supabase
    .from('sandbox_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('actual_tmec', true)

  const rate = totalTmec > 0 ? Math.round(((totalTmec - (falseNegatives || 0)) / totalTmec) * 10000) / 100 : null

  return {
    pass: (falseNegatives || 0) === 0,
    value: rate !== null ? `${rate}%` : 'N/A',
    detail: (falseNegatives || 0) === 0 ? 'Zero false negatives' : `${falseNegatives} false negative(s) — CRITICAL`,
  }
}

// ── Gate 4: Cost per pedimento <= $0.05 USD ─────────────────────────────────

async function gate4_cost() {
  const { data } = await supabase
    .from('sandbox_results')
    .select('ai_cost_usd')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!data || data.length === 0) return { pass: false, value: 'N/A', detail: 'No data' }

  const avg = data.reduce((sum, r) => sum + parseFloat(r.ai_cost_usd || 0), 0) / data.length
  const target = 0.05

  return {
    pass: avg <= target,
    value: `$${avg.toFixed(4)}`,
    detail: avg <= target ? `Below $${target} target` : `$${(avg - target).toFixed(4)} over target`,
  }
}

// ── Gate 5: Processing speed <= 10 seconds ──────────────────────────────────

async function gate5_speed() {
  const { data } = await supabase
    .from('sandbox_results')
    .select('latency_ms')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!data || data.length === 0) return { pass: false, value: 'N/A', detail: 'No data' }

  const avg = data.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / data.length
  const avgSec = avg / 1000
  const target = 10

  return {
    pass: avgSec <= target,
    value: `${avgSec.toFixed(1)}s`,
    detail: avgSec <= target ? `Below ${target}s target` : `${(avgSec - target).toFixed(1)}s over target`,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(chalk.bold('\nCRUZ Pilot Readiness Assessment'))
  console.log(chalk.dim(`  Patente 3596 · Company: ${companyId}`))
  console.log(chalk.dim(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`))

  const gates = [
    { name: 'Accuracy streak', fn: gate1_streak },
    { name: 'Coverage', fn: gate2_coverage },
    { name: 'T-MEC detection', fn: gate3_tmec },
    { name: 'Cost per draft', fn: gate4_cost },
    { name: 'Processing speed', fn: gate5_speed },
  ]

  const results = []
  let allPass = true

  const line = '─'.repeat(43)
  console.log(`┌${line}┐`)
  console.log(`│ ${chalk.bold('PILOT READINESS ASSESSMENT')}                │`)
  console.log(`│ Patente 3596 · CRUZ Sandbox               │`)
  console.log(`├${line}┤`)

  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i]
    const result = await gate.fn()
    results.push(result)

    if (!result.pass) allPass = false

    const icon = result.pass ? chalk.green('✅') : chalk.red('❌')
    const name = gate.name.padEnd(20)
    const value = result.value.padEnd(10)
    console.log(`│ GATE ${i + 1} ${name} ${icon} ${value} │`)
  }

  console.log(`├${line}┤`)

  if (allPass) {
    console.log(`│ STATUS: ${chalk.green.bold('✅ LISTO PARA PILOTO')}                  │`)
    console.log(`│ Recomendación: Proceder con               │`)
    console.log(`│ autorización de Tito                      │`)
  } else {
    console.log(`│ STATUS: ${chalk.yellow.bold('🟡 NO LISTO')}                            │`)
    console.log(`│                                           │`)
    for (let i = 0; i < results.length; i++) {
      if (!results[i].pass) {
        console.log(`│ ${chalk.dim(`Gate ${i + 1}: ${results[i].detail}`.padEnd(42))}│`)
      }
    }
  }

  console.log(`└${line}┘`)

  // Detail section
  console.log(chalk.dim('\nGate details:'))
  for (let i = 0; i < gates.length; i++) {
    const r = results[i]
    console.log(chalk.dim(`  Gate ${i + 1} (${gates[i].name}): ${r.value} — ${r.detail}`))
  }

  console.log()

  // Telegram on first all-pass (check if we've sent this before)
  if (allPass) {
    const { count } = await supabase
      .from('pipeline_log')
      .select('id', { count: 'exact', head: true })
      .eq('script', 'pilot-readiness-achieved')

    if ((count || 0) === 0) {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (token && process.env.TELEGRAM_SILENT !== 'true') {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: '-5085543275',
            text: `🏆 <b>PILOT READINESS ACHIEVED</b>\n\nAll 5 gates passed.\nCRUZ está listo para despacho automatizado.\nProceder con autorización de Tito.\n\n— CRUZ 🦀`,
            parse_mode: 'HTML',
          }),
        }).catch(() => {})
      }

      await supabase.from('pipeline_log').insert({
        script: 'pilot-readiness-achieved',
        status: 'success',
        input_summary: JSON.stringify(results),
        created_at: new Date().toISOString(),
      }).then(() => {}, () => {})
    }
  }

  process.exit(allPass ? 0 : 1)
}

main().catch(err => {
  console.error(chalk.red(`Error: ${err.message}`))
  process.exit(1)
})
