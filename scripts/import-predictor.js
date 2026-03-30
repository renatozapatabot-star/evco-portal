#!/usr/bin/env node
// scripts/import-predictor.js — Predict upcoming imports from historical patterns
// Cron: 0 8 * * 1 (weekly Monday 8 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const FORECAST_WINDOW = 14 // days

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function main() {
  console.log('📦 Import Predictor — CRUZ')
  const now = new Date()

  const { data: traficos, error } = await supabase.from('traficos')
    .select('descripcion_mercancia, fecha_llegada')
    .eq('company_id', COMPANY_ID)
    .not('descripcion_mercancia', 'is', null)
    .not('fecha_llegada', 'is', null)
    .order('fecha_llegada', { ascending: true })

  if (error) throw new Error(`Supabase: ${error.message}`)
  console.log(`${(traficos || []).length} historical imports loaded`)

  // Group by product category (first word, uppercased)
  const categories = {}
  for (const t of traficos || []) {
    const cat = t.descripcion_mercancia.trim().split(/\s+/)[0].toUpperCase()
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(new Date(t.fecha_llegada))
  }

  const predictions = []
  for (const [cat, dates] of Object.entries(categories)) {
    if (dates.length < 5) continue
    dates.sort((a, b) => a - b)

    let totalDays = 0
    for (let i = 1; i < dates.length; i++) totalDays += (dates[i] - dates[i - 1]) / 86400000
    const avgInterval = totalDays / (dates.length - 1)
    const lastDate = dates[dates.length - 1]
    const daysSince = Math.round((now - lastDate) / 86400000)
    const daysUntil = Math.round(avgInterval - daysSince)
    const predictedDate = new Date(lastDate.getTime() + avgInterval * 86400000)

    console.log(`${cat}: avg every ${avgInterval.toFixed(1)} days, last import ${daysSince} days ago, next expected in ~${daysUntil} days`)
    if (daysUntil <= FORECAST_WINDOW && daysUntil >= -7) {
      predictions.push({ category: cat, avg_interval: avgInterval, days_since: daysSince, days_until: daysUntil, predicted_date: predictedDate, count: dates.length })
    }
  }

  console.log(`\n${predictions.length} upcoming predictions (within ${FORECAST_WINDOW} days)`)

  // Save to compliance_predictions
  if (predictions.length > 0) {
    await supabase.from('compliance_predictions')
      .delete().eq('company_id', COMPANY_ID).eq('prediction_type', 'import_forecast')

    const rows = predictions.map(p => ({
      company_id: COMPANY_ID,
      prediction_type: 'import_forecast',
      severity: p.days_until <= 3 ? 'critical' : p.days_until <= 7 ? 'warning' : 'info',
      description: `${p.category}: avg every ${p.avg_interval.toFixed(1)}d, last ${p.days_since}d ago, next ~${p.days_until}d (${p.count} historical)`,
      due_date: p.predicted_date.toISOString().split('T')[0],
    }))
    const { error: insErr } = await supabase.from('compliance_predictions').insert(rows)
    if (insErr) console.error('Insert error:', insErr.message)
    else console.log(`Saved ${rows.length} predictions to compliance_predictions`)
  }

  // Telegram summary
  if (predictions.length > 0) {
    const lines = predictions.slice(0, 8).map(p => {
      const icon = p.days_until <= 3 ? '🔴' : p.days_until <= 7 ? '🟡' : '🔵'
      return `  ${icon} <b>${p.category}</b> — ~${p.days_until}d (every ${p.avg_interval.toFixed(1)}d)`
    })
    await sendTG(`📦 <b>IMPORT FORECAST</b>\n${predictions.length} shipment(s) expected within ${FORECAST_WINDOW} days:\n\n${lines.join('\n')}\n\n— CRUZ 🦀`)
  }

  console.log('✅ Import Predictor complete')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
