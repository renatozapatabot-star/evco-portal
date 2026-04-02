#!/usr/bin/env node
// scripts/crossing-predictor.js
// Pure analytics: best/worst crossing days from traficos history
// No AI. Groups by day_of_week, upserts to crossing_predictions, Telegram summary.
// Cron: every 6 hours — 0 */6 * * *

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const SCRIPT_NAME = 'crossing-predictor'
const COMPANY_ID = 'evco'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const MAX_DAYS = 15
const LOOKBACK_DAYS = 90
const MIN_SAMPLES = 5

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[telegram-skip]', message); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram send failed:', e.message)
  }
}

async function run() {
  console.log(`🌉 Crossing Predictor — CRUZ (${COMPANY_ID})`)
  const start = Date.now()

  // 1. Query cruzados from last 90 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS)

  const { data: cruzados, error } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .eq('company_id', COMPANY_ID)
    .eq('estatus', 'Cruzado')
    .not('fecha_llegada', 'is', null)
    .not('fecha_cruce', 'is', null)
    .gte('fecha_cruce', cutoff.toISOString())
    .limit(5000)

  if (error) throw new Error(`Query failed: ${error.message}`)
  if (!cruzados || cruzados.length === 0) {
    console.log('No cruzados found in last 90 days — skipping')
    return
  }

  console.log(`Found ${cruzados.length} cruzados in last ${LOOKBACK_DAYS} days`)

  // 2. Group by day_of_week (0=Sunday, 6=Saturday) from fecha_llegada
  const days = {} // dow → { totalDays, count }

  cruzados.forEach(t => {
    const llegada = new Date(t.fecha_llegada)
    const cruce = new Date(t.fecha_cruce)
    const crossingDays = (cruce.getTime() - llegada.getTime()) / 86400000

    if (crossingDays <= 0 || crossingDays > MAX_DAYS) return

    const dow = llegada.getDay()
    if (!days[dow]) days[dow] = { totalDays: 0, count: 0 }
    days[dow].totalDays += crossingDays
    days[dow].count++
  })

  // Build results with min sample filter
  const results = Object.entries(days)
    .map(([dow, d]) => ({
      company_id: COMPANY_ID,
      day_of_week: Number(dow),
      avg_crossing_days: Math.round((d.totalDays / d.count) * 100) / 100,
      sample_count: d.count,
      updated_at: new Date().toISOString()
    }))
    .filter(r => r.sample_count >= MIN_SAMPLES)
    .sort((a, b) => a.avg_crossing_days - b.avg_crossing_days)

  if (results.length === 0) {
    console.log(`No days with ≥${MIN_SAMPLES} samples — skipping`)
    return
  }

  // 3. Best and worst days
  const best = results[0]
  const worst = results[results.length - 1]
  const totalSamples = results.reduce((s, r) => s + r.sample_count, 0)

  console.log('\nResults by day:')
  results.forEach(r =>
    console.log(`  ${DAY_NAMES[r.day_of_week]}: ${r.avg_crossing_days}d avg (n=${r.sample_count})`)
  )
  console.log(`\n✅ Best:  ${DAY_NAMES[best.day_of_week]} — ${best.avg_crossing_days}d`)
  console.log(`⚠️  Worst: ${DAY_NAMES[worst.day_of_week]} — ${worst.avg_crossing_days}d`)

  // 4. Upsert to crossing_windows
  const { error: deleteErr } = await supabase
    .from('crossing_windows')
    .delete()
    .eq('company_id', COMPANY_ID)

  if (deleteErr) throw new Error(`Delete failed: ${deleteErr.message}`)

  const { error: insertErr } = await supabase
    .from('crossing_windows')
    .insert(results)

  if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`)

  // 5. Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    all_ok: true,
    details: {
      script: SCRIPT_NAME,
      days_with_data: results.length,
      samples: totalSamples,
      best_day: DAY_NAMES[best.day_of_week],
      best_avg: best.avg_crossing_days,
      worst_day: DAY_NAMES[worst.day_of_week],
      worst_avg: worst.avg_crossing_days
    }
  })

  // 6. Telegram summary
  const today = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Chicago' })
  await sendTelegram(
    `🌉 <b>Análisis de cruce</b> — ${today}\n` +
    `✅ Mejor día: <b>${DAY_NAMES[best.day_of_week]}</b> — ${best.avg_crossing_days} días promedio\n` +
    `⚠️ Peor día: <b>${DAY_NAMES[worst.day_of_week]}</b> — ${worst.avg_crossing_days} días promedio\n` +
    `📊 Basado en ${totalSamples} tráficos (${LOOKBACK_DAYS} días)\n— CRUZ 🦀`
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ Done — ${results.length} days saved · ${totalSamples} samples · ${elapsed}s`)
}

run().catch(async (err) => {
  console.error(`❌ ${SCRIPT_NAME} failed:`, err.message)
  try {
    await supabase.from('heartbeat_log').insert({
      all_ok: false,
      details: { script: SCRIPT_NAME, error: err.message }
    })
    await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  } catch (_) { /* best effort */ }
  process.exit(1)
})
