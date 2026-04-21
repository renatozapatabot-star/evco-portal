#!/usr/bin/env node
/**
 * CRUZ Anomaly Check
 * Standalone cron script — detects anomalies in active tráficos
 *
 * 1. Queries Supabase for active tráficos (estatus = 'En Proceso')
 * 2. Builds 90-day historical averages
 * 3. Calls detectAnomalies() via Qwen (local Ollama)
 * 4. Parses response for anomaly flags
 * 5. Writes each anomaly to notifications table
 * 6. Logs run to heartbeat_log, alerts Telegram on failure
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { detectAnomalies } = require('./intelligence/anomaly-detector')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'anomaly-check.js'
const COMPANY_ID = process.env.COMPANY_ID || 'evco'

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

// ─── 1. Fetch active tráficos with doc counts + days waiting ───
async function fetchActiveTraficos() {
  const { data, error } = await supabase
    .from('traficos')
    .select('trafico, estatus, created_at, company_id')
    .eq('company_id', COMPANY_ID)
    .eq('estatus', 'En Proceso')

  if (error) throw new Error(`Active tráficos query failed: ${error.message}`)
  if (!data || data.length === 0) return []

  // Get doc counts per tráfico
  const traficoIds = data.map(t => t.trafico)
  const { data: docs, error: docsErr } = await supabase
    .from('expediente_documentos')
    .select('pedimento_id')
    .in('pedimento_id', traficoIds)

  if (docsErr) console.warn('Doc count query warning:', docsErr.message)

  const docCounts = {}
  for (const d of (docs || [])) {
    docCounts[d.pedimento_id] = (docCounts[d.pedimento_id] || 0) + 1
  }

  const now = Date.now()
  return data.map(t => ({
    trafico: t.trafico,
    docsCount: docCounts[t.trafico] || 0,
    daysWaiting: Math.round((now - new Date(t.created_at).getTime()) / 86400000)
  }))
}

// ─── 2. Build 90-day historical averages ────────────────────────
async function buildHistoricalAvg() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()

  // Total tráficos in last 90 days
  const { count: totalTraficos, error: tErr } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .gte('created_at', ninetyDaysAgo)

  if (tErr) throw new Error(`Historical tráficos query failed: ${tErr.message}`)

  // Docs in last 90 days for doc-per-tráfico average
  const { data: recentTraficos, error: rtErr } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', COMPANY_ID)
    .gte('created_at', ninetyDaysAgo)

  if (rtErr) throw new Error(`Recent tráficos query failed: ${rtErr.message}`)

  let docsPerShipment = 0
  if (recentTraficos && recentTraficos.length > 0) {
    const ids = recentTraficos.map(t => t.trafico)
    const { count: totalDocs } = await supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .in('pedimento_id', ids)

    docsPerShipment = Math.round(((totalDocs || 0) / recentTraficos.length) * 10) / 10
  }

  // Crossing success rate: cruzado / (cruzado + total non-cancelled)
  const { count: cruzados } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('estatus', 'Cruzado')
    .gte('created_at', ninetyDaysAgo)

  const crossingRate = (totalTraficos || 0) > 0
    ? Math.round(((cruzados || 0) / (totalTraficos || 1)) * 1000) / 10
    : 0

  return {
    daily: Math.round(((totalTraficos || 0) / 90) * 10) / 10,
    docsPerShipment,
    crossingRate
  }
}

// ─── 3–4. Call Qwen + parse anomalies ──────────────────────────
function parseAnomalies(qwenResponse) {
  if (!qwenResponse || typeof qwenResponse !== 'string') return []

  // Split response into discrete anomaly blocks
  // Look for numbered items, bullet points, or paragraph breaks
  const lines = qwenResponse.split('\n').filter(l => l.trim())
  const anomalies = []
  let current = ''

  for (const line of lines) {
    // New anomaly starts with a number, bullet, dash, or asterisk
    if (/^\s*(\d+[\.\):]|\-|\*|•)/.test(line)) {
      if (current.trim()) anomalies.push(current.trim())
      current = line
    } else {
      current += ' ' + line
    }
  }
  if (current.trim()) anomalies.push(current.trim())

  // If Qwen found no issues, it typically says "no anomalies" or "todo normal"
  const noIssuePatterns = /no (se )?(detecta|encuentra|observa|hay)|todo (está )?normal|sin anomal/i
  if (anomalies.length <= 1 && noIssuePatterns.test(qwenResponse)) {
    return []
  }

  return anomalies
}

// ─── 5. Write notifications (CRITICAL only) ──────────────────
// Noise reduction: only create notifications for critical anomalies.
// Before: every Qwen anomaly → notification → 0% read rate.
// Now: only anomalies mentioning financial impact, missing docs, or stuck shipments.
const CRITICAL_PATTERNS = /urgent|crítico|critical|perdid|missing|faltante|parad|stuck|bloqu|retras.*\d+\s*días|valor.*alto|\$\d{4,}|importe/i

async function writeNotifications(anomalies) {
  let written = 0
  let skipped = 0
  for (const anomaly of anomalies) {
    if (!CRITICAL_PATTERNS.test(anomaly)) {
      skipped++
      continue
    }
    const description = anomaly.length > 500 ? anomaly.substring(0, 497) + '...' : anomaly
    const { error } = await supabase.from('notifications').insert({
      company_id: COMPANY_ID,
      type: 'anomaly_detected',
      severity: 'critical',
      title: 'Anomalía crítica detectada',
      description,
    })
    if (error) {
      console.error('Failed to insert notification:', error.message)
    } else {
      written++
    }
  }
  if (skipped > 0) console.log(`  Skipped ${skipped} non-critical anomalies (no notification)`)
  return written
}

// ─── MAIN ──────────────────────────────────────────────────────
async function run() {
  console.log(`\n🔍 ${SCRIPT_NAME} — starting anomaly check`)

  const [shipments, historicalAvg] = await Promise.all([
    fetchActiveTraficos(),
    buildHistoricalAvg()
  ])

  console.log(`  Active tráficos: ${shipments.length}`)
  console.log(`  Historical avg: ${JSON.stringify(historicalAvg)}`)

  if (shipments.length === 0) {
    console.log('  No active tráficos — skipping anomaly detection')
    await supabase.from('heartbeat_log').insert({
      all_ok: true,
      details: { script: SCRIPT_NAME, result: 'no_active_traficos' }
    }).then(() => {}, () => {})
    return
  }

  // Call Qwen via anomaly-detector
  const qwenResponse = await detectAnomalies(shipments, historicalAvg)
  console.log(`  Qwen response length: ${(qwenResponse || '').length} chars`)

  // Parse anomalies from response
  const anomalies = parseAnomalies(qwenResponse)
  console.log(`  Anomalies detected: ${anomalies.length}`)

  if (anomalies.length > 0) {
    const written = await writeNotifications(anomalies)
    console.log(`  Notifications written: ${written}`)

    // Telegram summary
    await sendTelegram(
      `⚠️ <b>CRUZ ANOMALY CHECK</b>\n` +
      `${anomalies.length} anomalía(s) detectada(s)\n` +
      `Tráficos activos: ${shipments.length}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      anomalies.slice(0, 3).map(a => `• ${a.substring(0, 100)}`).join('\n') +
      (anomalies.length > 3 ? `\n... +${anomalies.length - 3} más` : '') +
      `\n━━━━━━━━━━━━━━━━━━━━\n— CRUZ 🦀`
    )
  } else {
    console.log('  ✅ No anomalies detected')
  }

  // Log run to Supabase
  await supabase.from('heartbeat_log').insert({
    all_ok: anomalies.length === 0,
    details: {
      script: SCRIPT_NAME,
      active_traficos: shipments.length,
      historical_avg: historicalAvg,
      anomalies_found: anomalies.length
    }
  }).then(() => {}, (e) => console.error('Log insert failed:', e.message))
}

run().catch(async (err) => {
  console.error(`${SCRIPT_NAME} failed:`, err)
  try {
    await supabase.from('heartbeat_log').insert({
      all_ok: false,
      details: { script: SCRIPT_NAME, error: err.message }
    })
    await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
  } catch (_) { /* best effort */ }
  process.exit(1)
})
