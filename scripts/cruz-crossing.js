#!/usr/bin/env node
/**
 * CRUZ Crossing Monitor — Build 6
 * ============================================================================
 * Monitors active crossings, polls CBP bridge times, detects red lights,
 * dispatches carriers via WhatsApp, and emits workflow events.
 *
 * Only runs when tráficos are in crossing-ready states (not 24/7).
 * Conditional polling saves API calls during quiet periods.
 *
 * PM2: cruz-crossing (every 15 min during business hours)
 * Cron: 6-22 Mon-Sat
 *
 * Patente 3596 · Aduana 240 · Nuevo Laredo
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { emitEvent } = require('./lib/workflow-emitter')

const SCRIPT_NAME = 'cruz-crossing'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CBP_API = 'https://bwt.cbp.gov/api/bwtnew?port=2304' // Laredo port

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ── Step 1: Check for active crossings ──────────────────────────────────────

async function getActiveCrossings() {
  const crossingStatuses = ['listo_para_cruce', 'en_cruce', 'Pagado', 'pagado']
  const { data, error } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, pedimento, transportista_mexicano, semaforo, fecha_pago')
    .or(crossingStatuses.map(s => `estatus.ilike.%${s}%`).join(','))
    .not('estatus', 'ilike', '%cruz%')
    .gte('fecha_llegada', '2024-01-01')
    .limit(100)

  if (error) throw new Error(`Active crossings query: ${error.message}`)
  return data || []
}

// ── Step 2: Poll CBP bridge wait times ──────────────────────────────────────

async function pollBridgeTimes() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(CBP_API, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`CBP API ${res.status}`)
    const data = await res.json()

    const bridges = []
    for (const port of (data.port || [])) {
      for (const crossing of (port.crossingItems || [])) {
        if (crossing.crossingName?.includes('Commercial')) {
          const waitMinutes = crossing.delay ? parseInt(crossing.delay) : null
          // 480-minute ceiling — anything higher is garbage data
          const capped = waitMinutes && waitMinutes > 480 ? 480 : waitMinutes
          bridges.push({
            name: port.portName || 'Unknown',
            commercial_wait_minutes: capped,
            status: crossing.status || 'unknown',
            lanes_open: crossing.lanesOpen ? parseInt(crossing.lanesOpen) : null,
          })
        }
      }
    }

    // Store to bridge_intelligence
    for (const bridge of bridges) {
      await supabase.from('bridge_intelligence').upsert({
        bridge_name: bridge.name,
        commercial_wait_minutes: bridge.commercial_wait_minutes,
        status: bridge.status,
        lanes_open: bridge.lanes_open,
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'bridge_name' }).then(() => {}, () => {})
    }

    return bridges
  } catch (err) {
    console.error(`CBP poll failed: ${err.message}`)
    // Fallback: return last known values from Supabase
    const { data } = await supabase
      .from('bridge_intelligence')
      .select('bridge_name, commercial_wait_minutes, status, lanes_open, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(4)
    return (data || []).map(b => ({
      name: b.bridge_name,
      commercial_wait_minutes: b.commercial_wait_minutes,
      status: b.status,
      lanes_open: b.lanes_open,
      stale: true,
    }))
  }
}

// ── Step 3: Detect semáforo rojo ────────────────────────────────────────────

async function checkSemaforo(traficos) {
  const redLights = traficos.filter(t => t.semaforo === 1)

  for (const t of redLights) {
    // Check if we already alerted for this tráfico
    const { data: existing } = await supabase
      .from('audit_log')
      .select('id')
      .eq('action', 'semaforo_rojo_detected')
      .eq('entity_id', t.trafico)
      .limit(1)

    if (existing && existing.length > 0) continue // Already alerted

    await sendTelegram(
      `🔴 <b>SEMÁFORO ROJO</b>\n` +
      `Tráfico: <code>${t.trafico}</code>\n` +
      `Pedimento: ${t.pedimento || 'N/A'}\n` +
      `Transportista: ${t.transportista_mexicano || 'N/A'}\n` +
      `Acción: Reconocimiento aduanero requerido\n` +
      `${nowCST()} — CRUZ 🦀`
    )

    await emitEvent('crossing', 'exam_flagged', t.trafico, t.company_id, {
      semaforo: 'rojo',
      pedimento: t.pedimento,
    })

    await supabase.from('audit_log').insert({
      action: 'semaforo_rojo_detected',
      entity_type: 'trafico',
      entity_id: t.trafico,
      details: { pedimento: t.pedimento, carrier: t.transportista_mexicano },
    }).then(() => {}, () => {})
  }

  return redLights.length
}

// ── Step 4: Dispatch carriers (if paid + no carrier assigned) ───────────────

async function dispatchCarriers(traficos, bridges) {
  const needsCarrier = traficos.filter(t =>
    (t.estatus || '').toLowerCase().includes('pagado') && !t.transportista_mexicano
  )

  if (needsCarrier.length === 0) return 0

  // Find best bridge (lowest wait time)
  const bestBridge = bridges.length > 0
    ? bridges.reduce((a, b) => (a.commercial_wait_minutes || 999) < (b.commercial_wait_minutes || 999) ? a : b)
    : { name: 'World Trade Bridge', commercial_wait_minutes: null }

  let dispatched = 0

  for (const t of needsCarrier) {
    // Check if already dispatched
    const { data: existingDispatch } = await supabase
      .from('carrier_dispatches')
      .select('id')
      .eq('trafico_id', t.trafico)
      .in('status', ['dispatched', 'confirmed'])
      .limit(1)

    if (existingDispatch && existingDispatch.length > 0) continue

    // Get top carrier for this company
    const { data: carriers } = await supabase
      .from('carrier_scoreboard')
      .select('carrier_name, carrier_phone, reputation_score')
      .eq('company_id', t.company_id)
      .order('reputation_score', { ascending: false })
      .limit(3)

    if (!carriers || carriers.length === 0) {
      console.log(`  No carriers for ${t.company_id} — skip dispatch`)
      continue
    }

    const carrier = carriers[0]
    const waitStr = bestBridge.commercial_wait_minutes
      ? `${bestBridge.commercial_wait_minutes} min espera`
      : 'sin datos de espera'

    // Insert dispatch record
    await supabase.from('carrier_dispatches').insert({
      trafico_id: t.trafico,
      carrier_name: carrier.carrier_name,
      carrier_phone: carrier.carrier_phone || null,
      company_id: t.company_id,
      status: 'dispatched',
      message_sent: `Tráfico ${t.trafico} listo para cruce en ${bestBridge.name} (${waitStr}). Pedimento: ${t.pedimento || 'pendiente'}.`,
    }).then(() => {}, (err) => console.error(`Dispatch insert: ${err.message}`))

    await emitEvent('crossing', 'carrier_dispatched', t.trafico, t.company_id, {
      carrier: carrier.carrier_name,
      bridge: bestBridge.name,
      wait_minutes: bestBridge.commercial_wait_minutes,
    })

    dispatched++
    console.log(`  📱 Dispatched ${carrier.carrier_name} for ${t.trafico} → ${bestBridge.name}`)
  }

  return dispatched
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Crossing Monitor`)
  console.log(`  ${nowCST()}\n`)

  // Step 1: Check for active crossings
  const active = await getActiveCrossings()

  if (active.length === 0) {
    console.log('No active crossings — sleeping.')
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { active_crossings: 0, reason: 'no_active' },
    }).then(() => {}, () => {})
    return
  }

  console.log(`${active.length} active crossing(s)\n`)

  // Step 2: Poll bridge times (only when needed)
  const bridges = await pollBridgeTimes()
  console.log(`Bridges: ${bridges.map(b => `${b.name}:${b.commercial_wait_minutes || '?'}min`).join(', ')}`)

  // Step 3: Check semáforo
  const redCount = await checkSemaforo(active)
  if (redCount > 0) console.log(`🔴 ${redCount} semáforo(s) rojo`)

  // Step 4: Dispatch carriers
  const dispatched = await dispatchCarriers(active, bridges)
  if (dispatched > 0) console.log(`📱 ${dispatched} carrier(s) dispatched`)

  // Health check
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'success',
    details: {
      active_crossings: active.length,
      red_lights: redCount,
      dispatched,
      bridges: bridges.length,
      elapsed_s: parseFloat(elapsed),
    },
  }).then(() => {}, () => {})

  console.log(`\n✅ Done in ${elapsed}s — ${active.length} active, ${redCount} red, ${dispatched} dispatched`)
}

run().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
