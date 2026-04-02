#!/usr/bin/env node
/**
 * CRUZ Ghost Tráfico Detector
 * Runs nightly via cron
 *
 * Purpose:
 *   Finds suppliers with regular import patterns who haven't shipped
 *   in 2x their average interval. These "ghosts" signal potential
 *   supply chain disruptions before they become urgent.
 *
 * Logic:
 *   1. Groups traficos by supplier, calculates avg interval
 *   2. Flags suppliers where days_since_last > 2 * avg_interval
 *   3. Inserts predictions to ghost_traficos table
 *   4. Telegrams if > 5 ghosts detected
 *
 * On failure: red Telegram alert with error
 *
 * — CRUZ 🦀
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'ghost-trafico-detector.js'
const COMPANY_ID = 'evco' // Scripts are exempt from hardcode rule per CLAUDE.md
const MIN_SHIPMENTS = 3   // Minimum historical shipments to establish a pattern
const GHOST_MULTIPLIER = 2 // Flag if days_since_last > multiplier * avg_interval

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

function daysBetween(dateA, dateB) {
  const msPerDay = 86400000
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / msPerDay
}

function daysSince(date) {
  const msPerDay = 86400000
  return (Date.now() - new Date(date).getTime()) / msPerDay
}

async function run() {
  const timestamp = nowCST()
  console.log(`👻 CRUZ Ghost Tráfico Detector — ${timestamp}`)

  // Step 1: Fetch all traficos with supplier and arrival date
  const { data: traficos, error: fetchErr } = await supabase
    .from('traficos')
    .select('id, proveedor, fecha_llegada')
    .eq('company_id', COMPANY_ID)
    .not('proveedor', 'is', null)
    .not('fecha_llegada', 'is', null)
    .order('fecha_llegada', { ascending: true })

  if (fetchErr) throw new Error(`Failed to query traficos: ${fetchErr.message}`)

  if (!traficos || traficos.length === 0) {
    console.log('  No traficos with supplier + arrival date found. Skipping.')
    await supabase.from('heartbeat_log').insert({
      all_ok: true,
      details: { script: SCRIPT_NAME, message: 'No qualifying traficos', timestamp }
    })
    process.exit(0)
  }

  // Step 2: Group by supplier
  const supplierMap = {}
  for (const t of traficos) {
    const supplier = t.proveedor.trim()
    if (!supplierMap[supplier]) supplierMap[supplier] = []
    supplierMap[supplier].push(t.fecha_llegada)
  }

  console.log(`  Suppliers found: ${Object.keys(supplierMap).length}`)

  // Step 3: For each supplier with >= MIN_SHIPMENTS, calculate avg interval
  const ghosts = []
  const now = new Date()

  for (const [supplier, dates] of Object.entries(supplierMap)) {
    if (dates.length < MIN_SHIPMENTS) continue

    // Dates are already sorted ascending from the query
    const intervals = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push(daysBetween(dates[i - 1], dates[i]))
    }

    const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length
    const lastShipmentDate = dates[dates.length - 1]
    const daysSinceLast = daysSince(lastShipmentDate)

    // Flag as ghost if overdue by 2x average interval
    if (daysSinceLast > GHOST_MULTIPLIER * avgInterval && avgInterval > 0) {
      ghosts.push({
        supplier_name: supplier,
        avg_interval_days: Math.round(avgInterval * 10) / 10,
        days_since_last: Math.round(daysSinceLast * 10) / 10,
        last_shipment_date: lastShipmentDate,
        detected_at: now.toISOString(),
        status: 'pending'
      })
    }
  }

  console.log(`  Ghost suppliers detected: ${ghosts.length}`)

  // Step 4: Insert ghosts into ghost_traficos table
  if (ghosts.length > 0) {
    const { error: insertErr } = await supabase
      .from('ghost_traficos')
      .insert(ghosts)

    if (insertErr) {
      console.warn('  Failed to insert ghosts:', insertErr.message)
    } else {
      console.log(`  ✅ ${ghosts.length} ghost(s) inserted into ghost_traficos`)
    }

    // Log each ghost to console
    for (const g of ghosts) {
      console.log(`    👻 ${g.supplier_name}: ${g.days_since_last}d since last (avg ${g.avg_interval_days}d)`)
    }
  }

  // Step 5: Telegram alert if > 5 ghosts
  if (ghosts.length > 5) {
    const topGhosts = ghosts
      .sort((a, b) => b.days_since_last - a.days_since_last)
      .slice(0, 5)

    const ghostLines = topGhosts.map(g =>
      `• <b>${g.supplier_name}</b>: ${g.days_since_last}d (avg ${g.avg_interval_days}d)`
    )

    const msg = [
      `👻 <b>GHOST TRÁFICO ALERT — ${ghosts.length} SUPPLIERS</b>`,
      `${timestamp}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${ghosts.length} suppliers overdue by 2x their avg interval.`,
      ``,
      `Top overdue:`,
      ...ghostLines,
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ].join('\n')
    await sendTelegram(msg)
    console.log('  ⚠️  Ghost alert sent (> 5 detected)')
  } else if (ghosts.length > 0) {
    console.log(`  ℹ️  ${ghosts.length} ghost(s) detected — below alert threshold (> 5)`)
  } else {
    console.log('  ✅ No ghost suppliers detected')
  }

  // Step 6: Log run to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    all_ok: true,
    details: {
      script: SCRIPT_NAME,
      ghosts_detected: ghosts.length,
      suppliers_analyzed: Object.keys(supplierMap).length,
      timestamp
    }
  })

  console.log(`✅ ${SCRIPT_NAME} complete`)
  process.exit(0)
}

run().catch(async (err) => {
  console.error(`Fatal ${SCRIPT_NAME} error:`, err)
  try {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n— CRUZ 🦀`)
    await supabase.from('heartbeat_log').insert({
      all_ok: false,
      details: { script: SCRIPT_NAME, fatal: err.message }
    })
  } catch (_) { /* best effort */ }
  process.exit(1)
})
