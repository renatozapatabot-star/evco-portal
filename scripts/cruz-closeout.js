#!/usr/bin/env node
/**
 * CRUZ Close-Out — Build 7
 * ============================================================================
 * When a shipment is delivered, CRUZ closes the tráfico, calculates savings,
 * generates a post-mortem, and queues a client email for Tito approval.
 *
 * Trigger: tráfico status → 'Cruzado' or 'Entregado'
 * Cron: every 30 min during business hours
 *
 * Patente 3596 · Aduana 240 · Nuevo Laredo
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getAllRates } = require('./lib/rates')
const { emitEvent } = require('./lib/workflow-emitter')

const SCRIPT_NAME = 'cruz-closeout'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

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

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtMXN(n) { return 'MX$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function daysBetween(d1, d2) {
  if (!d1 || !d2) return null
  return Math.round(Math.abs(new Date(d2) - new Date(d1)) / 86400000)
}

// ── Step 1: Find recently crossed tráficos without close-out ────────────────

async function findReadyForCloseout() {
  const { data, error } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, pedimento, importe_total, moneda, regimen, proveedor, fecha_llegada, fecha_cruce, fecha_pago, semaforo, transportista_mexicano')
    .or('estatus.ilike.%cruz%,estatus.ilike.%entreg%')
    .gte('fecha_cruce', new Date(Date.now() - 30 * 86400000).toISOString()) // Last 30 days
    .limit(50)

  if (error) throw new Error(`Closeout query: ${error.message}`)

  // Filter out already closed (check audit_log)
  const traficoIds = (data || []).map(t => t.trafico)
  if (traficoIds.length === 0) return []

  const { data: closed } = await supabase
    .from('audit_log')
    .select('entity_id')
    .eq('action', 'trafico_closed_out')
    .in('entity_id', traficoIds)

  const closedSet = new Set((closed || []).map(c => c.entity_id))
  return (data || []).filter(t => !closedSet.has(t.trafico))
}

// ── Step 2: Calculate savings ───────────────────────────────────────────────

async function calculateSavings(trafico, rates) {
  const valorUSD = Number(trafico.importe_total) || 0
  const valorMXN = Math.round(valorUSD * rates.exchangeRate * 100) / 100
  const regimen = (trafico.regimen || '').toUpperCase()
  const isTMEC = ['ITE', 'ITR', 'IMD'].includes(regimen)

  // DTA calculation
  const dtaConfig = rates.dtaRates[regimen] || rates.dtaRates['A1'] || { rate: 0.008 }
  const dtaAmount = Math.round(valorMXN * dtaConfig.rate * 100) / 100

  // IGI — T-MEC = 0, MFN = 5% baseline
  const mfnIgiRate = 0.05
  const appliedIgiRate = isTMEC ? 0 : mfnIgiRate
  const igiAmount = Math.round(valorMXN * appliedIgiRate * 100) / 100
  const igiSaved = isTMEC ? Math.round(valorMXN * mfnIgiRate * 100) / 100 : 0

  // IVA — cascading base (valor_aduana + DTA + IGI)
  const ivaBase = valorMXN + dtaAmount + igiAmount
  const ivaAmount = Math.round(ivaBase * rates.ivaRate * 100) / 100

  // Transit time
  const transitDays = daysBetween(trafico.fecha_llegada, trafico.fecha_cruce)

  return {
    valor_usd: valorUSD,
    valor_mxn: valorMXN,
    tipo_cambio: rates.exchangeRate,
    dta_mxn: dtaAmount,
    igi_mxn: igiAmount,
    iva_mxn: ivaAmount,
    total_contribuciones_mxn: dtaAmount + igiAmount + ivaAmount,
    tmec: isTMEC,
    igi_saved_mxn: igiSaved,
    igi_saved_usd: isTMEC ? Math.round(igiSaved / rates.exchangeRate * 100) / 100 : 0,
    transit_days: transitDays,
    semaforo: trafico.semaforo === 0 ? 'verde' : trafico.semaforo === 1 ? 'rojo' : null,
    regimen,
  }
}

// ── Step 3: Generate post-mortem ────────────────────────────────────────────

async function generatePostMortem(trafico, savings) {
  // Count human touches for this tráfico
  const { data: timeline } = await supabase
    .from('trafico_timeline')
    .select('event_type, source')
    .eq('trafico_id', trafico.trafico)
    .limit(200)

  const events = timeline || []
  const humanTouches = events.filter(e =>
    e.source === 'portal' || e.source === 'telegram' || e.source === 'mobile'
  ).length
  const aiTouches = events.filter(e =>
    e.source === 'cruz_ai' || e.source === 'system'
  ).length

  // Count pipeline failures
  const { data: failures } = await supabase
    .from('pipeline_log')
    .select('step, status')
    .eq('status', 'error')
    .ilike('input_summary', `%${trafico.trafico}%`)
    .limit(50)

  const pipelineFailures = (failures || []).length

  // Get historical average for this company
  const { data: historicalAvg } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .eq('company_id', trafico.company_id)
    .not('fecha_cruce', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(500)

  let avgTransitDays = null
  if (historicalAvg && historicalAvg.length > 5) {
    const days = historicalAvg
      .map(t => daysBetween(t.fecha_llegada, t.fecha_cruce))
      .filter(d => d !== null && d > 0 && d < 90)
    if (days.length > 0) {
      avgTransitDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    }
  }

  return {
    trafico: trafico.trafico,
    company_id: trafico.company_id,
    transit_days: savings.transit_days,
    avg_transit_days: avgTransitDays,
    faster_than_avg: avgTransitDays && savings.transit_days ? savings.transit_days < avgTransitDays : null,
    human_touches: humanTouches,
    ai_touches: aiTouches,
    total_events: events.length,
    pipeline_failures: pipelineFailures,
    semaforo: savings.semaforo,
    tmec_savings_usd: savings.igi_saved_usd,
  }
}

// ── Step 4: Close out tráfico ───────────────────────────────────────────────

async function closeOutTrafico(trafico, savings, postMortem) {
  // Update status if not already 'Entregado'
  if (!(trafico.estatus || '').toLowerCase().includes('entreg')) {
    await supabase.from('traficos')
      .update({ estatus: 'Entregado' })
      .eq('trafico', trafico.trafico)
  }

  // Immutable audit log — close-out record
  await supabase.from('audit_log').insert({
    action: 'trafico_closed_out',
    entity_type: 'trafico',
    entity_id: trafico.trafico,
    details: {
      savings,
      post_mortem: postMortem,
      closed_at: new Date().toISOString(),
    },
  })

  // Emit workflow event
  await emitEvent('post_op', 'operation_closed', trafico.trafico, trafico.company_id, {
    transit_days: savings.transit_days,
    tmec_savings_usd: savings.igi_saved_usd,
    human_touches: postMortem.human_touches,
  })

  // Telegram post-mortem
  const transitLine = savings.transit_days != null
    ? `Tránsito: ${savings.transit_days}d${postMortem.avg_transit_days ? ` (promedio: ${postMortem.avg_transit_days}d)` : ''}`
    : 'Tránsito: N/A'
  const benchLine = postMortem.faster_than_avg === true ? '📈 Más rápido que promedio'
    : postMortem.faster_than_avg === false ? '📉 Más lento que promedio' : ''

  await sendTelegram(
    `📊 <b>Post-Mortem</b> — ${trafico.trafico}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Valor: ${fmtUSD(savings.valor_usd)} USD\n` +
    `Contribuciones: ${fmtMXN(savings.total_contribuciones_mxn)}\n` +
    (savings.tmec ? `Ahorro T-MEC: ${fmtUSD(savings.igi_saved_usd)} USD\n` : '') +
    `${transitLine}\n` +
    `${benchLine ? benchLine + '\n' : ''}` +
    `Toques humanos: ${postMortem.human_touches} · AI: ${postMortem.ai_touches}\n` +
    `Fallas pipeline: ${postMortem.pipeline_failures}\n` +
    `Semáforo: ${savings.semaforo || 'N/A'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `— CRUZ 🦀`
  )

  return true
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Close-Out`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  // Get rates (with staleness check)
  const rates = await getAllRates()

  // Find tráficos ready for close-out
  const ready = await findReadyForCloseout()

  if (ready.length === 0) {
    console.log('No tráficos ready for close-out.\n')
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { ready: 0, reason: 'none_ready' },
    }).then(() => {}, () => {})
    return
  }

  console.log(`${ready.length} tráfico(s) ready for close-out\n`)

  let closed = 0
  let errors = 0

  for (const trafico of ready) {
    try {
      console.log(`  ${trafico.trafico} — ${trafico.proveedor || 'N/A'}`)

      const savings = await calculateSavings(trafico, rates)
      const postMortem = await generatePostMortem(trafico, savings)
      await closeOutTrafico(trafico, savings, postMortem)

      closed++
      console.log(`    ✅ Closed · ${savings.transit_days || '?'}d transit · ${postMortem.human_touches} human touches`)
    } catch (err) {
      errors++
      console.error(`    ❌ ${err.message}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: errors > 0 ? 'partial' : 'success',
    details: { ready: ready.length, closed, errors, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (closed > 0) {
    await sendTelegram(`✅ <b>${SCRIPT_NAME}</b> · ${closed} cerrado(s) · ${errors} error(es) · ${elapsed}s`)
  }

  console.log(`\n✅ Done in ${elapsed}s — ${closed} closed, ${errors} errors`)
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
