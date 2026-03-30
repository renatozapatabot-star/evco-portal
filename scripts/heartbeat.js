#!/usr/bin/env node
/**
 * CRUZ Heartbeat Monitor
 * Runs every 15 minutes via cron
 *
 * Checks:
 *   1. pm2 alive (process list non-empty)
 *   2. Supabase reachable (query traficos)
 *   3. Vercel portal up (HTTP 200)
 *   4. Last nightly sync < 26 hours ago
 *
 * On all-ok:  green Telegram checkmark (once per hour, not every 15 min)
 * On failure:  red Telegram alert with specific failure immediately
 * Always:     logs to heartbeat_log table in Supabase
 */

const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const STATE_FILE = path.join(__dirname, 'heartbeat-state.json')
const PORTAL_URL = 'https://evco-portal.vercel.app'
const SCRIPT_NAME = 'heartbeat.js'
const MAX_SYNC_AGE_HOURS = 26

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram send error:', e.message)
  }
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  }
  return { last_green_sent: null, alerted_checks: {} }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ─── CHECK: pm2 alive ──────────────────────────────────────
function checkPm2() {
  try {
    const output = execSync('pm2 jlist 2>/dev/null', { timeout: 10000 }).toString()
    const procs = JSON.parse(output)
    const online = procs.filter(p => p.pm2_env?.status === 'online')
    const stopped = procs.filter(p => p.pm2_env?.status !== 'online')
    if (procs.length === 0) {
      return { ok: false, message: 'No pm2 processes found' }
    }
    if (stopped.length > 0) {
      const names = stopped.map(p => p.name).join(', ')
      return { ok: false, message: `${stopped.length} stopped: ${names}` }
    }
    return { ok: true, message: `${online.length} processes online` }
  } catch (e) {
    // pm2 not installed or not running — could be on a machine without pm2
    if (e.message.includes('not found') || e.message.includes('ENOENT')) {
      return { ok: true, message: 'pm2 not installed (skipped)' }
    }
    return { ok: false, message: `pm2 check failed: ${e.message.substring(0, 80)}` }
  }
}

// ─── CHECK: Supabase reachable ──────────────────────────────
async function checkSupabase() {
  try {
    const start = Date.now()
    const { data, error } = await supabase
      .from('traficos')
      .select('id')
      .limit(1)
    if (error) throw new Error(error.message)
    const ms = Date.now() - start
    return { ok: true, ms, message: `${ms}ms response` }
  } catch (e) {
    return { ok: false, ms: null, message: e.message }
  }
}

// ─── CHECK: Vercel portal up ────────────────────────────────
async function checkVercel() {
  try {
    const start = Date.now()
    const res = await fetch(PORTAL_URL, { signal: AbortSignal.timeout(15000) })
    const ms = Date.now() - start
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, ms, message: `HTTP ${res.status} · ${ms}ms` }
    }
    return { ok: false, ms, message: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, ms: null, message: e.message }
  }
}

// ─── CHECK: Last sync < 26 hours ────────────────────────────
async function checkSyncAge() {
  try {
    // Check sync_log for the most recent successful sync
    const { data, error } = await supabase
      .from('sync_log')
      .select('completed_at, status')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)

    if (error) {
      // sync_log might not exist yet — try heartbeat_log for last known sync mark
      return { ok: false, ms: null, ageHours: null, message: `sync_log query failed: ${error.message}` }
    }

    if (!data || data.length === 0) {
      // No sync records — check if nightly-pipeline PID file exists as fallback
      const pidFile = '/tmp/nightly-pipeline.pid'
      if (fs.existsSync(pidFile)) {
        const stat = fs.statSync(pidFile)
        const ageHours = (Date.now() - stat.mtimeMs) / 3600000
        if (ageHours < MAX_SYNC_AGE_HOURS) {
          return { ok: true, ageHours: Math.round(ageHours * 10) / 10, message: `PID file ${Math.round(ageHours)}h ago (no sync_log)` }
        }
        return { ok: false, ageHours: Math.round(ageHours * 10) / 10, message: `Last sync PID ${Math.round(ageHours)}h ago — exceeds ${MAX_SYNC_AGE_HOURS}h` }
      }
      return { ok: false, ageHours: null, message: 'No sync records found' }
    }

    const lastSync = new Date(data[0].completed_at)
    const ageHours = (Date.now() - lastSync.getTime()) / 3600000
    const rounded = Math.round(ageHours * 10) / 10

    if (ageHours < MAX_SYNC_AGE_HOURS) {
      return { ok: true, ageHours: rounded, message: `Last sync ${rounded}h ago` }
    }
    return { ok: false, ageHours: rounded, message: `Last sync ${rounded}h ago — exceeds ${MAX_SYNC_AGE_HOURS}h limit` }
  } catch (e) {
    return { ok: false, ageHours: null, message: e.message }
  }
}

// ─── LOG TO SUPABASE ────────────────────────────────────────
async function logToSupabase(results) {
  try {
    await supabase.from('heartbeat_log').insert({
      pm2_ok: results.pm2.ok,
      supabase_ok: results.supabase.ok,
      supabase_ms: results.supabase.ms || null,
      vercel_ok: results.vercel.ok,
      vercel_ms: results.vercel.ms || null,
      sync_ok: results.sync.ok,
      sync_age_hours: results.sync.ageHours || null,
      all_ok: results.allOk,
      details: {
        pm2: results.pm2.message,
        supabase: results.supabase.message,
        vercel: results.vercel.message,
        sync: results.sync.message
      }
    })
  } catch (e) {
    console.error('Failed to log heartbeat to Supabase:', e.message)
  }
}

// ─── MAIN ───────────────────────────────────────────────────
async function runHeartbeat() {
  const timestamp = nowCST()
  console.log(`\u2764 CRUZ Heartbeat — ${timestamp}`)

  const state = loadState()

  // Run all checks in parallel
  const [pm2Result, supabaseResult, vercelResult, syncResult] = await Promise.all([
    Promise.resolve(checkPm2()),
    checkSupabase(),
    checkVercel(),
    checkSyncAge()
  ])

  const results = {
    pm2: pm2Result,
    supabase: supabaseResult,
    vercel: vercelResult,
    sync: syncResult,
    allOk: pm2Result.ok && supabaseResult.ok && vercelResult.ok && syncResult.ok
  }

  // Console output
  console.log(`  pm2:      ${results.pm2.ok ? '\u2705' : '\u274C'} ${results.pm2.message}`)
  console.log(`  Supabase: ${results.supabase.ok ? '\u2705' : '\u274C'} ${results.supabase.message}`)
  console.log(`  Vercel:   ${results.vercel.ok ? '\u2705' : '\u274C'} ${results.vercel.message}`)
  console.log(`  Sync:     ${results.sync.ok ? '\u2705' : '\u274C'} ${results.sync.message}`)

  // Log to Supabase (always, even on success)
  await logToSupabase(results)

  if (results.allOk) {
    // Send green checkmark at most once per hour
    const lastGreen = state.last_green_sent ? new Date(state.last_green_sent) : null
    const hoursSinceGreen = lastGreen ? (Date.now() - lastGreen.getTime()) / 3600000 : 999

    if (hoursSinceGreen >= 1) {
      const msg = [
        `\u2705 <b>CRUZ HEARTBEAT — TODO OK</b>`,
        `${timestamp}`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `pm2: ${results.pm2.message}`,
        `Supabase: ${results.supabase.message}`,
        `Vercel: ${results.vercel.message}`,
        `Sync: ${results.sync.message}`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `\u2014 CRUZ \uD83E\uDD80`
      ].join('\n')
      await sendTelegram(msg)
      state.last_green_sent = new Date().toISOString()
      console.log('\u2705 Green checkmark sent')
    } else {
      console.log(`\u2705 All ok (green sent ${Math.round(hoursSinceGreen * 60)}min ago, next in ${Math.round((1 - hoursSinceGreen) * 60)}min)`)
    }
    state.alerted_checks = {}
  } else {
    // Build failure alert — only alert on NEW failures (not re-alert every 15 min)
    const issues = []
    const checks = { pm2: results.pm2, supabase: results.supabase, vercel: results.vercel, sync: results.sync }

    for (const [name, check] of Object.entries(checks)) {
      if (!check.ok && !state.alerted_checks[name]) {
        issues.push(`\u274C <b>${name.toUpperCase()}</b>: ${check.message}`)
        state.alerted_checks[name] = new Date().toISOString()
      } else if (check.ok && state.alerted_checks[name]) {
        // Recovered — clear alert state and notify
        issues.push(`\u2705 <b>${name.toUpperCase()}</b> recovered: ${check.message}`)
        delete state.alerted_checks[name]
      }
    }

    if (issues.length > 0) {
      const msg = [
        `\uD83D\uDEA8 <b>CRUZ HEARTBEAT \u2014 ALERTA</b>`,
        `${timestamp}`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        ...issues,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `\u2014 CRUZ \uD83E\uDD80`
      ].join('\n')
      await sendTelegram(msg)
      console.log(`\u26A0\uFE0F  ${issues.length} issue(s) \u2014 alert sent`)
    } else {
      console.log('\u26A0\uFE0F  Known issues still active, no re-alert')
    }
  }

  saveState(state)
}

// Allow external scripts to mark morning report / sync completion
if (process.argv[2] === '--mark-morning-report') {
  const state = loadState()
  state.morning_report_last_run = new Date().toISOString()
  saveState(state)
  console.log('\u2705 Morning report timestamp updated')
  process.exit(0)
}

runHeartbeat().catch(async (err) => {
  console.error('Fatal heartbeat error:', err)
  try {
    await sendTelegram(`\uD83D\uDD34 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n\u2014 CRUZ \uD83E\uDD80`)
    await supabase.from('heartbeat_log').insert({
      pm2_ok: false, supabase_ok: false, vercel_ok: false, sync_ok: false,
      all_ok: false, details: { fatal: err.message }
    })
  } catch (_) { /* best effort */ }
  process.exit(1)
})
