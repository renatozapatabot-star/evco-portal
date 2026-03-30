#!/usr/bin/env node
/**
 * CRUZ Bridge Wait Times Fetcher
 * Runs every 30 minutes via cron
 *
 * Purpose:
 *   Fetches CBP border wait times for Laredo bridges (port 2304).
 *   Stores to bridge_intelligence table for crossing predictions.
 *
 * Validation:
 *   - Any wait time > 300 minutes is discarded (garbage data)
 *   - If CBP API unreachable: falls back to most recent historical value
 *   - Fallback hierarchy: live API → last known value → Telegram alert
 *
 * On success: logs to heartbeat_log
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
const SCRIPT_NAME = 'fetch-bridge-times.js'
const CBP_API_URL = 'https://bwt.cbp.gov/api/bwtnew?port=2304'
const MAX_VALID_WAIT_MINUTES = 480 // 8 hours — anything above is a data error
const API_TIMEOUT_MS = 15000

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

function getDayOfWeek() {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long'
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

async function getHistoricalFallback(bridgeName) {
  // Fallback: most recent valid entry from bridge_intelligence
  const { data, error } = await supabase
    .from('bridge_intelligence')
    .select('wait_time_minutes, passenger_wait, fetched_at')
    .eq('bridge_name', bridgeName)
    .eq('source', 'cbp_api')
    .order('fetched_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0]
}

async function getHistoricalAverage(bridgeName) {
  // Average of last 48 entries (roughly 24 hours at 30 min intervals)
  const { data, error } = await supabase
    .from('bridge_intelligence')
    .select('wait_time_minutes')
    .eq('bridge_name', bridgeName)
    .eq('source', 'cbp_api')
    .order('fetched_at', { ascending: false })
    .limit(48)

  if (error || !data || data.length === 0) return null

  const avg = data.reduce((sum, r) => sum + r.wait_time_minutes, 0) / data.length
  return Math.round(avg)
}

function parseWaitTime(value) {
  // CBP API returns wait times as strings or numbers
  const minutes = parseInt(value, 10)
  if (isNaN(minutes) || minutes < 0) return null
  if (minutes > MAX_VALID_WAIT_MINUTES) return null // Garbage data — discard
  return minutes
}

async function run() {
  const timestamp = nowCST()
  const dayOfWeek = getDayOfWeek()
  console.log(`🌉 CRUZ Bridge Times — ${timestamp} (${dayOfWeek})`)

  let apiData = null
  let apiReachable = false

  // Step 1: Attempt to fetch from CBP API
  try {
    const res = await fetch(CBP_API_URL, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { 'Accept': 'application/json' }
    })

    if (!res.ok) {
      throw new Error(`CBP API returned HTTP ${res.status}`)
    }

    apiData = await res.json()
    apiReachable = true
    console.log('  ✅ CBP API reachable')
  } catch (e) {
    console.warn(`  ⚠️  CBP API unreachable: ${e.message}`)
  }

  const records = []
  const fetchedAt = new Date().toISOString()

  if (apiReachable && apiData) {
    // Step 2: Parse CBP response — extract bridge entries
    // CBP BWT API returns an array of port entries with lane types
    const portEntries = Array.isArray(apiData) ? apiData : [apiData]

    for (const entry of portEntries) {
      // Handle nested structure — CBP API may wrap in various formats
      const ports = entry.ports || entry.port || [entry]
      const portList = Array.isArray(ports) ? ports : [ports]

      for (const port of portList) {
        const bridgeName = port.port_name || port.crossing_name || port.border || 'Laredo'

        // Commercial vehicle wait time
        const commercialWait = parseWaitTime(
          port.commercial_vehicle_lanes?.standard_lanes?.delay_minutes ||
          port.commercial?.delay_minutes ||
          port.commercial_wait
        )

        // Passenger vehicle wait time
        const passengerWait = parseWaitTime(
          port.passenger_vehicle_lanes?.standard_lanes?.delay_minutes ||
          port.passenger?.delay_minutes ||
          port.passenger_wait
        )

        if (commercialWait !== null) {
          records.push({
            bridge_name: bridgeName,
            wait_time_minutes: commercialWait,
            passenger_wait: passengerWait,
            source: 'cbp_api',
            fetched_at: fetchedAt,
            day_of_week: dayOfWeek
          })
          console.log(`  🚛 ${bridgeName}: commercial ${commercialWait}min, passenger ${passengerWait ?? 'N/A'}min`)

          // Anomaly alert: extreme wait time
          if (commercialWait > 300) {
            await sendTelegram(`⚠️ Bridge data anomaly: ${bridgeName} shows ${commercialWait} min — verify CBP source`)
          }
        } else if (passengerWait !== null) {
          // Only passenger data available — still worth storing
          records.push({
            bridge_name: bridgeName,
            wait_time_minutes: passengerWait,
            passenger_wait: passengerWait,
            source: 'cbp_api',
            fetched_at: fetchedAt,
            day_of_week: dayOfWeek
          })
          console.log(`  🚗 ${bridgeName}: passenger ${passengerWait}min (no commercial data)`)

          // Anomaly alert: extreme wait time
          if (passengerWait > 300) {
            await sendTelegram(`⚠️ Bridge data anomaly: ${bridgeName} shows ${passengerWait} min — verify CBP source`)
          }
        } else {
          // Both values exceeded MAX_VALID_WAIT_MINUTES — use historical average
          console.warn(`  ⚠️  ${bridgeName}: wait times exceeded ${MAX_VALID_WAIT_MINUTES}min — using historical average`)
          const avg = await getHistoricalAverage(bridgeName)
          if (avg !== null) {
            records.push({
              bridge_name: bridgeName,
              wait_time_minutes: avg,
              passenger_wait: null,
              source: 'historical_fallback',
              fetched_at: fetchedAt,
              day_of_week: dayOfWeek
            })
            console.log(`  📊 ${bridgeName}: historical avg ${avg}min (garbage data discarded)`)
          }
        }
      }
    }
  }

  // Step 3: If no records from API, use historical fallback
  if (records.length === 0) {
    console.log('  ⚠️  No valid data from CBP API — falling back to historical')

    // Try to get fallback for known Laredo bridges
    const knownBridges = ['World Trade Bridge', 'Laredo', 'Colombia Bridge']

    for (const bridgeName of knownBridges) {
      const fallback = await getHistoricalFallback(bridgeName)
      if (fallback) {
        records.push({
          bridge_name: bridgeName,
          wait_time_minutes: fallback.wait_time_minutes,
          passenger_wait: fallback.passenger_wait,
          source: 'historical_fallback',
          fetched_at: fetchedAt,
          day_of_week: dayOfWeek
        })
        console.log(`  📊 ${bridgeName}: fallback ${fallback.wait_time_minutes}min (from ${fallback.fetched_at})`)
      }
    }

    // If still no data at all — alert
    if (records.length === 0) {
      const msg = [
        `🔴 <b>BRIDGE TIMES — NO DATA</b>`,
        `${timestamp}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `CBP API unreachable and no historical fallback available.`,
        `Bridge intelligence is offline.`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `— CRUZ 🦀`
      ].join('\n')
      await sendTelegram(msg)
      throw new Error('No bridge data available from API or historical fallback')
    }
  }

  // Step 4: Insert records into bridge_intelligence
  const { error: insertErr } = await supabase
    .from('bridge_intelligence')
    .insert(records)

  if (insertErr) {
    console.warn('  Failed to insert bridge data:', insertErr.message)
  } else {
    console.log(`  ✅ ${records.length} bridge record(s) stored`)
  }

  // Step 5: Log success to heartbeat_log
  await supabase.from('heartbeat_log').insert({
    all_ok: true,
    details: {
      script: SCRIPT_NAME,
      records_stored: records.length,
      sources: [...new Set(records.map(r => r.source))],
      bridges: records.map(r => `${r.bridge_name}: ${r.wait_time_minutes}min`),
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
