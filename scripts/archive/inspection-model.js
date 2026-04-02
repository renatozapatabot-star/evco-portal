#!/usr/bin/env node
// scripts/inspection-model.js — BUILD 3 PHASE 4
// Inspection Risk Model — predict semáforo rojo probability
// Uses globalpc_eventos to find historical inspections as training labels
// Cron: 0 5 * * * (daily 5 AM)

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

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🚦 INSPECTION RISK MODEL — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  // Step 1: Find all inspection events (training labels)
  console.log('\n🔍 Finding historical inspections...')
  const { data: eventos } = await supabase.from('globalpc_eventos')
    .select('cve_trafico, evento, fecha')
    .or('evento.ilike.%reconocimiento%,evento.ilike.%inspeccion%,evento.ilike.%semaforo rojo%,evento.ilike.%dictamen%,evento.ilike.%rojo%')
    .limit(5000)

  const inspectedTraficos = new Set((eventos || []).map(e => e.cve_trafico))
  console.log(`  ${inspectedTraficos.size} tráficos with inspection events`)

  // Step 2: Load all completed tráficos with features
  console.log('\n📊 Loading training data...')
  let traficos = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('trafico, company_id, transportista_extranjero, regimen, peso_bruto, fecha_cruce, descripcion_mercancia')
      .ilike('estatus', '%cruz%')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    traficos = traficos.concat(data)
    offset += 1000
    if (data.length < 1000) break
  }
  console.log(`  ${traficos.length} completed tráficos loaded`)

  // Load facturas for value features
  const { data: facturas } = await supabase.from('globalpc_facturas')
    .select('cve_trafico, proveedor, valor')
    .limit(10000)

  // Load productos for chapter features
  const { data: productos } = await supabase.from('globalpc_productos')
    .select('cve_trafico, fraccion, valor_unitario, cantidad')
    .limit(10000)

  // Step 3: Build feature matrix
  console.log('\n🔬 Building feature matrix...')

  // Carrier inspection rates
  const carrierTotal = {}
  const carrierInspected = {}
  for (const t of traficos) {
    const carrier = (t.transportista_extranjero || 'UNKNOWN').toUpperCase().trim()
    carrierTotal[carrier] = (carrierTotal[carrier] || 0) + 1
    if (inspectedTraficos.has(t.trafico)) {
      carrierInspected[carrier] = (carrierInspected[carrier] || 0) + 1
    }
  }
  const carrierRates = {}
  for (const [c, total] of Object.entries(carrierTotal)) {
    carrierRates[c] = {
      rate: (carrierInspected[c] || 0) / total,
      total,
      inspected: carrierInspected[c] || 0,
    }
  }

  // Day of week inspection rates
  const dowTotal = {}
  const dowInspected = {}
  for (const t of traficos) {
    if (!t.fecha_cruce) continue
    const dow = new Date(t.fecha_cruce).getDay()
    dowTotal[dow] = (dowTotal[dow] || 0) + 1
    if (inspectedTraficos.has(t.trafico)) {
      dowInspected[dow] = (dowInspected[dow] || 0) + 1
    }
  }
  const dowRates = {}
  for (const [d, total] of Object.entries(dowTotal)) {
    dowRates[d] = (dowInspected[d] || 0) / total
  }

  // Chapter inspection rates
  const chapterTotal = {}
  const chapterInspected = {}
  for (const p of (productos || [])) {
    if (!p.fraccion) continue
    const chapter = p.fraccion.substring(0, 2)
    chapterTotal[chapter] = (chapterTotal[chapter] || 0) + 1
    if (inspectedTraficos.has(p.cve_trafico)) {
      chapterInspected[chapter] = (chapterInspected[chapter] || 0) + 1
    }
  }
  const chapterRates = {}
  for (const [ch, total] of Object.entries(chapterTotal)) {
    chapterRates[ch] = (chapterInspected[ch] || 0) / total
  }

  // Supplier frequency (new supplier = higher risk)
  const supplierFreq = {}
  for (const f of (facturas || [])) {
    const prov = (f.proveedor || 'UNKNOWN').toUpperCase().trim()
    supplierFreq[prov] = (supplierFreq[prov] || 0) + 1
  }

  // Value per kg baseline
  const vpkValues = []
  for (const t of traficos) {
    const tFacturas = (facturas || []).filter(f => f.cve_trafico === t.trafico)
    const totalVal = tFacturas.reduce((s, f) => s + (f.valor || 0), 0)
    if (totalVal > 0 && t.peso_bruto > 0) {
      vpkValues.push(totalVal / t.peso_bruto)
    }
  }
  const vpkAvg = vpkValues.length > 0 ? vpkValues.reduce((a, b) => a + b, 0) / vpkValues.length : 1
  const vpkStd = vpkValues.length > 1
    ? Math.sqrt(vpkValues.reduce((s, v) => s + (v - vpkAvg) ** 2, 0) / vpkValues.length)
    : vpkAvg

  // Overall inspection rate
  const overallRate = traficos.length > 0 ? inspectedTraficos.size / traficos.length : 0.1
  console.log(`  Overall inspection rate: ${(overallRate * 100).toFixed(1)}%`)
  console.log(`  Carrier segments: ${Object.keys(carrierRates).length}`)
  console.log(`  Chapter segments: ${Object.keys(chapterRates).length}`)

  // Top inspected carriers
  const topCarriers = Object.entries(carrierRates)
    .filter(([, v]) => v.total >= 5)
    .sort((a, b) => b[1].rate - a[1].rate)
    .slice(0, 5)
  console.log('\n  Top inspected carriers:')
  for (const [name, stats] of topCarriers) {
    console.log(`    ${name}: ${(stats.rate * 100).toFixed(1)}% (${stats.inspected}/${stats.total})`)
  }

  // Step 4: Score active tráficos
  console.log('\n🔮 Scoring active tráficos...')
  const { data: active } = await supabase.from('traficos')
    .select('trafico, company_id, transportista_extranjero, peso_bruto, fecha_llegada, descripcion_mercancia')
    .not('estatus', 'ilike', '%cruz%')
    .not('fecha_llegada', 'is', null)
    .limit(500)

  let scored = 0
  const highRisk = []

  for (const t of (active || [])) {
    const carrier = (t.transportista_extranjero || 'UNKNOWN').toUpperCase().trim()
    const dow = new Date().getDay()

    // Get products for this tráfico
    const tProds = (productos || []).filter(p => p.cve_trafico === t.trafico)
    const tFacts = (facturas || []).filter(f => f.cve_trafico === t.trafico)
    const totalVal = tFacts.reduce((s, f) => s + (f.valor || 0), 0)

    // Feature contributions to inspection probability
    let probability = overallRate // base rate

    // Carrier factor (weight: 30%)
    const carrierRate = carrierRates[carrier]?.rate || overallRate
    probability = probability * 0.7 + carrierRate * 0.3

    // Day of week factor (weight: 10%)
    const dowRate = dowRates[dow] || overallRate
    probability = probability * 0.9 + dowRate * 0.1

    // Chapter factor (weight: 25%)
    const chapters = [...new Set(tProds.map(p => p.fraccion?.substring(0, 2)).filter(Boolean))]
    if (chapters.length > 0) {
      const maxChapterRate = Math.max(...chapters.map(ch => chapterRates[ch] || overallRate))
      probability = probability * 0.75 + maxChapterRate * 0.25
    }

    // Value per kg anomaly (weight: 15%)
    if (totalVal > 0 && t.peso_bruto > 0) {
      const vpk = totalVal / t.peso_bruto
      const zScore = Math.abs(vpk - vpkAvg) / (vpkStd || 1)
      if (zScore > 2) probability *= 1.3
      if (zScore > 3) probability *= 1.5
    }

    // New supplier flag (weight: 10%)
    for (const f of tFacts) {
      const prov = (f.proveedor || 'UNKNOWN').toUpperCase().trim()
      if ((supplierFreq[prov] || 0) < 3) {
        probability *= 1.2 // 20% boost for new supplier
        break
      }
    }

    // Cap at 95%
    probability = Math.min(0.95, Math.max(0.01, probability))
    const pctProb = Math.round(probability * 100)

    // Build risk factors
    const riskFactors = []
    if (carrierRate > overallRate * 1.5) riskFactors.push(`Carrier ${carrier} high inspection history`)
    if (chapters.some(ch => (chapterRates[ch] || 0) > overallRate * 1.5)) riskFactors.push('High-risk HTS chapter')
    if (totalVal > 0 && t.peso_bruto > 0) {
      const vpk = totalVal / t.peso_bruto
      if (Math.abs(vpk - vpkAvg) / (vpkStd || 1) > 2) riskFactors.push('Unusual value-per-kg ratio')
    }
    for (const f of tFacts) {
      const prov = (f.proveedor || 'UNKNOWN').toUpperCase().trim()
      if ((supplierFreq[prov] || 0) < 3) { riskFactors.push('New/infrequent supplier'); break }
    }

    // Update crossing_predictions with inspection probability
    await supabase.from('crossing_predictions').upsert({
      trafico_id: t.trafico,
      company_id: t.company_id || 'evco',
      inspection_probability: pctProb,
      inspection_risk_factors: riskFactors,
      predicted_at: new Date().toISOString(),
    }, { onConflict: 'trafico_id' }).catch(() => {
      // Table might not have these columns yet — try crossing_intelligence
      supabase.from('crossing_intelligence').upsert({
        trafico_id: t.trafico,
        company_id: t.company_id || 'evco',
        inspection_probability: pctProb,
        inspection_risk_factors: riskFactors,
      }, { onConflict: 'trafico_id' }).catch(() => {})
    })

    if (pctProb > 25) highRisk.push({ trafico: t.trafico, probability: pctProb, factors: riskFactors })
    scored++
  }

  console.log(`  ${scored} tráficos scored`)
  console.log(`  ${highRisk.length} high-risk (>25% inspection probability)`)

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log('INSPECTION MODEL COMPLETE')
  console.log('═'.repeat(55))
  console.log(`Historical inspections: ${inspectedTraficos.size}`)
  console.log(`Overall inspection rate: ${(overallRate * 100).toFixed(1)}%`)
  console.log(`Active scored: ${scored}`)
  console.log(`High risk: ${highRisk.length}`)
  console.log(`Time: ${elapsed}s`)

  // ── Telegram (only if high-risk found) ─────────────
  if (highRisk.length > 0) {
    const hrList = highRisk.slice(0, 5).map(h =>
      `• ${h.trafico}: ${h.probability}% — ${h.factors[0] || 'multiple factors'}`
    ).join('\n')

    await sendTG(`🚦 <b>INSPECTION RISK ALERT</b>
━━━━━━━━━━━━━━━━━━━━━
${highRisk.length} tráficos with >25% inspection probability:

${hrList}

Overall rate: ${(overallRate * 100).toFixed(1)}%
Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`)
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
