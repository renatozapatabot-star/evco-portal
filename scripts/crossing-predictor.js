#!/usr/bin/env node

// ============================================================
// CRUZ Crossing Predictor — historical data → predictions
// Analyzes all clients' crossing patterns to recommend optimal
// bridge × hour × day of week for pending tráficos.
// Cron: 0 5 * * * (daily 5 AM — before business hours)
// ============================================================

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MIN_SAMPLES = 3

async function sendTelegram(msg) {
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
  console.log(`🌉 CRUZ Crossing Predictor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const start = Date.now()

  // ── 1. Build model from bridge_intelligence (hourly data) ──
  console.log('1. Building hourly bridge model...')
  const { data: bridgeData } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, crossing_hours, day_of_week, hour_of_day')
    .not('bridge_name', 'is', null)
    .not('crossing_hours', 'is', null)
    .limit(10000)

  // Model: bridge → day → hour → stats
  const model = {}
  for (const row of (bridgeData || [])) {
    const b = row.bridge_name, d = row.day_of_week, h = row.hour_of_day ?? -1
    if (d == null || h < 0) continue
    if (!model[b]) model[b] = {}
    if (!model[b][d]) model[b][d] = {}
    if (!model[b][d][h]) model[b][d][h] = []
    model[b][d][h].push(row.crossing_hours)
  }

  // ── 2. Also build model from tráfico crossing times (fleet-wide) ──
  console.log('2. Enriching with fleet crossing data...')
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const { data: cruzados } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .not('fecha_cruce', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_cruce', ninetyDaysAgo)
    .limit(5000)

  const crossingDays = []
  for (const t of (cruzados || [])) {
    const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
    if (days > 0 && days < 30) crossingDays.push(days)
  }

  const fleetAvgDays = crossingDays.length > 0
    ? Math.round(crossingDays.reduce((s, d) => s + d, 0) / crossingDays.length * 10) / 10
    : 5

  const bridges = Object.keys(model)
  console.log(`  ${bridges.length} bridges · ${(bridgeData || []).length} hourly points · ${crossingDays.length} fleet crossings`)

  // ── 3. Compute optimal windows (best bridge+hour per day) ──
  console.log('3. Computing optimal windows...')
  const optimalWindows = []

  for (let day = 0; day < 7; day++) {
    let bestBridge = null, bestHour = -1, bestAvg = Infinity, bestStd = 0, bestSamples = 0

    for (const bridge of bridges) {
      const dayData = model[bridge]?.[day] || {}
      for (const [hour, times] of Object.entries(dayData)) {
        if (times.length < MIN_SAMPLES) continue
        const avg = times.reduce((s, t) => s + t, 0) / times.length
        if (avg < bestAvg) {
          bestAvg = avg
          bestHour = parseInt(hour)
          bestBridge = bridge
          bestSamples = times.length
          const variance = times.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / times.length
          bestStd = Math.sqrt(variance)
        }
      }
    }

    if (bestBridge) {
      optimalWindows.push({
        day, dayName: DAY_NAMES[day], bridge: bestBridge,
        hour: bestHour, avgHours: Math.round(bestAvg * 10) / 10,
        stdHours: Math.round(bestStd * 10) / 10, samples: bestSamples,
      })
    }
  }

  // ── 4. Save predictions ──
  if (!DRY_RUN) {
    for (const w of optimalWindows) {
      await supabase.from('crossing_predictions').upsert({
        day_of_week: w.day,
        bridge_name: w.bridge,
        optimal_hour: w.hour,
        avg_hours: w.avgHours,
        std_hours: w.stdHours,
        samples: w.samples,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'day_of_week' }).then(() => {}, () => {})
    }

    // Also save fleet crossing average
    await supabase.from('benchmarks').upsert({
      metric: 'avg_crossing_days',
      dimension: 'fleet',
      value: fleetAvgDays,
      sample_size: crossingDays.length,
      period: new Date().toISOString().split('T')[0],
    }, { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  // ── 5. Find pending tráficos for tomorrow's recommendation ──
  console.log('4. Finding tráficos for recommendation...')
  const { data: pendingTraficos } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, fecha_llegada, descripcion_mercancia')
    .neq('estatus', 'Cruzado')
    .is('fecha_cruce', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(20)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = tomorrow.getDay()
  const window = optimalWindows.find(w => w.day === tomorrowDay)

  // ── 6. Telegram alert ──
  if (window && (pendingTraficos || []).length > 0) {
    const top5 = (pendingTraficos || []).slice(0, 5)
    const lines = [
      `🌉 <b>Predicción de cruce — mañana ${window.dayName}</b>`,
      ``,
      `Puente: <b>${window.bridge}</b>`,
      `Horario óptimo: <b>${window.hour}:00–${window.hour + 2}:00</b>`,
      `Tiempo estimado: ${window.avgHours}h (±${window.stdHours}h)`,
      `Basado en ${window.samples} registros históricos`,
      ``,
      `📦 Tráficos pendientes (${(pendingTraficos || []).length}):`,
      ...top5.map(t => `  • <code>${t.trafico}</code> — ${(t.descripcion_mercancia || '').substring(0, 30)}`),
      ``,
      `— CRUZ 🦀`,
    ]
    await sendTelegram(lines.join('\n'))
  }

  // Log to Operational Brain
  try {
    const { logDecision } = require('./decision-logger')
    if (optimalWindows.length > 0) await logDecision({ decision_type: 'crossing_choice', decision: `${optimalWindows.length} ventanas óptimas identificadas`, reasoning: `Fleet avg: ${fleetAvgDays}d, ${crossingDays.length} muestras` })
  } catch {}

  // ── Summary ──
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ Crossing predictor complete · ${elapsed}s`)
  console.log(`   ${optimalWindows.length} optimal windows`)
  console.log(`   Fleet avg crossing: ${fleetAvgDays} days (${crossingDays.length} samples)`)
  for (const w of optimalWindows) {
    console.log(`   ${w.dayName.padEnd(12)} ${(w.bridge || '?').padEnd(25)} ${w.hour}:00 → ${w.avgHours}h`)
  }

  process.exit(0)
}

main().catch(async (err) => {
  console.error(`❌ crossing-predictor failed:`, err.message)
  await sendTelegram(`🔴 <b>Crossing predictor FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
