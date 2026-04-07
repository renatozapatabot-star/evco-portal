#!/usr/bin/env node

// ============================================================
// CRUZ Demand Forecast — predict next 30 days from historical patterns
// Analyzes 12 months of tráfico data per client.
// Run: node scripts/demand-forecast.js [--dry-run]
// Cron: 0 5 * * 1 (Monday 5 AM — weekly)
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
const TELEGRAM_CHAT = '-5085543275'

const CLIENTS = [
  { name: 'EVCO', company_id: 'evco', active: true },
  { name: 'MAFESA', company_id: 'mafesa', active: true },
]

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

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

async function forecastClient(client) {
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]

  const traficos = await fetchAll(supabase
    .from('traficos')
    .select('trafico, fecha_llegada, importe_total, estatus, descripcion_mercancia, proveedores')
    .eq('company_id', client.company_id)
    .gte('fecha_llegada', yearAgo)
    .order('fecha_llegada', { ascending: true }))

  const rows = traficos
  if (rows.length < 10) return null

  // Group by month
  const monthlyData = {}
  for (const t of rows) {
    const month = (t.fecha_llegada || '').substring(0, 7) // YYYY-MM
    if (!month) continue
    if (!monthlyData[month]) monthlyData[month] = { count: 0, value: 0 }
    monthlyData[month].count++
    monthlyData[month].value += Number(t.importe_total) || 0
  }

  const months = Object.keys(monthlyData).sort()
  if (months.length < 3) return null

  const counts = months.map(m => monthlyData[m].count)
  const values = months.map(m => monthlyData[m].value)

  // Simple moving average (last 3 months) for prediction
  const recentCounts = counts.slice(-3)
  const recentValues = values.slice(-3)
  const avgCount = Math.round(recentCounts.reduce((s, v) => s + v, 0) / recentCounts.length)
  const avgValue = Math.round(recentValues.reduce((s, v) => s + v, 0) / recentValues.length)

  // Confidence interval (±1 std dev of recent months)
  const countStd = Math.round(Math.sqrt(recentCounts.reduce((s, v) => s + Math.pow(v - avgCount, 2), 0) / recentCounts.length))
  const valueStd = Math.round(Math.sqrt(recentValues.reduce((s, v) => s + Math.pow(v - avgValue, 2), 0) / recentValues.length))

  // Trend: compare last 3 months avg vs prior 3 months
  const priorCounts = counts.slice(-6, -3)
  const priorAvg = priorCounts.length > 0 ? priorCounts.reduce((s, v) => s + v, 0) / priorCounts.length : avgCount
  const trendPct = priorAvg > 0 ? Math.round(((avgCount - priorAvg) / priorAvg) * 100) : 0

  // Top suppliers by recent volume
  const supplierMap = {}
  const recent3m = rows.filter(t => {
    const d = (t.fecha_llegada || '').substring(0, 7)
    return months.slice(-3).includes(d)
  })
  for (const t of recent3m) {
    const provs = (t.proveedores || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const p of provs) {
      supplierMap[p] = (supplierMap[p] || 0) + 1
    }
  }
  const topSuppliers = Object.entries(supplierMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))

  return {
    company_id: client.company_id,
    company_name: client.name,
    period: '30 días',
    historical_months: months.length,
    monthly_counts: months.map(m => ({ month: m, count: monthlyData[m].count, value: monthlyData[m].value })),
    forecast: {
      expected_traficos: avgCount,
      expected_value_usd: avgValue,
      confidence_low: Math.max(0, avgCount - countStd),
      confidence_high: avgCount + countStd,
      value_low: Math.max(0, avgValue - valueStd),
      value_high: avgValue + valueStd,
      trend_pct: trendPct,
      trend_direction: trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'stable',
    },
    top_suppliers: topSuppliers,
    generated_at: new Date().toISOString(),
  }
}

async function main() {
  console.log(`📈 CRUZ Demand Forecast — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const forecasts = []

  for (const client of CLIENTS.filter(c => c.active)) {
    console.log(`  ${client.name}...`)
    const forecast = await forecastClient(client)
    if (!forecast) {
      console.log(`    ⚠️ Insufficient data (<10 tráficos in 12 months)`)
      continue
    }
    forecasts.push(forecast)
    const f = forecast.forecast
    console.log(`    ✅ ${f.expected_traficos} tráficos (${f.confidence_low}-${f.confidence_high}) · ${fmtUSD(f.expected_value_usd)}`)
  }

  if (!DRY_RUN && forecasts.length > 0) {
    // Save to Supabase
    for (const f of forecasts) {
      await supabase.from('demand_forecasts').upsert({
        company_id: f.company_id,
        forecast_date: new Date().toISOString().split('T')[0],
        forecast_data: f,
      }, { onConflict: 'company_id,forecast_date' }).then(() => {}, () => {})
    }
  }

  // Telegram digest
  if (forecasts.length > 0) {
    const lines = [`📈 <b>Pronóstico Semanal</b>`, ``]
    for (const fc of forecasts) {
      const f = fc.forecast
      const arrow = f.trend_direction === 'up' ? '↑' : f.trend_direction === 'down' ? '↓' : '→'
      lines.push(`<b>${fc.company_name}</b>`)
      lines.push(`  ~${f.expected_traficos} tráficos (${f.confidence_low}-${f.confidence_high})`)
      lines.push(`  ~${fmtUSD(f.expected_value_usd)} USD`)
      lines.push(`  Tendencia: ${arrow} ${Math.abs(f.trend_pct)}% vs trimestre anterior`)
      if (fc.top_suppliers.length > 0) {
        lines.push(`  Top: ${fc.top_suppliers.map(s => s.name.substring(0, 20)).join(', ')}`)
      }
      lines.push(``)
    }
    lines.push(`— CRUZ 🦀`)
    await sendTelegram(lines.join('\n'))
  }

  console.log(`\n✅ ${forecasts.length} forecasts generated`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
