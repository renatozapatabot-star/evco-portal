#!/usr/bin/env node
/**
 * CRUZ Network Intelligence — patterns no single broker can see
 *
 * Aggregates across ALL clients (anonymized):
 * 1. Reconocimiento patterns by bridge + product + time
 * 2. Supplier network scores (2+ clients)
 * 3. Crossing intelligence (live from CRUZ crossings)
 * 4. Cost benchmarks per fracción
 *
 * Cron: 0 4 * * * (daily 4 AM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function main() {
  console.log(`🌐 Network Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  let metricsWritten = 0

  // ── 1. RECONOCIMIENTO PATTERNS ──
  console.log('\n── Reconocimiento Patterns ──')
  const recoData = await fetchAll(supabase.from('traficos')
    .select('semaforo, descripcion_mercancia, company_id, fecha_cruce')
    .not('semaforo', 'is', null)
    .gte('fecha_llegada', '2024-01-01'))

  const recoByCategory = {}
  for (const t of (recoData || [])) {
    const desc = (t.descripcion_mercancia || '').toLowerCase()
    let category = 'general'
    if (desc.includes('electr') || desc.includes('comput') || desc.includes('circuit')) category = 'electronics'
    else if (desc.includes('plast') || desc.includes('resin') || desc.includes('poli')) category = 'plastics'
    else if (desc.includes('metal') || desc.includes('acero') || desc.includes('alum')) category = 'metals'
    else if (desc.includes('quim') || desc.includes('chem')) category = 'chemicals'
    else if (desc.includes('auto') || desc.includes('vehic')) category = 'automotive'

    if (!recoByCategory[category]) recoByCategory[category] = { total: 0, rojo: 0 }
    recoByCategory[category].total++
    if (t.semaforo === 1) recoByCategory[category].rojo++
  }

  for (const [cat, stats] of Object.entries(recoByCategory)) {
    const rate = stats.total > 0 ? Math.round(stats.rojo / stats.total * 1000) / 10 : 0
    if (!DRY_RUN) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'reconocimiento_rate',
        metric_key: `reco:${cat}`,
        metric_value: { category: cat, rate, total: stats.total, rojo: stats.rojo },
        sample_size: stats.total,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
    }
    console.log(`  ${cat.padEnd(15)} ${rate}% reco (${stats.rojo}/${stats.total})`)
  }

  // ── 2. SUPPLIER NETWORK SCORES ──
  console.log('\n── Supplier Network Scores ──')
  const supplierData = await fetchAll(supabase.from('traficos')
    .select('proveedores, company_id, pedimento, fecha_llegada, fecha_cruce, regimen')
    .not('proveedores', 'is', null)
    .gte('fecha_llegada', '2024-01-01'))

  const supplierStats = {}
  for (const t of (supplierData || [])) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue

    if (!supplierStats[supplier]) {
      supplierStats[supplier] = { clients: new Set(), total: 0, withPed: 0, tmec: 0, dwellDays: [] }
    }
    const s = supplierStats[supplier]
    s.clients.add(t.company_id)
    s.total++
    if (t.pedimento) s.withPed++
    const reg = (t.regimen || '').toUpperCase()
    if (reg === 'ITE' || reg === 'ITR' || reg === 'IMD') s.tmec++
    if (t.fecha_llegada && t.fecha_cruce) {
      const d = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
      if (d >= 0 && d < 30) s.dwellDays.push(d)
    }
  }

  // Only score suppliers serving 2+ clients
  const networkSuppliers = Object.entries(supplierStats)
    .filter(([, s]) => s.clients.size >= 2)
    .map(([name, s]) => {
      const docRate = s.total > 0 ? Math.round(s.withPed / s.total * 100) : 0
      const tmecRate = s.total > 0 ? Math.round(s.tmec / s.total * 100) : 0
      const avgDwell = s.dwellDays.length > 0 ? Math.round(s.dwellDays.reduce((a, b) => a + b, 0) / s.dwellDays.length * 10) / 10 : 0
      const score = Math.round(docRate * 0.4 + tmecRate * 0.3 + Math.max(0, 100 - avgDwell * 10) * 0.3)
      return { name: name.substring(0, 40), clients: s.clients.size, total: s.total, docRate, tmecRate, avgDwell, score }
    })
    .sort((a, b) => b.score - a.score)

  for (const s of networkSuppliers.slice(0, 30)) {
    if (!DRY_RUN) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'supplier_network_score',
        metric_key: `supplier:${s.name.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}`,
        metric_value: s,
        sample_size: s.total,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
    }
    console.log(`  ${s.name.padEnd(30)} score: ${s.score} · ${s.clients} clients · ${s.total} ops · doc: ${s.docRate}%`)
  }

  // ── 3. CROSSING INTELLIGENCE ──
  console.log('\n── Crossing Intelligence ──')
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data: recentCrossings } = await supabase.from('traficos')
    .select('fecha_cruce, fecha_llegada')
    .not('fecha_cruce', 'is', null)
    .gte('fecha_cruce', threeDaysAgo)
    .limit(200)

  const crossings = (recentCrossings || []).map(t => {
    if (!t.fecha_llegada || !t.fecha_cruce) return null
    return (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
  }).filter(d => d !== null && d >= 0 && d < 30)

  const avgCrossing = crossings.length > 0 ? Math.round(crossings.reduce((a, b) => a + b, 0) / crossings.length * 10) / 10 : 0

  if (!DRY_RUN) {
    await supabase.from('network_intelligence').upsert({
      metric_type: 'crossing_live',
      metric_key: 'crossing:last_72h',
      metric_value: { count: crossings.length, avg_days: avgCrossing, period: '72h' },
      sample_size: crossings.length,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
    metricsWritten++
  }

  console.log(`  Last 72h: ${crossings.length} crossings · avg ${avgCrossing} days`)

  // ── 3b. CROSSING TIMES BY DAY OF WEEK ──
  console.log('\n── Crossing Times by Day ──')
  const crossingByDay = await fetchAll(supabase.from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .not('fecha_cruce', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', '2024-01-01'))

  const dayBuckets = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  for (const t of (crossingByDay || [])) {
    const hours = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (hours < 0 || hours > 720) continue // skip outliers (>30d)
    const day = new Date(t.fecha_cruce).getDay()
    dayBuckets[day].push(hours)
  }

  function percentile(arr, p) {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.ceil(sorted.length * p / 100) - 1
    return Math.round(sorted[Math.max(0, idx)] * 10) / 10
  }

  for (const [day, hours] of Object.entries(dayBuckets)) {
    if (hours.length < 3) continue
    const avg = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length * 10) / 10
    const p50 = percentile(hours, 50)
    const p95 = percentile(hours, 95)
    if (!DRY_RUN) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'crossing_by_day',
        metric_key: `crossing:day_${day}`,
        metric_value: { day: Number(day), day_name: dayNames[day], avg_hours: avg, p50_hours: p50, p95_hours: p95, sample: hours.length },
        sample_size: hours.length,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
    }
    console.log(`  ${dayNames[day].padEnd(12)} avg: ${avg}h · p50: ${p50}h · p95: ${p95}h (${hours.length} ops)`)
  }

  // ── 3c. RECONOCIMIENTO BY DAY ──
  console.log('\n── Reconocimiento by Day ──')
  const recoDayBuckets = { 0: { t: 0, r: 0 }, 1: { t: 0, r: 0 }, 2: { t: 0, r: 0 }, 3: { t: 0, r: 0 }, 4: { t: 0, r: 0 }, 5: { t: 0, r: 0 }, 6: { t: 0, r: 0 } }
  for (const t of (recoData || [])) {
    if (!t.fecha_cruce) continue
    const day = new Date(t.fecha_cruce).getDay()
    recoDayBuckets[day].t++
    if (t.semaforo === 1) recoDayBuckets[day].r++
  }

  for (const [day, stats] of Object.entries(recoDayBuckets)) {
    if (stats.t < 3) continue
    const rate = Math.round(stats.r / stats.t * 1000) / 10
    if (!DRY_RUN) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'reconocimiento_by_day',
        metric_key: `reco_day:${day}`,
        metric_value: { day: Number(day), day_name: dayNames[day], rate, total: stats.t, rojo: stats.r },
        sample_size: stats.t,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
    }
    console.log(`  ${dayNames[day].padEnd(12)} ${rate}% reco (${stats.r}/${stats.t})`)
  }

  // ── 4. COST BENCHMARKS ──
  console.log('\n── Cost Benchmarks ──')
  const costData = await fetchAll(supabase.from('traficos')
    .select('company_id, importe_total, regimen')
    .not('importe_total', 'is', null)
    .gte('fecha_llegada', '2024-01-01'))

  const allValues = (costData || []).map(t => Number(t.importe_total) || 0).filter(v => v > 0)
  const networkAvgValue = allValues.length > 0 ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : 0

  // Per-company benchmark
  const companyValues = {}
  for (const t of (costData || [])) {
    const v = Number(t.importe_total) || 0
    if (v <= 0) continue
    if (!companyValues[t.company_id]) companyValues[t.company_id] = []
    companyValues[t.company_id].push(v)
  }

  const companyBenchmarks = []
  for (const [cid, values] of Object.entries(companyValues)) {
    if (values.length < 5) continue
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    const deltaPct = networkAvgValue > 0 ? Math.round((avg - networkAvgValue) / networkAvgValue * 1000) / 10 : 0
    const percentile = Math.round(allValues.filter(v => v <= avg).length / allValues.length * 100)
    companyBenchmarks.push({ company_id: cid, avg, deltaPct, percentile, sample: values.length })
  }

  if (!DRY_RUN) {
    await supabase.from('network_intelligence').upsert({
      metric_type: 'cost_benchmark',
      metric_key: 'cost:fleet_average',
      metric_value: { avg_value: networkAvgValue, total_ops: allValues.length, companies: Object.keys(companyValues).length },
      sample_size: allValues.length,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
    metricsWritten++

    for (const cb of companyBenchmarks) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'cost_benchmark',
        metric_key: `cost:${cb.company_id}`,
        metric_value: cb,
        sample_size: cb.sample,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
    }
  }

  console.log(`  Fleet avg value: $${networkAvgValue.toLocaleString()} USD (${allValues.length} ops)`)
  console.log(`  ${companyBenchmarks.length} company benchmarks computed`)

  // ── 4b. COST BY FRACCION CATEGORY ──
  console.log('\n── Cost by Fracción Category ──')
  const partidaCost = await fetchAll(supabase.from('globalpc_partidas')
    .select('fraccion_arancelaria, fraccion, precio_unitario')
    .not('precio_unitario', 'is', null))

  const fraccionCosts = {}
  for (const p of (partidaCost || [])) {
    const frac = (p.fraccion_arancelaria || p.fraccion || '').split('.')[0] // chapter (first 4 digits)
    if (!frac || frac.length < 4) continue
    const chapter = frac.substring(0, 4)
    const val = Number(p.precio_unitario) || 0
    if (val <= 0) continue
    if (!fraccionCosts[chapter]) fraccionCosts[chapter] = []
    fraccionCosts[chapter].push(val)
  }

  let fraccionMetrics = 0
  for (const [chapter, values] of Object.entries(fraccionCosts)) {
    if (values.length < 5) continue
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100
    const p50 = percentile(values, 50)
    const p95 = percentile(values, 95)
    if (!DRY_RUN) {
      await supabase.from('network_intelligence').upsert({
        metric_type: 'cost_by_fraccion',
        metric_key: `cost_frac:${chapter}`,
        metric_value: { chapter, avg_usd: avg, p50_usd: p50, p95_usd: p95, sample: values.length },
        sample_size: values.length,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'metric_type,metric_key' }).catch(() => {})
      metricsWritten++
      fraccionMetrics++
    }
  }
  console.log(`  ${fraccionMetrics} fracción chapters benchmarked`)

  // ── Telegram summary ──
  await tg(
    `🌐 <b>Network Intelligence — Actualizado</b>\n\n` +
    `Reconocimiento:\n` +
    Object.entries(recoByCategory).slice(0, 3).map(([cat, s]) =>
      `  ${cat}: ${s.total > 0 ? Math.round(s.rojo / s.total * 100) : 0}% (${s.total} ops)`
    ).join('\n') + `\n\n` +
    `Proveedores red: ${networkSuppliers.length} (2+ clientes)\n` +
    `Top: ${networkSuppliers[0]?.name || '—'} (score ${networkSuppliers[0]?.score || 0})\n\n` +
    `Cruces últimas 72h: ${crossings.length} · avg ${avgCrossing}d\n` +
    `Crossing by day: ${Object.values(dayBuckets).filter(b => b.length >= 3).length} days computed\n` +
    `Fracción benchmarks: ${fraccionMetrics} chapters\n` +
    `Valor promedio red: $${networkAvgValue.toLocaleString()} USD\n\n` +
    `${metricsWritten} métricas actualizadas\n` +
    `— CRUZ 🌐`
  )

  console.log(`\n✅ ${metricsWritten} metrics written`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
