const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const HEARTBEAT_FILE = path.join(__dirname, 'heartbeat-state.json')
const PORTAL_URL = 'https://evco-portal.vercel.app'

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

function loadState() {
  if (fs.existsSync(HEARTBEAT_FILE)) {
    return JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'))
  }
  return {
    supabase: { status: 'unknown', last_ok: null, alerted: false },
    portal: { status: 'unknown', last_ok: null, alerted: false },
    morning_report: { last_run: null, alerted: false },
    globalpc: { status: 'pending', last_ok: null },
  }
}

function saveState(state) {
  fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(state, null, 2))
}

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

async function checkPortal() {
  try {
    const start = Date.now()
    const res = await fetch(PORTAL_URL, { signal: AbortSignal.timeout(10000) })
    const ms = Date.now() - start
    if (res.status === 200) return { ok: true, ms, message: `HTTP ${res.status} · ${ms}ms` }
    return { ok: false, ms, message: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, ms: null, message: e.message }
  }
}

function checkMorningReport(state) {
  if (!state.morning_report.last_run) return { ok: false, message: 'Never run' }
  const last = new Date(state.morning_report.last_run)
  const hoursAgo = (Date.now() - last.getTime()) / 3600000
  if (hoursAgo > 25) return { ok: false, message: `Last run ${Math.round(hoursAgo)}h ago` }
  return { ok: true, message: `Last run ${Math.round(hoursAgo)}h ago` }
}

async function runHeartbeat() {
  console.log(`💓 CRUZ Heartbeat — ${nowCST()}`)

  const state = loadState()
  const now = new Date().toISOString()
  const issues = []

  // Check Supabase
  const sbCheck = await checkSupabase()
  console.log(`  Supabase: ${sbCheck.ok ? '✅' : '❌'} ${sbCheck.message}`)
  if (sbCheck.ok) {
    state.supabase = { status: 'ok', last_ok: now, alerted: false }
  } else {
    if (!state.supabase.alerted) {
      issues.push(`❌ <b>Supabase caído</b>\n   ${sbCheck.message}`)
      state.supabase.alerted = true
    }
    state.supabase.status = 'error'
  }

  // Check Portal
  const portalCheck = await checkPortal()
  console.log(`  Portal: ${portalCheck.ok ? '✅' : '❌'} ${portalCheck.message}`)
  if (portalCheck.ok) {
    state.portal = { status: 'ok', last_ok: now, alerted: false }
  } else {
    if (!state.portal.alerted) {
      issues.push(`❌ <b>Portal caído</b> (evco-portal.vercel.app)\n   ${portalCheck.message}`)
      state.portal.alerted = true
    }
    state.portal.status = 'error'
  }

  // Check morning report ran today
  const mrCheck = checkMorningReport(state)
  console.log(`  Morning Report: ${mrCheck.ok ? '✅' : '⚠️'} ${mrCheck.message}`)
  if (!mrCheck.ok && !state.morning_report.alerted) {
    issues.push(`⚠️ <b>Morning report no ejecutado</b>\n   ${mrCheck.message}`)
    state.morning_report.alerted = true
  } else if (mrCheck.ok) {
    state.morning_report.alerted = false
  }

  // GlobalPC status
  const globalpcConfigured = !!(process.env.GLOBALPC_WSDL_URL)
  console.log(`  GlobalPC: ${globalpcConfigured ? '✅ Configured' : '⏳ Pending whitelist'}`)
  state.globalpc.status = globalpcConfigured ? 'connected' : 'pending'

  saveState(state)

  // Send alert only if there are issues
  if (issues.length > 0) {
    const msg = [
      `🚨 <b>CRUZ HEARTBEAT — ALERTA</b>`,
      `${nowCST()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ...issues,
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ].join('\n')
    await sendTelegram(msg)
    console.log(`⚠️  ${issues.length} issue(s) — alert sent`)
  } else {
    console.log('✅ All systems healthy — no alert needed')

    // Send daily healthy summary at 7AM only
    const hour = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago', hour: 'numeric', hour12: false
    })
    if (parseInt(hour) === 7) {
      await sendTelegram([
        `💓 <b>CRUZ HEARTBEAT — OK</b>`,
        `${nowCST()}`,
        `✅ Supabase: ${sbCheck.message}`,
        `✅ Portal: ${portalCheck.message}`,
        `✅ Morning Report: ${mrCheck.message}`,
        `${globalpcConfigured ? '✅' : '⏳'} GlobalPC: ${state.globalpc.status}`,
        `— CRUZ 🦀`
      ].join('\n'))
    }
  }
}

// Allow external scripts to update morning_report last_run
if (process.argv[2] === '--mark-morning-report') {
  const state = loadState()
  state.morning_report.last_run = new Date().toISOString()
  state.morning_report.alerted = false
  saveState(state)
  console.log('✅ Morning report timestamp updated')
  process.exit(0)
}

runHeartbeat().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
