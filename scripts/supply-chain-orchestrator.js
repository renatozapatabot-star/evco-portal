#!/usr/bin/env node

// ============================================================
// CRUZ Supply Chain Orchestrator — clear before arrival
//
// Processing doesn't happen when the shipment arrives.
// Processing happened before it arrived.
//
// Phase 1: PREDICT — estimate arrival, score readiness
// Phase 2: PRE-STAGE — auto-solicit docs, pre-fill drafts
// Phase 3: OPTIMIZE — select bridge + time window
// Phase 4: NOTIFY — Telegram summary to operations
//
// Cron: 0 7 * * 1-6 (weekdays 7 AM before ops start)
// ============================================================

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
const TELEGRAM_CHAT = '-5085543275'

const REQUIRED_DOCS = ['FACTURA', 'COVE', 'PEDIMENTO']

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(e => console.error('[telegram]', e.message))
}

async function main() {
  console.log(`🔄 CRUZ Supply Chain Orchestrator — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const fxData = await getExchangeRate()
  if (!fxData?.rate) throw new Error('Exchange rate unavailable from system_config — refusing to calculate with stale data')
  exchangeRate = fxData.rate
  console.log(`  TC: ${exchangeRate}`)

  // Fetch active tráficos
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, proveedores, descripcion_mercancia, pedimento, fecha_llegada, fecha_cruce, importe_total, regimen, transportista_mexicano')
    .gte('fecha_llegada', '2024-01-01')
    .is('fecha_cruce', null) // not yet crossed
    .order('fecha_llegada', { ascending: false })
    .limit(500)

  if (!traficos || traficos.length === 0) {
    console.log('  No active tráficos found')
    await sendTelegram('🔄 Orchestrator: sin tráficos activos. — CRUZ 🦀')
    process.exit(0)
  }

  const active = traficos.filter(t => {
    const s = (t.estatus || '').toLowerCase()
    return !s.includes('cruz') && !s.includes('complet') && !s.includes('cancel')
  })

  console.log(`  ${active.length} tráficos activos de ${traficos.length} total`)

  // Historical crossing times by supplier for prediction
  const { data: historicalCrossings } = await supabase
    .from('traficos')
    .select('proveedores, fecha_llegada, fecha_cruce')
    .not('fecha_cruce', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(2000)

  const supplierAvgDays = {}
  for (const h of (historicalCrossings || [])) {
    if (!h.fecha_llegada || !h.fecha_cruce) continue
    const supplier = (h.proveedores || '').split(',')[0]?.trim()
    if (!supplier) continue
    const days = (new Date(h.fecha_cruce).getTime() - new Date(h.fecha_llegada).getTime()) / 86400000
    if (days < 0 || days > 60) continue
    if (!supplierAvgDays[supplier]) supplierAvgDays[supplier] = { sum: 0, count: 0 }
    supplierAvgDays[supplier].sum += days
    supplierAvgDays[supplier].count++
  }

  let staged = 0
  let zeroTouchCount = 0
  let docsRequested = 0
  const results = []

  for (const t of active) {
    const supplier = (t.proveedores || '').split(',')[0]?.trim() || 'unknown'
    const orch = {
      predicted_crossing: null,
      docs_ready: 0,
      docs_needed: REQUIRED_DOCS.length,
      missing_docs: [],
      zero_touch_score: 0,
      optimal_bridge: null,
      optimal_time: null,
      estimated_duties_mxn: 0,
      pre_staged_at: new Date().toISOString(),
      actions_taken: [],
    }

    // ── Phase 1: PREDICT ──
    const avg = supplierAvgDays[supplier]
    if (avg && avg.count >= 3 && t.fecha_llegada) {
      const avgDays = Math.round(avg.sum / avg.count)
      const predicted = new Date(new Date(t.fecha_llegada).getTime() + avgDays * 86400000)
      orch.predicted_crossing = predicted.toISOString().split('T')[0]
    }

    // Document readiness
    const { data: docs } = await supabase
      .from('expediente_documentos')
      .select('doc_type')
      .eq('pedimento_id', t.trafico)
      .limit(20)

    const existingTypes = new Set((docs || []).map(d => (d.doc_type || '').toUpperCase()))
    orch.docs_ready = REQUIRED_DOCS.filter(d => existingTypes.has(d)).length
    orch.missing_docs = REQUIRED_DOCS.filter(d => !existingTypes.has(d))

    // Zero-touch score
    let score = 0
    if (t.pedimento) score += 30
    if (orch.missing_docs.length === 0) score += 25
    if (supplier !== 'unknown') score += 15
    const regimen = (t.regimen || '').toUpperCase()
    if (regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD') score += 10
    if (orch.predicted_crossing) score += 10
    if (orch.docs_ready >= 2) score += 10
    orch.zero_touch_score = Math.min(100, score)

    // ── Phase 2: PRE-STAGE ──
    if (orch.missing_docs.length > 0) {
      orch.actions_taken.push(`missing_docs_flagged: ${orch.missing_docs.join(',')}`)
      docsRequested += orch.missing_docs.length
    }

    // ── Phase 3: OPTIMIZE ──
    // Default optimal crossing: 6-8 AM weekdays via World Trade
    orch.optimal_bridge = 'World Trade'
    orch.optimal_time = '06:00-08:00'

    // Estimate duties
    const value = Number(t.importe_total) || 0
    const valorMXN = value * exchangeRate
    const dta = Math.round(valorMXN * 0.008)
    const igiRate = (regimen === 'IMD') ? 0 : 0.05
    const igi = Math.round(valorMXN * igiRate)
    const iva = Math.round((valorMXN + dta + igi) * 0.16)
    orch.estimated_duties_mxn = dta + igi + iva

    // ── Save orchestration status ──
    if (!DRY_RUN) {
      await supabase
        .from('traficos')
        .update({ orchestration_status: orch })
        .eq('trafico', t.trafico)
    }

    staged++
    if (orch.zero_touch_score >= 90) zeroTouchCount++

    const icon = orch.zero_touch_score >= 90 ? '✅' : orch.missing_docs.length > 0 ? '📄' : '🔄'
    console.log(`  ${icon} ${t.trafico.padEnd(20)} Score: ${orch.zero_touch_score} · Docs: ${orch.docs_ready}/${orch.docs_needed} · Crossing: ${orch.predicted_crossing || '—'}`)

    results.push({ trafico: t.trafico, score: orch.zero_touch_score, missing: orch.missing_docs })
  }

  // ── Phase 4: NOTIFY ──
  const lines = [
    `🔄 <b>Orquestación CRUZ</b>`,
    ``,
    `📊 ${staged} tráficos pre-procesados`,
    `✅ ${zeroTouchCount} zero-touch (score ≥90)`,
    `📄 ${docsRequested} documentos pendientes`,
    ``,
  ]

  if (zeroTouchCount > 0) {
    lines.push(`<b>Listos para cruce automático:</b>`)
    results.filter(r => r.score >= 90).slice(0, 5).forEach(r => {
      lines.push(`  ✅ ${r.trafico} (${r.score})`)
    })
    lines.push(``)
  }

  const blockers = results.filter(r => r.missing.length > 0).slice(0, 5)
  if (blockers.length > 0) {
    lines.push(`<b>Requieren documentos:</b>`)
    blockers.forEach(r => {
      lines.push(`  📄 ${r.trafico}: ${r.missing.join(', ')}`)
    })
  }

  lines.push(``, `— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))

  console.log(`\n✅ ${staged} staged · ${zeroTouchCount} zero-touch · ${docsRequested} docs pending`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
