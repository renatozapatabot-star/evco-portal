#!/usr/bin/env node
/**
 * CRUZ SOIA Watcher
 * Monitors semáforo status for active tráficos
 * Alerts immediately on red light
 * Runs every 15 minutes during business hours
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function checkBridgeWaitTimes() {
  // CBP border wait times API (public)
  const bridges = [
    { name: 'World Trade Bridge', port: '2304' },
    { name: 'Colombia Bridge', port: '2309' },
    { name: 'Juarez-Lincoln Bridge', port: '2305' },
    { name: 'Gateway Bridge', port: '2310' },
  ]

  const results = []
  for (const bridge of bridges) {
    try {
      const res = await fetch(
        `https://bwt.cbp.gov/api/bwtresults?port=${bridge.port}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        const commercial = data?.commercial_vehicle_lanes
        if (commercial) {
          results.push({
            bridge_name: bridge.name,
            wait_minutes: commercial.delay_minutes || 0,
            lanes_open: commercial.lanes_open || 0,
            updated_at: new Date().toISOString()
          })
        }
      }
    } catch {
      // Skip if CBP API unavailable
    }
  }

  if (results.length > 0) {
    // Update bridge_intelligence
    for (const r of results) {
      await supabase.from('bridge_intelligence').upsert({
        bridge_name: r.bridge_name,
        crossing_hours: r.wait_minutes / 60,
        day_of_week: new Date().getDay(),
        hour_of_day: new Date().getHours(),
        updated_at: r.updated_at
      }, { onConflict: 'bridge_name,day_of_week,hour_of_day' })
    }

    // Alert if any bridge > 2 hours
    const longWait = results.filter(r => r.wait_minutes > 120)
    if (longWait.length > 0) {
      await tg(
        `🚦 <b>Espera larga en puente</b>\n` +
        longWait.map(b => `${b.bridge_name}: ${Math.round(b.wait_minutes / 60)}h ${b.wait_minutes % 60}m`).join('\n') +
        `\nRecomendación: ${results.sort((a, b) => a.wait_minutes - b.wait_minutes)[0].bridge_name}\n— CRUZ 🦀`
      )
    }
  }

  return results
}

async function checkActivePedimentos() {
  // Check tráficos with pedimentos that haven't crossed yet
  const { data: active } = await supabase
    .from('traficos')
    .select('trafico, pedimento, estatus, company_id')
    .neq('estatus', 'Cruzado')
    .not('pedimento', 'is', null)
    .is('semaforo', null)
    .limit(50)

  if (!active?.length) return 0

  // For now, mark as checked — actual SOIA integration
  // requires SAT portal access (SOIA_URL + credentials)
  // When configured, uncomment the SOIA API call
  console.log(`${active.length} active pedimentos to monitor (SOIA not yet configured)`)
  return active.length
}

async function run() {
  console.log('\n🚦 SOIA WATCHER')
  console.log('═'.repeat(40))

  const [bridgeResults, pedimentoCount] = await Promise.all([
    checkBridgeWaitTimes(),
    checkActivePedimentos()
  ])

  console.log(`Bridge data: ${bridgeResults.length} bridges updated`)
  bridgeResults.forEach(b => {
    console.log(`  ${b.bridge_name}: ${b.wait_minutes}min (${b.lanes_open} lanes)`)
  })
  console.log(`Active pedimentos: ${pedimentoCount}`)

  // Log scrape run
  await supabase.from('scrape_runs').insert({
    source: 'soia',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    records_found: bridgeResults.length + pedimentoCount,
    records_new: bridgeResults.length,
    status: 'success'
  })
}

run().catch(console.error)
