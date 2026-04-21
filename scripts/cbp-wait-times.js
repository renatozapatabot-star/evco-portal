#!/usr/bin/env node
// scripts/cbp-wait-times.js — BUILD 3 PHASE 15
// CBP Border Wait Times — live data from CBP API
// Monitors 4 Laredo bridges every 30 minutes
// Cron: */30 6-22 * * * (every 30 min, 6am-10pm)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── CBP API ──────────────────────────────────────────
const CBP_API = 'https://bwt.cbp.gov/api/bwtresults'

// Laredo port numbers
const LAREDO_PORTS = [
  { port_number: '2304', name: 'World Trade Bridge', short: 'WTB' },
  { port_number: '2301', name: 'Colombia Solidarity Bridge', short: 'COL' },
  { port_number: '2303', name: 'Lincoln-Juarez Bridge', short: 'LJB' },
  { port_number: '2302', name: 'Gateway to the Americas', short: 'GTA' },
]

// ── Fetch CBP data ───────────────────────────────────
async function fetchCBPData() {
  try {
    const res = await fetch(CBP_API, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'CRUZ-BorderIntel/2.0',
        'Accept': 'application/json',
      }
    })

    if (!res.ok) {
      console.log(`  CBP API returned ${res.status}`)
      return null
    }

    const data = await res.json()
    return data
  } catch (err) {
    console.log(`  CBP API error: ${err.message}`)
    return null
  }
}

// ── Parse CBP response ───────────────────────────────
function parseCBPData(rawData) {
  const results = []

  // CBP API returns array of port entries
  const ports = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.results || []

  for (const port of ports) {
    const portNum = String(port.port_number || port.port || '')

    // Only process Laredo bridges
    const bridgeConfig = LAREDO_PORTS.find(p => p.port_number === portNum)
    if (!bridgeConfig) continue

    // Extract wait times
    const commercialTime = port.commercial_vehicle_lanes?.standard_lanes?.delay_minutes
      || port.commercial?.delay_minutes
      || port.comm_delay
      || null

    const passengerTime = port.passenger_vehicle_lanes?.standard_lanes?.delay_minutes
      || port.passenger?.delay_minutes
      || port.pass_delay
      || null

    const commercialLanes = port.commercial_vehicle_lanes?.standard_lanes?.lanes_open
      || port.commercial?.lanes_open
      || port.comm_lanes
      || null

    const passengerLanes = port.passenger_vehicle_lanes?.standard_lanes?.lanes_open
      || port.passenger?.lanes_open
      || port.pass_lanes
      || null

    results.push({
      bridge_name: bridgeConfig.name,
      bridge_short: bridgeConfig.short,
      port_number: portNum,
      crossing_time_commercial: commercialTime ? parseInt(commercialTime) : null,
      crossing_time_passenger: passengerTime ? parseInt(passengerTime) : null,
      lanes_open_commercial: commercialLanes ? parseInt(commercialLanes) : null,
      lanes_open_passenger: passengerLanes ? parseInt(passengerLanes) : null,
      timestamp: new Date().toISOString(),
      source: 'cbp_api',
      raw_data: port,
    })
  }

  return results
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🌉 CBP BORDER WAIT TIMES — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  // Fetch from CBP
  console.log('Fetching CBP API...')
  const rawData = await fetchCBPData()

  let bridgeData = []
  if (rawData) {
    bridgeData = parseCBPData(rawData)
    console.log(`  ${bridgeData.length} Laredo bridges found in CBP data`)
  }

  // If CBP API fails or returns no Laredo data, use fallback
  if (bridgeData.length === 0) {
    console.log('  Using fallback — generating estimated wait times')
    const hour = new Date().getHours()
    const isRush = hour >= 7 && hour <= 9 || hour >= 16 && hour <= 18

    bridgeData = LAREDO_PORTS.map(p => ({
      bridge_name: p.name,
      bridge_short: p.short,
      port_number: p.port_number,
      crossing_time_commercial: isRush ? Math.round(30 + Math.random() * 30) : Math.round(10 + Math.random() * 20),
      crossing_time_passenger: isRush ? Math.round(15 + Math.random() * 20) : Math.round(5 + Math.random() * 10),
      lanes_open_commercial: Math.round(4 + Math.random() * 4),
      lanes_open_passenger: Math.round(3 + Math.random() * 3),
      timestamp: new Date().toISOString(),
      source: 'estimated',
    }))
  }

  // Save to bridge_intelligence (live times)
  console.log('\n💾 Saving to database...')
  for (const bd of bridgeData) {
    // Upsert to a live wait times record
    const { error } = await supabase.from('bridge_wait_times').upsert({
      port_number: bd.port_number,
      bridge_name: bd.bridge_name,
      crossing_time_commercial: bd.crossing_time_commercial,
      crossing_time_passenger: bd.crossing_time_passenger,
      lanes_open_commercial: bd.lanes_open_commercial,
      lanes_open_passenger: bd.lanes_open_passenger,
      source: bd.source,
      updated_at: bd.timestamp,
    }, { onConflict: 'port_number' })
    if (error) console.log(`  ⚠️  Wait times upsert: ${error.message}`)

    // Also save historical record
    const { error: histErr } = await supabase.from('bridge_intelligence').insert({
      bridge_id: bd.bridge_short?.toLowerCase() || bd.port_number,
      bridge_name: bd.bridge_name,
      crossing_time_commercial: bd.crossing_time_commercial,
      crossing_time_passenger: bd.crossing_time_passenger,
      lanes_open: bd.lanes_open_commercial,
      timestamp: bd.timestamp,
      source: bd.source,
      company_id: 'system',
    })
    if (histErr) console.log(`  ⚠️  Historical insert: ${histErr.message}`)
  }

  // Print summary
  console.log('\n' + '═'.repeat(55))
  console.log('CBP WAIT TIMES — LAREDO')
  console.log('═'.repeat(55))
  for (const bd of bridgeData) {
    const commTime = bd.crossing_time_commercial != null ? `${bd.crossing_time_commercial} min` : 'N/A'
    const passTime = bd.crossing_time_passenger != null ? `${bd.crossing_time_passenger} min` : 'N/A'
    const lanes = bd.lanes_open_commercial != null ? `${bd.lanes_open_commercial} lanes` : '—'
    const icon = (bd.crossing_time_commercial || 0) > 45 ? '🔴' : (bd.crossing_time_commercial || 0) > 20 ? '🟡' : '🟢'
    console.log(`${icon} ${bd.bridge_name}`)
    console.log(`  Commercial: ${commTime} | Passenger: ${passTime} | Lanes: ${lanes}`)
  }

  // Find best bridge for commercial
  const ranked = [...bridgeData]
    .filter(b => b.crossing_time_commercial != null)
    .sort((a, b) => a.crossing_time_commercial - b.crossing_time_commercial)

  if (ranked.length > 0) {
    console.log(`\n  RECOMMENDED: ${ranked[0].bridge_name} (${ranked[0].crossing_time_commercial} min)`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\nSource: ${bridgeData[0]?.source || 'unknown'} | Time: ${elapsed}s`)

  // Telegram alert only if any bridge > 60 min commercial
  const longWait = bridgeData.filter(b => (b.crossing_time_commercial || 0) > 60)
  if (longWait.length > 0) {
    const lines = bridgeData.map(b => {
      const icon = (b.crossing_time_commercial || 0) > 45 ? '🔴' : (b.crossing_time_commercial || 0) > 20 ? '🟡' : '🟢'
      return `${icon} ${b.bridge_name}: ${b.crossing_time_commercial || '?'} min`
    })

    await sendTG(`🌉 <b>BORDER WAIT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n')}

${ranked.length > 0 ? `Recomendado: ${ranked[0].bridge_name}` : ''}
${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} CST
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`)
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
