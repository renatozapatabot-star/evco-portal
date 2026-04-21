#!/usr/bin/env node
/**
 * CRUZ Feedback Loop — Notification Engagement Analysis
 * Runs nightly at 4 AM.
 *
 * Analyzes notification engagement over the last 7 days:
 *   - Action rate (read / total) per notification type
 *   - Identifies noise (< 20% action rate) and signal (> 80%)
 *
 * Inserts patterns into pipeline_postmortems.
 * Sends Telegram summary.
 * Logs to pipeline_log.
 *
 * Usage: node scripts/feedback-loop.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'feedback-loop'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Helpers ────────────────────────────────────────────────

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function logPipeline(step, status, details, durationMs) {
  const entry = {
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(durationMs != null && { duration_ms: durationMs }),
    ...(status === 'error' && {
      error_message: typeof details === 'object' ? (details.error || JSON.stringify(details)) : details
    })
  }
  await supabase.from('pipeline_log').insert(entry).then(({ error }) => {
    if (error) console.error('pipeline_log insert error:', error.message)
  })
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago' })

  console.log('\n🔁 CRUZ Feedback Loop — Notification Engagement')
  console.log(`   Period: last 7 days (since ${sevenDaysAgo})`)
  console.log('═'.repeat(50))

  // 1. Query notifications from last 7 days
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('type, title, read, created_at')
    .eq('company_id', 'evco')
    .gte('created_at', sevenDaysAgo)

  if (error) {
    console.error('❌ Query error:', error.message)
    await logPipeline('query', 'error', { error: error.message })
    await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\nQuery error: ${error.message}\n— CRUZ 🦀`)
    process.exit(1)
  }

  if (!notifications || notifications.length === 0) {
    console.log('   No notifications in last 7 days')
    await logPipeline('complete', 'success', { notifications: 0 })
    await tg([
      `🔁 <b>Feedback Loop — ${dateStr}</b>`,
      `Sin notificaciones en los últimos 7 días`,
      `— CRUZ 🦀`
    ].join('\n'))
    return
  }

  console.log(`   Total notifications: ${notifications.length}`)

  // 2. Calculate action rate per notification type
  const byType = {}
  for (const n of notifications) {
    const type = n.type || 'unknown'
    if (!byType[type]) byType[type] = { total: 0, read: 0 }
    byType[type].total++
    if (n.read) byType[type].read++
  }

  const actionRates = {}
  for (const [type, counts] of Object.entries(byType)) {
    actionRates[type] = {
      total: counts.total,
      read: counts.read,
      rate: parseFloat((counts.read / counts.total * 100).toFixed(1))
    }
  }

  // 3. Noise: types with action_rate < 20%
  const noiseTypes = Object.entries(actionRates)
    .filter(([, d]) => d.rate < 20)
    .map(([type]) => type)

  // 4. Signal: types with action_rate > 80%
  const signalTypes = Object.entries(actionRates)
    .filter(([, d]) => d.rate > 80)
    .map(([type]) => type)

  // Best type by action rate
  const bestEntry = Object.entries(actionRates)
    .sort((a, b) => b[1].rate - a[1].rate)[0]
  const bestType = bestEntry ? bestEntry[0] : 'N/A'
  const bestRate = bestEntry ? bestEntry[1].rate : 0

  console.log(`\n   Action rates per type:`)
  for (const [type, data] of Object.entries(actionRates)) {
    const icon = data.rate > 80 ? '🟢' : data.rate < 20 ? '🔴' : '🟡'
    console.log(`   ${icon} ${type}: ${data.rate}% (${data.read}/${data.total})`)
  }
  console.log(`\n   Signal (>80%): ${signalTypes.length > 0 ? signalTypes.join(', ') : 'ninguno'}`)
  console.log(`   Noise (<20%):  ${noiseTypes.length > 0 ? noiseTypes.join(', ') : 'ninguno'}`)

  // 5. Insert into pipeline_postmortems
  const postmortem = {
    date: now.toISOString().split('T')[0],
    total_runs: notifications.length,
    first_pass_rate: bestRate,
    patterns_detected: {
      source: 'feedback-loop',
      noise_types: noiseTypes,
      signal_types: signalTypes,
      action_rates: actionRates,
      total_notifications: notifications.length
    }
  }

  const { error: insertErr } = await supabase
    .from('pipeline_postmortems')
    .insert(postmortem)

  if (insertErr) {
    console.error(`\n   ⚠️  Postmortem insert error: ${insertErr.message}`)
    await logPipeline('db_insert', 'error', { error: insertErr.message })
  } else {
    console.log('\n   ✅ Patterns saved to pipeline_postmortems')
  }

  // 6. Telegram report
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  await tg([
    `🔁 <b>Feedback Loop — ${dateStr}</b>`,
    `Notificaciones: ${notifications.length}`,
    `Alta señal: ${signalTypes.length > 0 ? signalTypes.join(', ') : 'ninguno'}`,
    `Ruido detectado: ${noiseTypes.length > 0 ? noiseTypes.join(', ') : 'ninguno'}`,
    `Mejor tipo: ${bestType} (${bestRate}% acción)`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ...Object.entries(actionRates).map(([t, d]) =>
      `${d.rate > 80 ? '🟢' : d.rate < 20 ? '🔴' : '🟡'} ${t}: ${d.rate}% (${d.read}/${d.total})`
    ),
    `━━━━━━━━━━━━━━━━━━━━`,
    `Generated in ${elapsed}s`,
    `— CRUZ 🦀`
  ].join('\n'))

  // 7. Log to pipeline_log
  await logPipeline('complete', 'success', {
    notifications: notifications.length,
    signal_types: signalTypes,
    noise_types: noiseTypes,
    best_type: bestType,
    best_rate: bestRate,
    duration_s: parseFloat(elapsed)
  }, Date.now() - startTime)

  console.log(`\n✅ Feedback loop complete (${elapsed}s)`)
}

run().catch(async (err) => {
  console.error('Fatal error:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
