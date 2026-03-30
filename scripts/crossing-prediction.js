#!/usr/bin/env node
// scripts/crossing-prediction.js — FEATURE 2
// Nightly crossing prediction engine using fecha_cruce (real crossing date)
// Cron: 30 1 * * * (1:30 AM after globalpc-sync)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const COMPANY_ID = 'evco'
const MAX_HOURS = 72 // Filter outliers: anything > 72h is likely data noise

async function main() {
  console.log('🔮 Crossing Prediction Engine — CRUZ')
  const start = Date.now()

  // 1. Get completed tráficos with REAL fecha_cruce
  const { data: cruzados } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, transportista_mexicano, fecha_llegada, fecha_cruce, descripcion_mercancia')
    .eq('company_id', COMPANY_ID).ilike('estatus', '%cruz%')
    .not('fecha_llegada', 'is', null).not('fecha_cruce', 'is', null)
    .limit(3000)

  // 2. Calculate crossing hours using fecha_cruce (the real crossing timestamp)
  const carrierAvg = {}  // carrier -> {totalHours, count}
  const dowAvg = {}      // day_of_week -> {totalHours, count}
  const monthAvg = {}    // month -> {totalHours, count}
  const categoryAvg = {} // category -> {totalHours, count}
  let globalTotal = 0, globalCount = 0

  const categoryKeywords = {
    plasticos: ['plast', 'resin', 'polim', 'poly', 'pellet', 'mold'],
    quimicos: ['quim', 'chem', 'acid', 'solvent', 'paint'],
    metalicos: ['metal', 'acero', 'steel', 'alum', 'hierro'],
    textiles: ['tela', 'fabric', 'textile', 'hilo'],
    electronica: ['electr', 'circuit', 'cable', 'sensor'],
    alimentos: ['food', 'aliment', 'grain', 'cereal'],
  }

  function getCategory(desc) {
    const d = (desc || '').toLowerCase()
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => d.includes(k))) return cat
    }
    return 'general'
  }

  ;(cruzados || []).forEach(t => {
    const hours = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (hours <= 0 || hours > MAX_HOURS) return // Skip invalid or outlier data

    globalTotal += hours; globalCount++

    const carrier = t.transportista_mexicano || t.transportista_extranjero || 'UNKNOWN'
    if (!carrierAvg[carrier]) carrierAvg[carrier] = { totalHours: 0, count: 0 }
    carrierAvg[carrier].totalHours += hours; carrierAvg[carrier].count++

    const dow = new Date(t.fecha_llegada).getDay()
    if (!dowAvg[dow]) dowAvg[dow] = { totalHours: 0, count: 0 }
    dowAvg[dow].totalHours += hours; dowAvg[dow].count++

    const month = new Date(t.fecha_llegada).getMonth()
    if (!monthAvg[month]) monthAvg[month] = { totalHours: 0, count: 0 }
    monthAvg[month].totalHours += hours; monthAvg[month].count++

    const cat = getCategory(t.descripcion_mercancia)
    if (!categoryAvg[cat]) categoryAvg[cat] = { totalHours: 0, count: 0 }
    categoryAvg[cat].totalHours += hours; categoryAvg[cat].count++
  })

  const overallAvg = globalCount > 0 ? globalTotal / globalCount : 48

  console.log(`Historical data: ${globalCount} crossings ≤${MAX_HOURS}h, avg ${overallAvg.toFixed(1)}h (${(overallAvg/24).toFixed(1)}d)`)

  // Log carrier breakdown
  const carrierStats = Object.entries(carrierAvg)
    .map(([name, d]) => ({ name, avg: (d.totalHours / d.count).toFixed(1), n: d.count }))
    .sort((a, b) => Number(a.avg) - Number(b.avg))
  if (carrierStats.length > 0) {
    console.log(`Top carriers:`)
    carrierStats.slice(0, 5).forEach(c => console.log(`  ${c.name}: ${c.avg}h (n=${c.n})`))
  }

  // 3. Predict active tráficos
  const { data: active } = await supabase.from('traficos')
    .select('trafico, transportista_extranjero, transportista_mexicano, fecha_llegada, descripcion_mercancia')
    .eq('company_id', COMPANY_ID).eq('estatus', 'En Proceso')
    .not('fecha_llegada', 'is', null).limit(500)

  const predictions = []
  ;(active || []).forEach(t => {
    const carrier = t.transportista_mexicano || t.transportista_extranjero || 'UNKNOWN'
    const dow = new Date(t.fecha_llegada).getDay()
    const cat = getCategory(t.descripcion_mercancia)

    const cAvg = carrierAvg[carrier]?.count >= 3 ? carrierAvg[carrier].totalHours / carrierAvg[carrier].count : null
    const dAvg = dowAvg[dow]?.count >= 5 ? dowAvg[dow].totalHours / dowAvg[dow].count : null
    const catAvg = categoryAvg[cat]?.count >= 3 ? categoryAvg[cat].totalHours / categoryAvg[cat].count : null

    // Weighted prediction: carrier 50%, day-of-week 30%, overall 20%
    let weightedSum = overallAvg * 0.2, weights = 0.2
    if (cAvg !== null) { weightedSum += cAvg * 0.5; weights += 0.5 }
    if (dAvg !== null) { weightedSum += dAvg * 0.3; weights += 0.3 }
    let predicted = weightedSum / weights

    // Category adjustment
    if (catAvg !== null) predicted = predicted * 0.8 + catAvg * 0.2

    const predictedDate = new Date(t.fecha_llegada)
    predictedDate.setTime(predictedDate.getTime() + predicted * 3600000)

    // Confidence: 0.9 high (≥10 samples), 0.6 medium (≥3), 0.3 low
    const confidence = (cAvg !== null && (carrierAvg[carrier]?.count || 0) >= 10) ? 0.9
      : (cAvg !== null) ? 0.6 : 0.3

    predictions.push({
      trafico_id: t.trafico,
      company_id: COMPANY_ID,
      carrier,
      predicted_hours: Math.round(predicted * 10) / 10,
      predicted_date: predictedDate.toISOString().split('T')[0],
      confidence,
      category: cat,
      data_points: carrierAvg[carrier]?.count || 0,
      calculated_at: new Date().toISOString(),
    })
  })

  // 4. Save to crossing_predictions
  console.log(`Saving ${predictions.length} predictions...`)
  await supabase.from('crossing_predictions').delete().eq('company_id', COMPANY_ID)
  for (const batch of chunk(predictions, 50)) {
    await supabase.from('crossing_predictions').insert(batch)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✅ ${predictions.length} predictions · avg predicted ${overallAvg.toFixed(1)}h · ${globalCount} data points · ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
