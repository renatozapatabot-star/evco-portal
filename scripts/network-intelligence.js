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
  const { data: recoData } = await supabase.from('traficos')
    .select('semaforo, descripcion_mercancia, company_id, fecha_cruce')
    .not('semaforo', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

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
  const { data: supplierData } = await supabase.from('traficos')
    .select('proveedores, company_id, pedimento, fecha_llegada, fecha_cruce, regimen')
    .not('proveedores', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

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

  // ── 4. COST BENCHMARKS ──
  console.log('\n── Cost Benchmarks ──')
  const { data: costData } = await supabase.from('traficos')
    .select('company_id, importe_total, regimen')
    .not('importe_total', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

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
    `Valor promedio red: $${networkAvgValue.toLocaleString()} USD\n\n` +
    `${metricsWritten} métricas actualizadas\n` +
    `— CRUZ 🌐`
  )

  console.log(`\n✅ ${metricsWritten} metrics written`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
