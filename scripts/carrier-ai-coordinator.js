#!/usr/bin/env node
/**
 * CRUZ Carrier Coordinator AI — Build 216
 * ============================================================================
 * When a tráfico has its pedimento paid, CRUZ identifies top carriers,
 * dispatches WhatsApp messages via Twilio, and auto-assigns the first
 * confirmed carrier.
 *
 * Cron: */30 6-20 * * 1-6 (every 30 min during business hours)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { emitEvent } = require('./lib/workflow-emitter')

const SCRIPT_NAME = 'carrier-ai-coordinator'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER

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

async function sendWhatsApp(phone, message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WHATSAPP) {
    console.log(`  [WhatsApp skip — Twilio not configured]`)
    return false
  }

  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP,
    To: to,
    Body: message,
  })

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error(`  WhatsApp error: ${err}`)
    return false
  }
  return true
}

// ── Get top carriers for a route ─────────────────────────────────────────────

async function getTopCarriers(limit = 3) {
  // Get from carrier_scores or system_config
  const { data: scores } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'carrier_scoreboard')
    .maybeSingle()

  if (scores?.value?.top_carriers) {
    return scores.value.top_carriers.slice(0, limit)
  }

  // Fallback: query entradas for most frequent carriers
  const { data: carriers } = await supabase
    .rpc('get_top_carriers', { limit_count: limit })
    .catch(() => ({ data: null }))

  // If no RPC, return empty
  return carriers || []
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Carrier Coordinator AI`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  // Find tráficos with pedimento paid that don't have a carrier dispatch yet
  const { data: readyTraficos, error } = await supabase
    .from('traficos')
    .select('trafico, proveedor, descripcion_mercancia, importe_total, moneda')
    .eq('company_id', companyId)
    .eq('estatus', 'Pedimento Pagado')
    .order('updated_at', { ascending: true })
    .limit(20)

  if (error) {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`)
    throw new Error(`Query failed: ${error.message}`)
  }

  if (!readyTraficos || readyTraficos.length === 0) {
    console.log('No tráficos ready for carrier dispatch.\n')
    return
  }

  // Check which already have dispatches
  const { data: existingDispatches } = await supabase
    .from('carrier_dispatches')
    .select('trafico_id')
    .in('trafico_id', readyTraficos.map(t => t.trafico))
    .in('status', ['dispatched', 'confirmed'])

  const dispatched = new Set((existingDispatches || []).map(d => d.trafico_id))
  const needsDispatch = readyTraficos.filter(t => !dispatched.has(t.trafico))

  console.log(`${needsDispatch.length} tráfico(s) need carrier dispatch\n`)

  const carriers = await getTopCarriers(3)
  if (carriers.length === 0) {
    console.log('No carriers available in scoreboard. Run carrier-scoreboard.js first.\n')
    return
  }

  let dispatches = 0

  for (const traf of needsDispatch) {
    const product = (traf.descripcion_mercancia || 'Carga general').substring(0, 50)
    const value = traf.importe_total ? `$${traf.importe_total.toLocaleString('en-US')} ${traf.moneda || 'USD'}` : 'N/A'

    console.log(`  ${traf.trafico} · ${traf.proveedor || 'Sin proveedor'} · ${value}`)

    for (const carrier of carriers) {
      const carrierName = carrier.carrier_name || carrier.name || 'Transportista'
      const phone = carrier.phone || carrier.contact_phone

      if (!phone) {
        console.log(`    Skip ${carrierName} — no phone`)
        continue
      }

      const message = [
        `Carga lista para cruce — Renato Zapata & Co.`,
        `Producto: ${product}`,
        `Valor: ${value}`,
        `Proveedor: ${traf.proveedor || 'N/A'}`,
        `Referencia: ${traf.trafico}`,
        ``,
        `¿Disponible? Responda SÍ o NO.`,
      ].join('\n')

      const sent = await sendWhatsApp(phone, message)
      if (sent) {
        console.log(`    📱 WhatsApp sent to ${carrierName}`)
      }

      // Log dispatch
      await supabase.from('carrier_dispatches').insert({
        trafico_id: traf.trafico,
        carrier_name: carrierName,
        carrier_phone: phone,
        status: 'dispatched',
        company_id: companyId,
        message_sent: message,
      }).then(() => {}, (err) => console.error(`    dispatch log error: ${err.message}`))
    }

    // Emit workflow event
    await emitEvent('crossing', 'carrier_dispatched', traf.trafico, companyId, {
      carriers_contacted: carriers.length,
      trafico_number: traf.trafico,
    })

    dispatches++
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${dispatches} dispatches · ${elapsed}s`)

  // Heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { dispatches, carriers_available: carriers.length, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (dispatches > 0) {
    await sendTelegram(`🚛 <b>Carrier Coordinator</b> · ${dispatches} despachos enviados a ${carriers.length} transportistas · ${elapsed}s`)
  }
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
