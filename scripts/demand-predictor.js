#!/usr/bin/env node
/**
 * CRUZ Demand Predictor — predict when clients will ship
 *
 * For each client+supplier pair with 5+ historical shipments:
 * 1. Calculate shipping frequency (avg days between shipments)
 * 2. Predict next shipment date with confidence
 * 3. Pre-stage alerts 7 days before predicted date
 * 4. Track prediction accuracy → learned_patterns
 *
 * Cron: 0 6 * * 1 (weekly Monday 6 AM)
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

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1))
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtDate(d) {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}

async function main() {
  console.log(`📦 Demand Predictor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Get all tráficos with supplier + dates for frequency analysis
  const allTraficos = await fetchAll(supabase.from('traficos')
    .select('trafico, company_id, proveedores, descripcion_mercancia, fecha_llegada, importe_total')
    .not('proveedores', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true }))

  if (!allTraficos || allTraficos.length === 0) {
    console.log('  No tráficos with supplier data.')
    return
  }

  // Group by company_id + primary supplier
  const pairs = new Map()
  for (const t of allTraficos) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue
    const key = `${t.company_id}::${supplier}`
    if (!pairs.has(key)) pairs.set(key, [])
    pairs.get(key).push(t)
  }

  const predictions = []
  const preStageAlerts = []

  for (const [key, traficos] of pairs) {
    if (traficos.length < 5) continue // Need 5+ for reliable prediction

    const [companyId, supplier] = key.split('::')

    // Sort by fecha_llegada
    traficos.sort((a, b) => (a.fecha_llegada || '').localeCompare(b.fecha_llegada || ''))

    // Calculate intervals between shipments (in days)
    const intervals = []
    for (let i = 1; i < traficos.length; i++) {
      const prev = new Date(traficos[i - 1].fecha_llegada)
      const curr = new Date(traficos[i].fecha_llegada)
      const days = (curr.getTime() - prev.getTime()) / 86400000
      if (days > 0 && days < 180) intervals.push(days) // Exclude >6 month gaps
    }

    if (intervals.length < 3) continue // Need 3+ intervals

    const avgDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 10) / 10
    const sd = Math.round(stdDev(intervals) * 10) / 10

    // Confidence based on regularity
    let confidence
    if (sd < 3) confidence = 95
    else if (sd < 5) confidence = 85
    else if (sd < 10) confidence = 70
    else continue // Too irregular, don't predict

    // Predict next shipment
    const lastShipment = new Date(traficos[traficos.length - 1].fecha_llegada)
    const predictedDate = new Date(lastShipment.getTime() + avgDays * 86400000)
    const today = new Date()

    // Skip if predicted date is in the past
    if (predictedDate < today) {
      // Overdue — still interesting
      const daysOverdue = Math.round((today.getTime() - predictedDate.getTime()) / 86400000)
      if (daysOverdue > 30) continue // Too overdue, skip
    }

    // Day-of-week preference
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]
    for (const t of traficos) {
      dowCounts[new Date(t.fecha_llegada).getDay()]++
    }
    const preferredDow = dowCounts.indexOf(Math.max(...dowCounts))
    const dowNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

    // Average value
    const avgValue = Math.round(traficos.reduce((s, t) => s + (Number(t.importe_total) || 0), 0) / traficos.length)

    // Product description (most common)
    const descCounts = {}
    traficos.forEach(t => {
      const d = (t.descripcion_mercancia || '').substring(0, 40).trim()
      if (d) descCounts[d] = (descCounts[d] || 0) + 1
    })
    const topProduct = Object.entries(descCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    const prediction = {
      company_id: companyId,
      supplier: supplier.substring(0, 40),
      predicted_date: predictedDate.toISOString().split('T')[0],
      confidence,
      avg_frequency_days: avgDays,
      std_deviation: sd,
      sample_size: traficos.length,
      preferred_dow: dowNames[preferredDow],
      avg_value: avgValue,
      product: topProduct,
      last_shipment: lastShipment.toISOString().split('T')[0],
    }

    predictions.push(prediction)

    // Pre-stage alert: 7 days before predicted date
    const daysUntil = Math.round((predictedDate.getTime() - today.getTime()) / 86400000)
    if (daysUntil >= 0 && daysUntil <= 7) {
      preStageAlerts.push(prediction)
    }

    console.log(`  📦 ${companyId}/${supplier.substring(0, 20).padEnd(20)} → ${fmtDate(predictedDate)} (${confidence}%) · cada ${avgDays}d ± ${sd}d · ${traficos.length} muestras`)
  }

  // Save predictions to demand_forecasts
  if (!DRY_RUN && predictions.length > 0) {
    for (const p of predictions) {
      await supabase.from('demand_forecasts').upsert({
        company_id: p.company_id,
        forecast_date: p.predicted_date,
        forecast_data: p,
      }, { onConflict: 'company_id,forecast_date' }).catch(() => {})
    }
  }

  // Log to learned_patterns
  if (!DRY_RUN) {
    for (const p of predictions.filter(pr => pr.confidence >= 85)) {
      await supabase.from('learned_patterns').upsert({
        pattern_type: 'demand_prediction',
        pattern_key: `demand:${p.company_id}:${p.supplier.substring(0, 20).toLowerCase().replace(/\s+/g, '_')}`,
        pattern_value: `${p.supplier} envía cada ${p.avg_frequency_days}d (±${p.std_deviation}d). Próximo: ${p.predicted_date}. Producto: ${p.product}`,
        confidence: p.confidence / 100,
        source: 'demand_predictor',
        sample_size: p.sample_size,
        last_confirmed: new Date().toISOString(),
        active: true,
      }, { onConflict: 'pattern_type,pattern_key' }).catch(() => {})
    }
  }

  // Telegram: pre-staging alerts
  if (preStageAlerts.length > 0) {
    const lines = [
      `📦 <b>Pre-staging: ${preStageAlerts.length} envío(s) esperado(s) esta semana</b>`,
      ``,
    ]
    for (const a of preStageAlerts.slice(0, 5)) {
      const daysUntil = Math.round((new Date(a.predicted_date).getTime() - Date.now()) / 86400000)
      lines.push(`🔮 ${a.company_id}/${a.supplier.substring(0, 20)}`)
      lines.push(`   ${fmtDate(new Date(a.predicted_date))} (${daysUntil}d) · ${a.confidence}% conf`)
      lines.push(`   ${a.product} · ~$${a.avg_value.toLocaleString()} USD`)
      lines.push(``)
    }
    lines.push(`— CRUZ 📦`)
    await tg(lines.join('\n'))
  }

  // Summary Telegram
  await tg(
    `📦 <b>Demand Predictor — Resumen</b>\n\n` +
    `${predictions.length} predicciones generadas\n` +
    `${preStageAlerts.length} envíos esperados esta semana\n` +
    `${predictions.filter(p => p.confidence >= 85).length} alta confianza (≥85%)\n\n` +
    `— CRUZ 📦`
  )

  console.log(`\n✅ ${predictions.length} predicciones · ${preStageAlerts.length} pre-stage alerts`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
