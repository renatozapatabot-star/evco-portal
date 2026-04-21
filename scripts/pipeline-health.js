#!/usr/bin/env node

// ============================================================
// CRUZ Pipeline Health Monitor
// Checks every cron job's last run, pm2 process health,
// Supabase connectivity, and portal status.
// Replaces basic heartbeat with smarter interval-aware checks.
// Run: node scripts/pipeline-health.js
// Cron: */15 * * * *
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const fs = require('fs')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_CHAT = '-5085543275'

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG skip]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Cron job definitions: name, log path, expected interval in minutes ──
const CRON_JOBS = [
  { name: 'email-intake',       log: '/tmp/email-intake.log',       intervalMin: 15 },
  { name: 'heartbeat',          log: '/tmp/heartbeat.log',          intervalMin: 15 },
  { name: 'shadow-reader',      log: '/tmp/shadow-reader.log',      intervalMin: 60 },
  { name: 'fetch-bridge-times', log: '/tmp/fetch-bridge-times.log', intervalMin: 60 },
  { name: 'morning-report',     log: '/tmp/morning-report.log',     intervalMin: 1440 },
  { name: 'nightly-pipeline',   log: '/tmp/nightly-pipeline.log',   intervalMin: 1440 },
  { name: 'regression-guard',   log: '/tmp/regression-guard.log',   intervalMin: 1440 },
  { name: 'draft-escalation',   log: '/tmp/draft-escalation.log',   intervalMin: 30 },
]

// ── Check log file modification time ──
function checkLogFile(job) {
  try {
    const stat = fs.statSync(job.log)
    const ageMin = (Date.now() - stat.mtimeMs) / 60000
    const maxAge = job.intervalMin * 2 // Alert if 2x expected interval
    return {
      name: job.name,
      ok: ageMin < maxAge,
      ageMin: Math.round(ageMin),
      maxAge,
      lastRun: stat.mtime.toISOString(),
    }
  } catch {
    return {
      name: job.name,
      ok: false,
      ageMin: -1,
      maxAge: job.intervalMin * 2,
      lastRun: null,
      error: 'log file not found',
    }
  }
}

// ── Check pm2 processes ──
function checkPm2() {
  const expected = ['cruz-bot']
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8', timeout: 10000 })
    const procs = JSON.parse(output)
    const issues = []
    for (const name of expected) {
      const p = procs.find(x => x.name === name)
      if (!p) { issues.push(`${name}: MISSING`); continue }
      if (p.pm2_env?.status !== 'online') issues.push(`${name}: ${p.pm2_env?.status}`)
    }
    return { ok: issues.length === 0, online: procs.filter(p => p.pm2_env?.status === 'online').length, total: procs.length, issues }
  } catch (err) {
    return { ok: false, online: 0, total: 0, issues: [err.message] }
  }
}

// ── Check Supabase connectivity ──
async function checkSupabase() {
  try {
    const start = Date.now()
    const { count, error } = await supabase.from('traficos').select('*', { count: 'exact', head: true })
    if (error) return { ok: false, error: error.message, latency: Date.now() - start }
    return { ok: true, latency: Date.now() - start, rowCount: count }
  } catch (err) {
    return { ok: false, error: err.message, latency: -1 }
  }
}

// ── Check portal HTTP status ──
async function checkPortal() {
  try {
    const start = Date.now()
    const resp = await fetch('https://evco-portal.vercel.app', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    })
    return { ok: resp.status >= 200 && resp.status < 400, status: resp.status, latency: Date.now() - start }
  } catch (err) {
    return { ok: false, error: err.message, status: 0, latency: -1 }
  }
}

// ── Check sync freshness ──
async function checkSync() {
  const { data } = await supabase
    .from('sync_log')
    .select('completed_at, rows_synced')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.completed_at) {
    const hrs = (Date.now() - new Date(data.completed_at).getTime()) / 3600000
    return { ok: hrs < 26, hoursSince: Math.round(hrs * 10) / 10, rows: data.rows_synced }
  }
  return { ok: true, hoursSince: '?', rows: '?' }
}

// ── Main ──
async function main() {
  const ts = new Date().toISOString()
  const hour = new Date().getHours()
  console.log(`[${ts}] CRUZ Pipeline Health Check`)

  // Run all checks in parallel
  const cronResults = CRON_JOBS.map(checkLogFile)
  const [pm2, supa, portal, sync] = await Promise.all([
    checkPm2(), checkSupabase(), checkPortal(), checkSync(),
  ])

  const cronFails = cronResults.filter(r => !r.ok)
  const allOk = pm2.ok && supa.ok && portal.ok && sync.ok && cronFails.length === 0

  // Log to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    script: 'pipeline-health',
    status: allOk ? 'success' : 'warning',
    details: {
      pm2, supabase: supa, portal, sync,
      cron: cronResults.map(r => ({ name: r.name, ok: r.ok, ageMin: r.ageMin })),
      cron_fails: cronFails.length,
    },
  }).then(() => {}, () => {})

  if (allOk) {
    console.log('✅ All systems healthy')
    // Green status every 6 hours
    if (hour % 6 === 0) {
      const cronSummary = cronResults
        .map(r => `  ${r.name}: ${r.ageMin}min ago`)
        .join('\n')
      await sendTelegram(
        `✅ <b>CRUZ Pipeline Health</b>\n\n` +
        `pm2: ${pm2.online}/${pm2.total} online\n` +
        `Supabase: ${supa.latency}ms · ${(supa.rowCount || 0).toLocaleString()} tráficos\n` +
        `Portal: ${portal.latency}ms\n` +
        `Sync: ${sync.hoursSince}h ago\n` +
        `\nCron jobs:\n${cronSummary}`
      )
    }
  } else {
    const alerts = []
    if (!pm2.ok) alerts.push(`🔴 pm2: ${pm2.issues.join(', ')}`)
    if (!supa.ok) alerts.push(`🔴 Supabase: ${supa.error}`)
    if (!portal.ok) alerts.push(`🔴 Portal: ${portal.error || 'HTTP ' + portal.status}`)
    if (!sync.ok) alerts.push(`🔴 Sync: ${sync.hoursSince}h stale`)
    for (const fail of cronFails) {
      const icon = fail.error ? '🔴' : '🟡'
      alerts.push(`${icon} ${fail.name}: ${fail.error || `${fail.ageMin}min since last run (max ${fail.maxAge})`}`)
    }

    await sendTelegram(`🚨 <b>CRUZ Pipeline Health — ALERT</b>\n\n${alerts.join('\n')}\n\n<i>${ts}</i>`)
    console.log('🚨 Alerts:', alerts.join(' | '))
  }

  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🚨 <b>Pipeline Health CRASHED</b>\n${err.message}`)
  process.exit(1)
})
