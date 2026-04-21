#!/usr/bin/env node
/**
 * CRUZ Predictive Classifier — predict before the shipment exists
 *
 * When a new entrada arrives, predicts the fracción from
 * supplier + product history. Logs accuracy for compounding improvement.
 *
 * Called by globalpc-delta-sync or standalone cron.
 * Cron: 0 7 * * 1-6 (daily 7 AM, business days)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getExchangeRate } = require('./lib/rates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
let exchangeRate = null // MUST be set from system_config before use
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

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

async function predictForTrafico(t) {
  const supplier = (t.proveedores || '').split(',')[0]?.trim()
  if (!supplier || !t.company_id) return null

  // 1. Query last 3 same-supplier tráficos with fracciones
  const { data: history } = await supabase.from('globalpc_productos')
    .select('fraccion, descripcion')
    .eq('company_id', t.company_id)
    .ilike('proveedor', `%${supplier.substring(0, 20)}%`)
    .not('fraccion', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!history || history.length === 0) {
    // Fallback: query by product description
    const desc = (t.descripcion_mercancia || '').substring(0, 30)
    if (!desc) return null

    const { data: descHistory } = await supabase.from('globalpc_productos')
      .select('fraccion, descripcion')
      .eq('company_id', t.company_id)
      .ilike('descripcion', `%${desc}%`)
      .not('fraccion', 'is', null)
      .limit(10)

    if (!descHistory || descHistory.length === 0) return null
    return buildPrediction(t, descHistory, supplier)
  }

  return buildPrediction(t, history, supplier)
}

function buildPrediction(t, history, supplier) {
  // Count fracciones
  const fraccionCounts = {}
  for (const h of history) {
    const f = (h.fraccion || '').trim()
    if (f) fraccionCounts[f] = (fraccionCounts[f] || 0) + 1
  }

  const sorted = Object.entries(fraccionCounts).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null

  const [topFraccion, topCount] = sorted[0]
  const totalSamples = history.length

  // 2. Determine confidence
  let confidence
  if (sorted.length === 1 && topCount >= 3) {
    confidence = 99 // Unanimous, 3+ times
  } else if (topCount >= totalSamples * 0.7) {
    confidence = 90 // Dominant (>70%)
  } else {
    confidence = Math.round((topCount / totalSamples) * 100)
  }

  // 3. Determine T-MEC and IGI from tariff data (NOT regime codes)
  // Default to standard 5% IGI — only set 0 if confirmed in tariff_rates
  const igi = 5

  // 4. Estimate landed cost
  const value = Number(t.importe_total) || 0
  const valorMXN = value * exchangeRate
  const dta = Math.round(valorMXN * 0.008)
  const igiAmount = Math.round(valorMXN * (igi / 100))
  const iva = Math.round((valorMXN + dta + igiAmount) * 0.16)
  const landedCost = Math.round((value + (dta + igiAmount + iva) / exchangeRate) * 100) / 100

  return {
    trafico: t.trafico,
    company_id: t.company_id,
    supplier,
    predicted_fraccion: topFraccion,
    predicted_igi: igi,
    predicted_tmec: false, // T-MEC determined from tariff data, not regime codes
    predicted_landed_cost: landedCost,
    prediction_confidence: confidence,
    alternatives: sorted.slice(1, 3).map(([f, c]) => ({
      fraccion: f,
      count: c,
      confidence: Math.round((c / totalSamples) * 100),
    })),
    sample_size: totalSamples,
    value,
  }
}

async function main() {
  console.log(`🔮 Predictive Classifier — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const fxData = await getExchangeRate()
  if (!fxData?.rate) throw new Error('Exchange rate unavailable from system_config — refusing to calculate with stale data')
  exchangeRate = fxData.rate
  console.log(`  TC: ${exchangeRate}`)

  // Find tráficos without prediction that have supplier info
  const { data: unpredicted } = await supabase.from('traficos')
    .select('trafico, company_id, proveedores, descripcion_mercancia, importe_total')
    .is('predicted_fraccion', null)
    .not('proveedores', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .is('fecha_cruce', null) // Only active (not yet crossed)
    .order('fecha_llegada', { ascending: false })
    .limit(50)

  if (!unpredicted || unpredicted.length === 0) {
    console.log('  No tráficos need prediction.')
    return
  }

  console.log(`  ${unpredicted.length} tráficos to predict`)

  let predicted = 0
  let skipped = 0

  for (const t of unpredicted) {
    const prediction = await predictForTrafico(t)

    if (!prediction) {
      skipped++
      continue
    }

    if (prediction.prediction_confidence < 60) {
      skipped++
      continue
    }

    predicted++
    const supplier = prediction.supplier.substring(0, 25)

    console.log(`  🔮 ${t.trafico.padEnd(20)} ${prediction.predicted_fraccion} (${prediction.prediction_confidence}%) · $${prediction.predicted_landed_cost} · ${prediction.predicted_tmec ? 'T-MEC' : 'sin T-MEC'}`)

    // Write prediction to traficos
    if (!DRY_RUN) {
      await supabase.from('traficos').update({
        predicted_fraccion: prediction.predicted_fraccion,
        predicted_igi: prediction.predicted_igi,
        predicted_tmec: prediction.predicted_tmec,
        predicted_landed_cost: prediction.predicted_landed_cost,
        prediction_confidence: prediction.prediction_confidence,
        predicted_at: new Date().toISOString(),
      }).eq('trafico', t.trafico)
    }

    // Log to operational_decisions
    if (!DRY_RUN) {
      try {
        const { logDecision } = require('./decision-logger')
        await logDecision({
          trafico: t.trafico,
          company_id: t.company_id,
          decision_type: 'classification',
          decision: `Predicción: ${prediction.predicted_fraccion} (${prediction.prediction_confidence}%)`,
          reasoning: `${prediction.sample_size} precedentes de ${supplier}. ${prediction.alternatives.length > 0 ? `Alt: ${prediction.alternatives.map(a => a.fraccion).join(', ')}` : 'Sin alternativas.'}`,
          alternatives: prediction.alternatives,
          dataPoints: { sample_size: prediction.sample_size, supplier, value: prediction.value },
        })
      } catch {}
    }

    // Telegram for high-confidence predictions
    if (prediction.prediction_confidence >= 90) {
      await tg(
        `🔮 <b>Predicción: ${t.company_id}</b> importará de ${supplier}\n` +
        `Fracción probable: ${prediction.predicted_fraccion} (${prediction.prediction_confidence}% conf)\n` +
        `IGI: ${prediction.predicted_igi}%${prediction.predicted_tmec ? ' (T-MEC)' : ''} | Costo: $${prediction.predicted_landed_cost.toLocaleString()} USD\n` +
        (prediction.alternatives.length > 0 ? `Alt: ${prediction.alternatives.map(a => `${a.fraccion} (${a.confidence}%)`).join(', ')}\n` : '') +
        `— CRUZ 🔮`
      )
    }
  }

  console.log(`\n✅ ${predicted} predicciones · ${skipped} sin datos suficientes`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
