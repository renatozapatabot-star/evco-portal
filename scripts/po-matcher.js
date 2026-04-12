#!/usr/bin/env node
/**
 * CRUZ PO Matcher — matches incoming POs against predictions
 *
 * Polls workflow_events for:
 * - email_processed (supplier email with PO/invoice data)
 * (entrada_synced removed — entradas table is source of truth)
 *
 * Match scoring:
 * - timing:  1.0 if within 3 days, linear decay to 0 at 14 days
 * - value:   1.0 if within 10%, linear decay to 0 at 50%
 * - product: Jaccard similarity on description keywords
 * - overall: 0.4*timing + 0.3*value + 0.3*product
 *
 * Actions:
 * - ≥0.80: auto-match, Telegram confirmation
 * - 0.50-0.79: escalate to Eloisa with diff
 * - <0.50: normal flow
 *
 * Cron: */15 6-22 * * 1-6 (every 15min business hours)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { updateEventStatus } = require('./lib/workflow-emitter')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'po-matcher'

// ============================================================================
// Helpers
// ============================================================================

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

/**
 * Extract keywords from a description for Jaccard similarity
 */
function extractKeywords(text) {
  if (!text) return new Set()
  return new Set(
    text.toLowerCase()
      .replace(/[^a-záéíóúñü0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}

/**
 * Jaccard similarity between two sets
 */
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}

/**
 * Score how well an event matches a prediction (0.0-1.0)
 */
function scoreMatch(prediction, eventData) {
  const today = new Date()
  const predDate = new Date(prediction.predicted_date)

  // Timing match: 1.0 within 3 days, linear decay to 0.0 at 14 days
  const daysDiff = Math.abs(Math.round((today.getTime() - predDate.getTime()) / 86400000))
  let timingScore
  if (daysDiff <= 3) timingScore = 1.0
  else if (daysDiff >= 14) timingScore = 0.0
  else timingScore = 1.0 - (daysDiff - 3) / 11 // Linear from 1.0 to 0.0

  // Value match: 1.0 within 10%, linear decay to 0.0 at 50%
  let valueScore = 0.5 // Default if no value to compare
  if (prediction.predicted_value_usd && eventData.value_usd) {
    const pctDiff = Math.abs(eventData.value_usd - prediction.predicted_value_usd) / prediction.predicted_value_usd
    if (pctDiff <= 0.10) valueScore = 1.0
    else if (pctDiff >= 0.50) valueScore = 0.0
    else valueScore = 1.0 - (pctDiff - 0.10) / 0.40
  }

  // Product match: Jaccard similarity on description keywords
  let productScore = 0.5 // Default if no product to compare
  if (eventData.description) {
    const predProducts = (prediction.predicted_products || [])
      .map(p => p.description)
      .join(' ')
    const predKeywords = extractKeywords(predProducts)
    const eventKeywords = extractKeywords(eventData.description)
    if (predKeywords.size > 0 && eventKeywords.size > 0) {
      productScore = jaccard(predKeywords, eventKeywords)
    }
  }

  const overall = 0.4 * timingScore + 0.3 * valueScore + 0.3 * productScore

  return {
    overall: Math.round(overall * 100) / 100,
    timing_match: Math.round(timingScore * 100) / 100,
    value_match: Math.round(valueScore * 100) / 100,
    product_match: Math.round(productScore * 100) / 100,
    days_diff: daysDiff,
    value_diff_pct: prediction.predicted_value_usd && eventData.value_usd
      ? Math.round(Math.abs(eventData.value_usd - prediction.predicted_value_usd) / prediction.predicted_value_usd * 100)
      : null,
  }
}

/**
 * Extract matchable data from a workflow event payload
 */
function extractEventData(event) {
  const p = event.payload || {}
  return {
    supplier: p.supplier || p.proveedor || p.cve_proveedor || null,
    value_usd: Number(p.valor_usd || p.value_usd || p.importe || 0) || null,
    description: p.descripcion || p.descripcion_mercancia || p.products || p.subject || null,
    num_pedido: p.num_pedido || null,
    peso: Number(p.peso || p.peso_bruto || 0) || null,
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`🎯 PO Matcher — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Step 1: Fetch pending workflow events that could contain PO data
  const { data: events, error: evErr } = await supabase.from('workflow_events')
    .select('*')
    .eq('status', 'pending')
    .in('event_type', ['email_processed'])
    .order('created_at', { ascending: true })
    .limit(50)

  if (evErr) {
    console.error('Failed to fetch events:', evErr.message)
    await tg(`🔴 <b>${SCRIPT_NAME}</b> — no pudo leer workflow_events: ${evErr.message}`)
    process.exit(1)
  }

  if (!events || events.length === 0) {
    console.log('  Sin eventos pendientes.')
    return
  }
  console.log(`  ${events.length} eventos pendientes`)

  let matched = 0
  let escalated = 0
  let noMatch = 0

  for (const event of events) {
    const eventData = extractEventData(event)
    if (!eventData.supplier) {
      // No supplier in payload — skip, mark completed
      if (!DRY_RUN) await updateEventStatus(event.id, 'completed', { error_message: 'no supplier in payload' })
      continue
    }

    console.log(`  📨 ${event.event_type}: ${eventData.supplier.substring(0, 25)} · ${event.company_id}`)

    // Step 2: Find active predictions for this company + supplier
    const supplierSearch = eventData.supplier.substring(0, 15).toLowerCase()
    const { data: predictions } = await supabase.from('po_predictions')
      .select('*')
      .eq('company_id', event.company_id)
      .eq('status', 'active')
      .ilike('supplier', `%${supplierSearch}%`)
      .order('predicted_date', { ascending: true })
      .limit(5)

    if (!predictions || predictions.length === 0) {
      console.log(`    → Sin predicciones activas para ${supplierSearch}`)
      if (!DRY_RUN) await updateEventStatus(event.id, 'completed', { error_message: 'no matching predictions' })
      noMatch++
      continue
    }

    // Step 3: Score each prediction, pick the best
    let bestPred = null
    let bestScore = null

    for (const pred of predictions) {
      const score = scoreMatch(pred, eventData)
      if (!bestScore || score.overall > bestScore.overall) {
        bestPred = pred
        bestScore = score
      }
    }

    console.log(`    → Mejor match: ${bestScore.overall} (timing=${bestScore.timing_match} value=${bestScore.value_match} product=${bestScore.product_match})`)

    // Step 4: Act based on match score
    if (bestScore.overall >= 0.80) {
      // HIGH MATCH — auto-confirm
      matched++
      console.log(`    ✅ Match confirmado (${bestScore.overall})`)

      if (!DRY_RUN) {
        // Update prediction to matched
        await supabase.from('po_predictions').update({
          status: 'matched',
          matched_trafico: event.trigger_id || null,
          matched_at: new Date().toISOString(),
          match_score: bestScore.overall,
          match_details: bestScore,
          actual_date: new Date().toISOString().split('T')[0],
          actual_value_usd: eventData.value_usd,
          timing_error_days: bestScore.days_diff,
          value_error_pct: bestScore.value_diff_pct,
          updated_at: new Date().toISOString(),
        }).eq('id', bestPred.id)

        // Log accuracy
        await supabase.from('po_prediction_accuracy').insert({
          company_id: event.company_id,
          supplier: bestPred.supplier,
          prediction_id: bestPred.id,
          predicted_date: bestPred.predicted_date,
          actual_date: new Date().toISOString().split('T')[0],
          timing_error_days: bestScore.days_diff,
          predicted_value_usd: bestPred.predicted_value_usd,
          actual_value_usd: eventData.value_usd,
          value_error_pct: bestScore.value_diff_pct,
          product_match_pct: Math.round(bestScore.product_match * 100),
          overall_score: bestScore.overall,
        }).catch(() => {})

        await updateEventStatus(event.id, 'completed', { po_match_id: bestPred.id })
      }

      await tg(
        `✅ <b>PO confirmado</b>\n\n` +
        `${event.company_id}/${bestPred.supplier.substring(0, 25)}\n` +
        `Predicción: ${bestPred.predicted_date} · Real: hoy\n` +
        `Match: ${(bestScore.overall * 100).toFixed(0)}%\n` +
        `Error timing: ${bestScore.days_diff}d · Error valor: ${bestScore.value_diff_pct || '?'}%\n\n` +
        `— CRUZ 🎯`
      )

    } else if (bestScore.overall >= 0.50) {
      // PARTIAL MATCH — escalate with diff
      escalated++
      console.log(`    ⚠ Match parcial (${bestScore.overall}) — escalando`)

      const diffLines = []
      if (bestScore.days_diff > 3) diffLines.push(`Timing: esperado ${bestPred.predicted_date}, llegó ${bestScore.days_diff}d después`)
      if (bestScore.value_diff_pct > 10) diffLines.push(`Valor: esperado ~$${bestPred.predicted_value_usd} USD, recibido ~$${eventData.value_usd || '?'} USD (${bestScore.value_diff_pct}% dif)`)
      if (bestScore.product_match < 0.5) diffLines.push(`Producto: descripción no coincide bien`)

      if (!DRY_RUN) {
        await updateEventStatus(event.id, 'completed', { po_match_partial: bestPred.id })
      }

      await tg(
        `⚠ <b>PO parcial — revisar</b>\n\n` +
        `${event.company_id}/${bestPred.supplier.substring(0, 25)}\n` +
        `Match: ${(bestScore.overall * 100).toFixed(0)}%\n\n` +
        `Diferencias:\n` +
        diffLines.map(l => `• ${l}`).join('\n') + '\n\n' +
        `Acción: Eloisa confirme si es el mismo envío.\n\n` +
        `— CRUZ 🎯`
      )

    } else {
      // NO MATCH — normal flow
      noMatch++
      console.log(`    ❌ Sin match significativo (${bestScore.overall})`)
      if (!DRY_RUN) {
        await updateEventStatus(event.id, 'completed', { po_match_none: true })
      }
    }
  }

  // Summary
  const summary = `🎯 <b>PO Matcher — Resumen</b>\n\n` +
    `${events.length} eventos procesados\n` +
    `${matched} confirmados (≥80%)\n` +
    `${escalated} parciales (50-79%)\n` +
    `${noMatch} sin match\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 🎯`

  if (matched > 0 || escalated > 0) {
    await tg(summary)
  }

  // Heartbeat log
  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: { events: events.length, matched, escalated, noMatch, duration_ms: Date.now() - startTime },
    }).catch(() => {})
  }

  console.log(`\n✅ ${events.length} eventos · ${matched} matched · ${escalated} escalated · ${noMatch} no-match · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
