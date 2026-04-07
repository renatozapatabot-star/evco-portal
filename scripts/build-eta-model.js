#!/usr/bin/env node
/**
 * CRUZ — Build ETA Prediction Model
 *
 * Analyzes historical crossing times to build a prediction model.
 * Stores model coefficients in system_config for the API to use.
 *
 * Model: Predicts days-to-cross based on:
 *   - Day of week (0-6)
 *   - Month (1-12)
 *   - Regimen (A1, ITE, ITR, IMD)
 *   - Value bracket (low/med/high)
 *   - Client history (avg for this client)
 *
 * Usage:
 *   node scripts/build-eta-model.js              # Build + save
 *   node scripts/build-eta-model.js --dry-run     # Analyze only
 *
 * Cron: 0 3 * * 0  (Weekly Sunday 3 AM)
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const SCRIPT_NAME = 'build-eta-model'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🔮 ${prefix}CRUZ — Build ETA Prediction Model`)
  console.log('═'.repeat(55))

  // Get all completed traficos with both dates
  const traficos = await fetchAll(supabase
    .from('traficos')
    .select('trafico, company_id, fecha_llegada, fecha_cruce, regimen, importe_total')
    .not('fecha_llegada', 'is', null)
    .not('fecha_cruce', 'is', null)
    .gte('fecha_llegada', '2023-01-01'))

  if (traficos.length < 50) {
    console.log('   Not enough historical data:', traficos.length, 'traficos')
    return
  }

  console.log(`   Historical traficos with crossing data: ${traficos.length}`)

  // Calculate crossing days for each
  const samples = traficos.map(t => {
    const llegada = new Date(t.fecha_llegada)
    const cruce = new Date(t.fecha_cruce)
    const days = Math.max(0, Math.round((cruce.getTime() - llegada.getTime()) / 86400000))
    const dayOfWeek = llegada.getDay()
    const month = llegada.getMonth() + 1
    const regimen = (t.regimen || 'A1').toUpperCase()
    const value = Number(t.importe_total) || 0
    const valueBracket = value > 100000 ? 'high' : value > 10000 ? 'mid' : 'low'

    return { days, dayOfWeek, month, regimen, valueBracket, companyId: t.company_id }
  }).filter(s => s.days >= 0 && s.days <= 90) // Filter outliers

  console.log(`   Valid samples (0-90 days): ${samples.length}`)

  // Global averages
  const globalAvg = Math.round(samples.reduce((s, x) => s + x.days, 0) / samples.length * 10) / 10
  const globalMedian = samples.map(s => s.days).sort((a, b) => a - b)[Math.floor(samples.length / 2)]

  console.log(`   Global average: ${globalAvg} days`)
  console.log(`   Global median: ${globalMedian} days`)

  // By day of week
  const byDay = {}
  for (let d = 0; d < 7; d++) {
    const daySamples = samples.filter(s => s.dayOfWeek === d)
    byDay[d] = daySamples.length > 0 ? Math.round(daySamples.reduce((s, x) => s + x.days, 0) / daySamples.length * 10) / 10 : globalAvg
  }
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  console.log('\n   By day of arrival:')
  Object.entries(byDay).forEach(([d, avg]) => console.log(`     ${days[d]}: ${avg} days (${samples.filter(s => s.dayOfWeek == d).length} samples)`))

  // By regimen
  const byRegimen = {}
  for (const r of ['A1', 'ITE', 'ITR', 'IMD']) {
    const rSamples = samples.filter(s => s.regimen === r)
    byRegimen[r] = rSamples.length > 0 ? Math.round(rSamples.reduce((s, x) => s + x.days, 0) / rSamples.length * 10) / 10 : globalAvg
  }
  console.log('\n   By regimen:')
  Object.entries(byRegimen).forEach(([r, avg]) => console.log(`     ${r}: ${avg} days (${samples.filter(s => s.regimen === r).length} samples)`))

  // By value bracket
  const byValue = {}
  for (const v of ['low', 'mid', 'high']) {
    const vSamples = samples.filter(s => s.valueBracket === v)
    byValue[v] = vSamples.length > 0 ? Math.round(vSamples.reduce((s, x) => s + x.days, 0) / vSamples.length * 10) / 10 : globalAvg
  }
  console.log('\n   By value bracket:')
  Object.entries(byValue).forEach(([v, avg]) => console.log(`     ${v}: ${avg} days`))

  // By client
  const byClient = {}
  const clientIds = [...new Set(samples.map(s => s.companyId))]
  for (const c of clientIds) {
    const cSamples = samples.filter(s => s.companyId === c)
    if (cSamples.length >= 5) {
      byClient[c] = Math.round(cSamples.reduce((s, x) => s + x.days, 0) / cSamples.length * 10) / 10
    }
  }
  console.log(`\n   Clients with enough data: ${Object.keys(byClient).length}`)

  // Build model
  const model = {
    global_avg: globalAvg,
    global_median: globalMedian,
    by_day_of_week: byDay,
    by_regimen: byRegimen,
    by_value_bracket: byValue,
    by_client: byClient,
    samples: samples.length,
    built_at: new Date().toISOString(),
    confidence: samples.length > 500 ? 'high' : samples.length > 100 ? 'medium' : 'low',
  }

  // Percentile distribution
  const sorted = samples.map(s => s.days).sort((a, b) => a - b)
  model.percentiles = {
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
  }

  console.log('\n   Percentiles:', JSON.stringify(model.percentiles))

  // Save model
  if (!DRY_RUN) {
    await supabase.from('system_config').upsert({
      key: 'eta_model',
      value: model,
      valid_to: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], // 30 day validity
    }, { onConflict: 'key' })
    console.log('\n   ✅ Model saved to system_config')
  }

  console.log('\n' + '═'.repeat(55))
  console.log(`📊 ${prefix}MODEL SUMMARY`)
  console.log(`   Samples: ${samples.length}`)
  console.log(`   Global avg: ${globalAvg} days | Median: ${globalMedian} days`)
  console.log(`   Confidence: ${model.confidence}`)
  console.log(`   Range: ${model.percentiles.p10}-${model.percentiles.p90} days (10th-90th percentile)`)

  await sendTelegram(
    `🔮 <b>ETA MODEL BUILT</b>\n` +
    `${samples.length} samples · avg ${globalAvg}d · median ${globalMedian}d\n` +
    `Confidence: ${model.confidence}\n` +
    `Range: ${model.percentiles.p10}-${model.percentiles.p90} days\n` +
    `— CRUZ 🦀`
  )
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
