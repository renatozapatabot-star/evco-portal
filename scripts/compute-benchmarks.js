#!/usr/bin/env node

// ============================================================
// CRUZ Fleet Benchmarks — aggregate intelligence from 47+ clients
// Computes anonymized averages that no single client could get alone.
// This is the data moat.
// Cron: 0 4 * * 1 (Monday 4 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_DATE_FROM = '2024-01-01'
const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function saveBenchmark(metric, dimension, value, sampleSize, period) {
  if (DRY_RUN) return
  await supabase.from('benchmarks').insert({
    metric, dimension, value, sample_size: sampleSize, period,
  }).then(() => {}, () => {})
}

async function main() {
  console.log(`📊 CRUZ Fleet Benchmarks — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const period = new Date().toISOString().split('T')[0]

  // ── 1. Crossing times ──
  console.log('\n1. Crossing times...')
  const crossingData = await fetchAll(supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce, company_id')
    .not('fecha_cruce', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', PORTAL_DATE_FROM))

  const crossingDays = crossingData.map(t => {
    const d = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
    return { days: Math.max(0, d), company: t.company_id }
  }).filter(d => d.days > 0 && d.days < 60)

  if (crossingDays.length > 0) {
    const avgCrossing = Math.round(crossingDays.reduce((s, d) => s + d.days, 0) / crossingDays.length * 10) / 10
    console.log(`  Fleet avg crossing: ${avgCrossing} days (${crossingDays.length} samples)`)
    await saveBenchmark('avg_crossing_days', 'fleet', avgCrossing, crossingDays.length, period)

    // Per-client averages
    const byClient = {}
    for (const d of crossingDays) {
      if (!byClient[d.company]) byClient[d.company] = []
      byClient[d.company].push(d.days)
    }
    for (const [company, days] of Object.entries(byClient)) {
      const avg = Math.round(days.reduce((s, d) => s + d, 0) / days.length * 10) / 10
      await saveBenchmark('avg_crossing_days', company, avg, days.length, period)
    }
  }

  // ── 2. Pedimento processing time ──
  console.log('2. Pedimento processing...')
  const pedData = await fetchAll(supabase
    .from('traficos')
    .select('fecha_llegada, company_id, pedimento')
    .not('pedimento', 'is', null)
    .gte('fecha_llegada', PORTAL_DATE_FROM))

  const withPed = pedData.length
  const totalTrafs = crossingDays.length + pedData.filter(t => !t.fecha_cruce).length
  const pedRate = totalTrafs > 0 ? Math.round((withPed / Math.max(1, totalTrafs)) * 100) : 0
  console.log(`  Pedimento rate: ${pedRate}% (${withPed}/${totalTrafs})`)
  await saveBenchmark('pedimento_rate', 'fleet', pedRate, totalTrafs, period)

  // ── 3. T-MEC utilization ──
  console.log('3. T-MEC utilization...')
  const regimenData = await fetchAll(supabase
    .from('traficos')
    .select('regimen, company_id')
    .gte('fecha_llegada', PORTAL_DATE_FROM))

  const allRegs = regimenData
  const tmecRegs = allRegs.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  })
  const fleetTmecRate = allRegs.length > 0 ? Math.round((tmecRegs.length / allRegs.length) * 100) : 0
  console.log(`  Fleet T-MEC: ${fleetTmecRate}% (${tmecRegs.length}/${allRegs.length})`)
  await saveBenchmark('tmec_rate', 'fleet', fleetTmecRate, allRegs.length, period)

  // Per-client T-MEC
  const tmecByClient = {}
  for (const t of allRegs) {
    if (!tmecByClient[t.company_id]) tmecByClient[t.company_id] = { total: 0, tmec: 0 }
    tmecByClient[t.company_id].total++
    const r = (t.regimen || '').toUpperCase()
    if (r === 'ITE' || r === 'ITR' || r === 'IMD') tmecByClient[t.company_id].tmec++
  }
  for (const [company, data] of Object.entries(tmecByClient)) {
    const rate = Math.round((data.tmec / data.total) * 100)
    await saveBenchmark('tmec_rate', company, rate, data.total, period)
  }

  // ── 4. Document completeness ──
  console.log('4. Document completeness...')
  const docData = await fetchAll(supabase
    .from('traficos')
    .select('company_id, pedimento')
    .gte('fecha_llegada', PORTAL_DATE_FROM))

  const docByClient = {}
  for (const t of docData) {
    if (!docByClient[t.company_id]) docByClient[t.company_id] = { total: 0, complete: 0 }
    docByClient[t.company_id].total++
    if (t.pedimento) docByClient[t.company_id].complete++
  }

  let fleetDocTotal = 0, fleetDocComplete = 0
  for (const [company, data] of Object.entries(docByClient)) {
    fleetDocTotal += data.total
    fleetDocComplete += data.complete
    const rate = Math.round((data.complete / Math.max(1, data.total)) * 100)
    await saveBenchmark('doc_completeness', company, rate, data.total, period)
  }
  const fleetDocRate = fleetDocTotal > 0 ? Math.round((fleetDocComplete / fleetDocTotal) * 100) : 0
  await saveBenchmark('doc_completeness', 'fleet', fleetDocRate, fleetDocTotal, period)
  console.log(`  Fleet doc completeness: ${fleetDocRate}%`)

  // ── 5. Value per tráfico ──
  console.log('5. Value averages...')
  const valueData = await fetchAll(supabase
    .from('traficos')
    .select('importe_total, company_id')
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .not('importe_total', 'is', null))

  const values = valueData.filter(t => Number(t.importe_total) > 0)
  if (values.length > 0) {
    const fleetAvgValue = Math.round(values.reduce((s, t) => s + Number(t.importe_total), 0) / values.length)
    await saveBenchmark('avg_value_usd', 'fleet', fleetAvgValue, values.length, period)
    console.log(`  Fleet avg value: $${fleetAvgValue.toLocaleString()} USD`)

    const valByClient = {}
    for (const t of values) {
      if (!valByClient[t.company_id]) valByClient[t.company_id] = { sum: 0, count: 0 }
      valByClient[t.company_id].sum += Number(t.importe_total)
      valByClient[t.company_id].count++
    }
    for (const [company, data] of Object.entries(valByClient)) {
      await saveBenchmark('avg_value_usd', company, Math.round(data.sum / data.count), data.count, period)
    }
  }

  // ── Telegram summary ──
  const lines = [
    `📊 <b>Fleet Benchmarks — ${period}</b>`,
    ``,
    `🚢 Cruce promedio: <b>${crossingDays.length > 0 ? (crossingDays.reduce((s, d) => s + d.days, 0) / crossingDays.length).toFixed(1) : '—'} días</b> (${crossingDays.length} muestras)`,
    `📄 Pedimento rate: <b>${pedRate}%</b>`,
    `🛡️ T-MEC fleet: <b>${fleetTmecRate}%</b>`,
    `📋 Doc completeness: <b>${fleetDocRate}%</b>`,
    values.length > 0 ? `💰 Valor promedio: <b>$${Math.round(values.reduce((s, t) => s + Number(t.importe_total), 0) / values.length).toLocaleString()}</b> USD` : '',
    ``,
    `${Object.keys(tmecByClient).length} clientes analizados`,
    `— CRUZ 🦀`,
  ].filter(Boolean)

  await sendTelegram(lines.join('\n'))

  console.log(`\n✅ Benchmarks computed for ${Object.keys(tmecByClient).length} clients`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
