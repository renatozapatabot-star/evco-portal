#!/usr/bin/env node
/**
 * CRUZ Pipeline Postmortem
 * Runs at 2 AM daily.
 * No AI needed — pure analytics.
 *
 * Queries pipeline_log for last 24 hours and calculates:
 *   - Total pipeline runs
 *   - Average duration per step
 *   - Error rate per step
 *   - Most common error messages
 *
 * Inserts summary into pipeline_postmortems.
 * Sends Telegram report.
 *
 * Usage: node scripts/pipeline-postmortem.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'pipeline-postmortem'
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

// ─── Analytics ──────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago' })

  console.log('\n📊 CRUZ Pipeline Postmortem')
  console.log(`   Period: last 24 hours (since ${twentyFourHoursAgo})`)
  console.log('═'.repeat(50))

  // Fetch all pipeline_log entries from last 24h
  const { data: logs, error } = await supabase
    .from('pipeline_log')
    .select('*')
    .gte('timestamp', twentyFourHoursAgo)
    .order('timestamp', { ascending: true })

  if (error) {
    console.error('❌ Query error:', error.message)
    await logPipeline('query', 'error', { error: error.message })
    await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\nQuery error: ${error.message}\n— CRUZ 🦀`)
    process.exit(1)
  }

  if (!logs || logs.length === 0) {
    console.log('   No pipeline activity in last 24 hours')
    await logPipeline('complete', 'success', { entries: 0 })

    await tg([
      `📊 <b>Pipeline Report — ${dateStr}</b>`,
      `Runs: 0`,
      `No pipeline activity in last 24 hours`,
      `— CRUZ 🦀`
    ].join('\n'))
    return
  }

  console.log(`   Total log entries: ${logs.length}`)

  // ── Compute metrics ──────────────────────────────────────

  // Group by script (extract script name from step format "script:step")
  const byScript = {}
  for (const log of logs) {
    const script = (log.step || 'unknown').split(':')[0]
    if (!byScript[script]) byScript[script] = []
    byScript[script].push(log)
  }

  // Count total unique pipeline runs (startup entries)
  const totalRuns = logs.filter(l => (l.step || '').includes(':startup')).length || Object.keys(byScript).length

  // Group by step for duration analysis
  const byStep = {}
  for (const log of logs) {
    const step = log.step || 'unknown'
    if (!byStep[step]) byStep[step] = { total: 0, errors: 0, durations: [] }
    byStep[step].total++
    if (log.status === 'error') byStep[step].errors++

    // Use duration_ms column if available
    if (log.duration_ms) byStep[step].durations.push(log.duration_ms / 1000)
  }

  // Error entries
  const errorLogs = logs.filter(l => l.status === 'error')
  const errorRate = logs.length > 0 ? (errorLogs.length / logs.length * 100).toFixed(1) : '0.0'

  // Most common error messages
  const errorMessages = {}
  for (const log of errorLogs) {
    const msg = (log.error_message || log.input_summary || 'unknown error').substring(0, 100)
    errorMessages[msg] = (errorMessages[msg] || 0) + 1
  }

  const topErrors = Object.entries(errorMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Average durations per step
  const stepDurations = {}
  for (const [step, data] of Object.entries(byStep)) {
    if (data.durations.length > 0) {
      const avg = data.durations.reduce((a, b) => a + b, 0) / data.durations.length
      stepDurations[step] = {
        avg_s: parseFloat(avg.toFixed(2)),
        count: data.durations.length,
        error_rate: data.total > 0 ? parseFloat((data.errors / data.total * 100).toFixed(1)) : 0
      }
    }
  }

  // Per-script summary
  const scriptSummary = {}
  for (const [script, entries] of Object.entries(byScript)) {
    const scriptErrors = entries.filter(e => e.status === 'error').length
    scriptSummary[script] = {
      entries: entries.length,
      errors: scriptErrors,
      error_rate: parseFloat((scriptErrors / entries.length * 100).toFixed(1))
    }
  }

  // Overall average duration (from complete steps)
  const allDurations = Object.values(byStep).flatMap(s => s.durations)
  const avgDurationMin = allDurations.length > 0
    ? (allDurations.reduce((a, b) => a + b, 0) / allDurations.length / 60).toFixed(1)
    : 'N/A'

  // ── Console output ───────────────────────────────────────

  console.log(`\n   Total runs: ${totalRuns}`)
  console.log(`   Total entries: ${logs.length}`)
  console.log(`   Errors: ${errorLogs.length} (${errorRate}%)`)
  console.log(`   Avg duration: ${avgDurationMin} min`)

  console.log('\n   Per-script:')
  for (const [script, summary] of Object.entries(scriptSummary)) {
    const icon = summary.errors > 0 ? '🟡' : '🟢'
    console.log(`   ${icon} ${script}: ${summary.entries} entries, ${summary.errors} errors (${summary.error_rate}%)`)
  }

  if (topErrors.length > 0) {
    console.log('\n   Top errors:')
    for (const [msg, count] of topErrors) {
      console.log(`   ❌ (${count}x) ${msg}`)
    }
  }

  // ── Insert postmortem ────────────────────────────────────

  // Find bottleneck — step with highest avg duration
  const bottleneck = Object.entries(stepDurations)
    .sort((a, b) => b[1].avg_s - a[1].avg_s)[0]

  // First pass rate — entries that succeeded on first try (no error status)
  const successCount = logs.filter(l => l.status === 'success').length
  const firstPassRate = logs.length > 0 ? parseFloat((successCount / logs.length * 100).toFixed(1)) : 100

  const postmortem = {
    date: now.toISOString().split('T')[0],
    total_runs: totalRuns,
    avg_pipeline_minutes: avgDurationMin === 'N/A' ? null : parseFloat(avgDurationMin),
    bottleneck_step: bottleneck ? bottleneck[0] : null,
    first_pass_rate: firstPassRate,
    patterns_detected: {
      error_count: errorLogs.length,
      error_rate: parseFloat(errorRate),
      top_errors: topErrors.map(([msg, count]) => ({ message: msg, count })),
      script_summary: scriptSummary,
      step_durations: stepDurations
    }
  }

  const { error: insertErr } = await supabase
    .from('pipeline_postmortems')
    .insert(postmortem)

  if (insertErr) {
    console.error(`\n   ⚠️  Postmortem insert error: ${insertErr.message}`)
    await logPipeline('db_insert', 'error', { error: insertErr.message })
  } else {
    console.log('\n   ✅ Postmortem saved to pipeline_postmortems')
  }

  // ── Telegram report ──────────────────────────────────────

  const topErrorStr = topErrors.length > 0
    ? `Top error: ${topErrors[0][0].substring(0, 60)}`
    : 'No errors'

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  await tg([
    `📊 <b>Pipeline Report — ${dateStr}</b>`,
    `Runs: ${totalRuns}`,
    `Avg duration: ${avgDurationMin} min`,
    `Errors: ${errorLogs.length} (${errorRate}%)`,
    `${topErrorStr}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ...Object.entries(scriptSummary).map(([s, d]) =>
      `${d.errors > 0 ? '🟡' : '🟢'} ${s}: ${d.entries} entries, ${d.errors} err`
    ),
    `━━━━━━━━━━━━━━━━━━━━`,
    `Generated in ${elapsed}s`,
    `— CRUZ 🦀`
  ].join('\n'))

  await logPipeline('complete', 'success', {
    total_runs: totalRuns,
    errors: errorLogs.length,
    duration_s: parseFloat(elapsed)
  })

  console.log(`\n✅ Postmortem complete (${elapsed}s)`)
}

run().catch(async (err) => {
  console.error('Fatal error:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
