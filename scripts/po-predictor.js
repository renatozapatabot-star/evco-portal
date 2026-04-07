#!/usr/bin/env node
/**
 * CRUZ PO Predictor — predict WHAT is coming, not just WHEN
 *
 * Extends demand-predictor.js with:
 * 1. Value prediction (weighted moving avg of last 5 shipments)
 * 2. Product prediction (most common products + fracciones)
 * 3. Duty pre-calculation (DTA + IGI + IVA from system_config)
 * 4. Optimal crossing window (from crossing_windows table)
 * 5. Pre-staging: creates staged_traficos for high-confidence predictions
 * 6. Lifecycle: active → matched/expired/missed
 *
 * For each client+supplier pair with 5+ historical operations.
 *
 * Cron: 0 6 * * 1 (weekly Monday 6 AM, runs after demand-predictor)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getAllRates } = require('./lib/rates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'po-predictor'

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

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1))
}

function weightedAvg(arr) {
  // More recent values weighted higher: [1, 2, 3, 4, 5] for last 5
  if (arr.length === 0) return 0
  const weights = arr.map((_, i) => i + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  return arr.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function fmtDate(d) {
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}

function fmtCurrency(val) {
  return val >= 1000 ? `$${(val / 1000).toFixed(1)}K` : `$${val.toFixed(0)}`
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`🔮 PO Predictor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Step 1: Fetch all rates (refuses if expired)
  let rates
  try {
    rates = await getAllRates()
    console.log(`  TC: ${rates.exchangeRate} · DTA A1: ${rates.dtaRates?.A1?.rate || '?'} · IVA: ${rates.ivaRate}`)
  } catch (err) {
    await tg(`🔴 <b>${SCRIPT_NAME}</b> — rates expired: ${err.message}`)
    console.error('Rates expired:', err.message)
    process.exit(1)
  }

  // Step 2: Fetch tráficos with supplier + dates (full historical for patterns)
  const { data: allTraficos, error: tErr } = await supabase.from('traficos')
    .select('trafico, company_id, proveedores, descripcion_mercancia, fecha_llegada, importe_total, peso_bruto')
    .not('proveedores', 'is', null)
    .not('fecha_llegada', 'is', null)
    .gte('fecha_llegada', '2023-01-01')
    .order('fecha_llegada', { ascending: true })
    .limit(10000)

  if (tErr || !allTraficos?.length) {
    console.log('  No tráficos with supplier data.')
    await tg(`🔮 <b>${SCRIPT_NAME}</b> — sin datos de tráficos.`)
    return
  }
  console.log(`  ${allTraficos.length} tráficos cargados`)

  // Step 3: Fetch financial data (dedup by referencia to avoid 15x inflation)
  const { data: allFacturas } = await supabase.from('aduanet_facturas')
    .select('referencia, clave_cliente, proveedor, valor_usd, dta, igi, iva, fecha_pago')
    .not('proveedor', 'is', null)
    .not('valor_usd', 'is', null)
    .gte('fecha_pago', '2023-01-01')
    .limit(10000)

  // Dedup facturas by referencia
  const seenRef = new Set()
  const facturas = (allFacturas || []).filter(f => {
    if (!f.referencia || seenRef.has(f.referencia)) return false
    seenRef.add(f.referencia)
    return true
  })
  console.log(`  ${facturas.length} facturas (deduped from ${allFacturas?.length || 0})`)

  // Step 4: Fetch crossing windows for optimal DOW
  const { data: crossingWindows } = await supabase.from('crossing_windows')
    .select('company_id, day_of_week, avg_crossing_days, sample_count')

  const cwMap = new Map()
  for (const cw of crossingWindows || []) {
    const key = `${cw.company_id}::${cw.day_of_week}`
    cwMap.set(key, cw)
  }

  // Step 5: Group tráficos by company_id::supplier
  const pairs = new Map()
  for (const t of allTraficos) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue
    const key = `${t.company_id}::${supplier}`
    if (!pairs.has(key)) pairs.set(key, [])
    pairs.get(key).push(t)
  }

  // Group facturas by clave_cliente::proveedor (first 30 chars for matching)
  const facturaMap = new Map()
  for (const f of facturas) {
    const supplierKey = (f.proveedor || '').substring(0, 30).trim().toLowerCase()
    const key = `${f.clave_cliente}::${supplierKey}`
    if (!facturaMap.has(key)) facturaMap.set(key, [])
    facturaMap.get(key).push(f)
  }

  // Step 6: Generate predictions
  const predictions = []
  const staged = []
  const today = new Date()

  for (const [key, traficos] of pairs) {
    if (traficos.length < 5) continue

    const [companyId, supplier] = key.split('::')
    traficos.sort((a, b) => (a.fecha_llegada || '').localeCompare(b.fecha_llegada || ''))

    // --- TIMING PREDICTION (same as demand-predictor) ---
    const intervals = []
    for (let i = 1; i < traficos.length; i++) {
      const prev = new Date(traficos[i - 1].fecha_llegada)
      const curr = new Date(traficos[i].fecha_llegada)
      const days = (curr.getTime() - prev.getTime()) / 86400000
      if (days > 0 && days < 180) intervals.push(days)
    }
    if (intervals.length < 3) continue

    const avgDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length * 10) / 10
    const sd = Math.round(stdDev(intervals) * 10) / 10

    let confidence
    if (sd < 3) confidence = 95
    else if (sd < 5) confidence = 85
    else if (sd < 10) confidence = 70
    else continue // Too irregular

    const lastShipment = new Date(traficos[traficos.length - 1].fecha_llegada)
    const predictedDate = new Date(lastShipment.getTime() + avgDays * 86400000)
    const predictedLow = new Date(lastShipment.getTime() + (avgDays - sd) * 86400000)
    const predictedHigh = new Date(lastShipment.getTime() + (avgDays + sd) * 86400000)

    // Skip if way overdue (> 30 days past predicted)
    if (predictedDate < today) {
      const daysOverdue = Math.round((today.getTime() - predictedDate.getTime()) / 86400000)
      if (daysOverdue > 30) continue
    }

    // --- VALUE PREDICTION (weighted moving avg of last 5) ---
    const last5 = traficos.slice(-5)
    const values = last5.map(t => Number(t.importe_total) || 0).filter(v => v > 0)

    // Also check facturas for more accurate USD values
    const supplierKey = supplier.substring(0, 30).trim().toLowerCase()
    const companyFacturas = facturaMap.get(`${companyId}::${supplierKey}`) || []
    const facturaValues = companyFacturas.slice(-5).map(f => Number(f.valor_usd) || 0).filter(v => v > 0)

    // Prefer factura USD values; fall back to trafico importe
    const valueSource = facturaValues.length >= 3 ? facturaValues : values
    const predictedValue = valueSource.length > 0 ? Math.round(weightedAvg(valueSource)) : 0
    const valueSd = Math.round(stdDev(valueSource))
    const valueLow = Math.max(0, predictedValue - valueSd)
    const valueHigh = predictedValue + valueSd

    // --- PRODUCT PREDICTION (most common from last 5) ---
    const descCounts = {}
    last5.forEach(t => {
      const d = (t.descripcion_mercancia || '').substring(0, 60).trim()
      if (d) descCounts[d] = (descCounts[d] || 0) + 1
    })
    const topProducts = Object.entries(descCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([desc]) => ({ description: desc }))

    // --- WEIGHT PREDICTION ---
    const weights = last5.map(t => Number(t.peso_bruto) || 0).filter(w => w > 0)
    const predictedWeight = weights.length > 0 ? Math.round(weightedAvg(weights) * 10) / 10 : null

    // --- IGI ESTIMATION (from historical facturas) ---
    let igiRatio = 0
    if (companyFacturas.length > 0) {
      const ratios = companyFacturas
        .filter(f => f.valor_usd > 0 && f.igi != null)
        .map(f => f.igi / f.valor_usd)
      if (ratios.length > 0) {
        igiRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length
      }
    }

    // --- DUTY PRE-CALCULATION ---
    let estimatedDuties = null
    if (predictedValue > 0) {
      try {
        const valorMXN = predictedValue * rates.exchangeRate
        const dtaRate = rates.dtaRates?.A1?.rate || 0.008
        const dta = Math.round(valorMXN * dtaRate)
        const igi = Math.round(predictedValue * igiRatio * rates.exchangeRate)
        const ivaBase = valorMXN + dta + igi // Cascading — never flat
        const iva = Math.round(ivaBase * rates.ivaRate)
        estimatedDuties = {
          valor_aduana_mxn: Math.round(valorMXN),
          dta,
          igi,
          iva,
          total_mxn: dta + igi + iva,
          exchange_rate: rates.exchangeRate,
          igi_ratio_used: Math.round(igiRatio * 10000) / 10000,
          calculated_at: new Date().toISOString(),
        }
      } catch {
        // Duty calc failed — proceed without estimate
      }
    }

    // --- OPTIMAL CROSSING WINDOW ---
    let optimalCrossing = null
    // Find best DOW (lowest avg_crossing_days) for this company
    let bestDow = null
    let bestCrossingDays = Infinity
    for (let dow = 1; dow <= 5; dow++) { // Mon-Fri only
      const cw = cwMap.get(`${companyId}::${dow}`)
      if (cw && cw.avg_crossing_days < bestCrossingDays && cw.sample_count >= 3) {
        bestCrossingDays = cw.avg_crossing_days
        bestDow = dow
      }
    }
    if (bestDow !== null) {
      optimalCrossing = {
        dow: bestDow,
        dow_name: DOW_ES[bestDow],
        estimated_hours: Math.round(bestCrossingDays * 24 * 10) / 10,
        window: '06:00-10:00', // Colombia standard
      }
    }

    // --- BUILD PREDICTION ---
    const prediction = {
      company_id: companyId,
      supplier: supplier.substring(0, 80),
      predicted_date: predictedDate.toISOString().split('T')[0],
      predicted_date_low: predictedLow.toISOString().split('T')[0],
      predicted_date_high: predictedHigh.toISOString().split('T')[0],
      avg_frequency_days: avgDays,
      std_deviation_days: sd,
      predicted_value_usd: predictedValue || null,
      value_low_usd: valueLow || null,
      value_high_usd: valueHigh || null,
      predicted_products: topProducts.length > 0 ? topProducts : null,
      predicted_weight_kg: predictedWeight,
      estimated_duties: estimatedDuties,
      optimal_crossing: optimalCrossing,
      confidence,
      sample_size: traficos.length,
      last_shipment_date: lastShipment.toISOString().split('T')[0],
      status: 'active',
    }

    predictions.push(prediction)

    // --- PRE-STAGE high-confidence predictions within 14 days ---
    const daysUntil = Math.round((predictedDate.getTime() - today.getTime()) / 86400000)
    if (confidence >= 85 && daysUntil >= -3 && daysUntil <= 14 && predictedValue > 0) {
      const topProduct = topProducts[0]?.description || supplier
      staged.push({
        company_id: companyId,
        supplier: supplier.substring(0, 80),
        descripcion_mercancia: topProduct,
        importe_total: predictedValue,
        peso_bruto: predictedWeight,
        productos: topProducts,
        estimated_duties: estimatedDuties,
        recommended_crossing: optimalCrossing,
        supplier_notification_draft:
          `Estimado proveedor,\n\n` +
          `Anticipamos una orden de compra de ${companyId.toUpperCase()} ` +
          `por aproximadamente ${fmtCurrency(predictedValue)} USD ` +
          `de ${topProduct}.\n\n` +
          `Fecha estimada de envío: ${fmtDate(predictedDate)}.\n` +
          `Por favor confirme disponibilidad.\n\n` +
          `— CRUZ Intelligence · Patente 3596`,
        carrier_alert_draft:
          `Capacidad requerida: ${DOW_ES[predictedDate.getDay()]} ` +
          `${fmtDate(predictedDate)}\n` +
          `Ruta: origen → Nuevo Laredo\n` +
          `Peso estimado: ${predictedWeight ? predictedWeight + ' kg' : 'por confirmar'}\n` +
          `Cruce recomendado: Colombia ${optimalCrossing?.window || '06:00-10:00'}`,
        status: 'staged',
        _prediction_date: prediction.predicted_date,
        _daysUntil: daysUntil,
      })
    }

    console.log(
      `  🔮 ${companyId}/${supplier.substring(0, 20).padEnd(20)} → ` +
      `${fmtDate(predictedDate)} (${confidence}%) · ` +
      `~${fmtCurrency(predictedValue)} USD · ${traficos.length} muestras` +
      (estimatedDuties ? ` · impuestos ~${fmtCurrency(estimatedDuties.total_mxn)} MXN` : '')
    )
  }

  // Step 7: Save to DB
  if (!DRY_RUN && predictions.length > 0) {
    // Upsert predictions
    for (const p of predictions) {
      const { error } = await supabase.from('po_predictions').upsert(p, {
        onConflict: 'company_id,supplier,predicted_date',
      })
      if (error) console.error(`  ⚠ Upsert failed for ${p.company_id}/${p.supplier}: ${error.message}`)
    }

    // Create staged tráficos for high-confidence predictions
    for (const s of staged) {
      // Find the prediction ID for linking
      const { data: pred } = await supabase.from('po_predictions')
        .select('id')
        .eq('company_id', s.company_id)
        .eq('supplier', s.supplier)
        .eq('predicted_date', s._prediction_date)
        .single()

      if (pred) {
        // Check if already staged
        const { data: existing } = await supabase.from('staged_traficos')
          .select('id')
          .eq('po_prediction_id', pred.id)
          .eq('status', 'staged')
          .maybeSingle()

        if (!existing) {
          const { _prediction_date, _daysUntil, ...stageData } = s
          await supabase.from('staged_traficos').insert({
            ...stageData,
            po_prediction_id: pred.id,
          })
        }
      }
    }

    // Expire old missed predictions
    const cutoff = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0]
    await supabase.from('po_predictions')
      .update({ status: 'missed', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('predicted_date', cutoff)

    // Expire old staged traficos
    await supabase.from('staged_traficos')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'staged')
      .lt('created_at', new Date(today.getTime() - 21 * 86400000).toISOString())

    // Log to learned_patterns
    for (const p of predictions.filter(pr => pr.confidence >= 85)) {
      await supabase.from('learned_patterns').upsert({
        pattern_type: 'po_prediction',
        pattern_key: `po:${p.company_id}:${p.supplier.substring(0, 20).toLowerCase().replace(/\s+/g, '_')}`,
        pattern_value: `${p.supplier} envía cada ${p.avg_frequency_days}d (±${p.std_deviation_days}d). ` +
          `Próximo: ${p.predicted_date}. Valor: ~${fmtCurrency(p.predicted_value_usd || 0)} USD. ` +
          `Impuestos: ~${fmtCurrency(p.estimated_duties?.total_mxn || 0)} MXN`,
        confidence: p.confidence / 100,
        source: SCRIPT_NAME,
        sample_size: p.sample_size,
        last_confirmed: new Date().toISOString(),
        active: true,
      }, { onConflict: 'pattern_type,pattern_key' }).catch(() => {})
    }
  }

  // Step 8: Telegram summary
  const highConf = predictions.filter(p => p.confidence >= 85)
  const preStaged = staged.filter(s => s._daysUntil >= 0 && s._daysUntil <= 7)

  if (preStaged.length > 0) {
    const lines = [
      `🔮 <b>PO Predictor: ${preStaged.length} envío(s) pre-staging esta semana</b>`,
      ``,
    ]
    for (const s of preStaged.slice(0, 5)) {
      lines.push(`📦 ${s.company_id}/${s.supplier.substring(0, 20)}`)
      lines.push(`   ${s.descripcion_mercancia.substring(0, 40)}`)
      lines.push(`   ~${fmtCurrency(s.importe_total)} USD · ${s.peso_bruto ? s.peso_bruto + ' kg' : '?'}`)
      if (s.estimated_duties) {
        lines.push(`   Impuestos: ~${fmtCurrency(s.estimated_duties.total_mxn)} MXN`)
      }
      if (s.recommended_crossing) {
        lines.push(`   Cruce: ${s.recommended_crossing.dow_name} ${s.recommended_crossing.window}`)
      }
      lines.push(``)
    }
    lines.push(`— CRUZ 🔮`)
    await tg(lines.join('\n'))
  }

  await tg(
    `🔮 <b>PO Predictor — Resumen</b>\n\n` +
    `${predictions.length} predicciones generadas\n` +
    `${highConf.length} alta confianza (≥85%)\n` +
    `${staged.length} tráficos pre-staging\n` +
    `${preStaged.length} envíos esperados esta semana\n` +
    `TC: ${rates.exchangeRate} MXN/USD\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 🔮`
  )

  // Log to heartbeat
  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status: 'success',
      details: {
        predictions: predictions.length,
        high_confidence: highConf.length,
        staged: staged.length,
        duration_ms: Date.now() - startTime,
      },
    }).catch(() => {})
  }

  console.log(`\n✅ ${predictions.length} predicciones · ${staged.length} pre-staged · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
