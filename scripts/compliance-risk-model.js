#!/usr/bin/env node
/**
 * CRUZ Compliance Risk Model — predict SAT audit probability
 *
 * 5-factor quarterly risk score per client:
 * 1. Reconocimiento rate (30%)
 * 2. Value anomalies (25%)
 * 3. Document completeness (20%)
 * 4. Fracción concentration (15%)
 * 5. MVE status (10%)
 *
 * Cron: 0 5 1 1,4,7,10 * (quarterly, 1st of quarter month, 5 AM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
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

function getCurrentQuarter() {
  const now = new Date()
  const q = Math.ceil((now.getMonth() + 1) / 3)
  return `Q${q}-${now.getFullYear()}`
}

async function scoreClient(companyId, fleetRecoRate) {
  const quarterStart = new Date()
  quarterStart.setMonth(quarterStart.getMonth() - 3)
  const since = quarterStart.toISOString()

  const factors = []

  // ── Factor 1: Reconocimiento Rate (30%) ──
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, semaforo, pedimento, importe_total, regimen, descripcion_mercancia')
    .eq('company_id', companyId)
    .gte('fecha_llegada', since)
    .limit(500)

  const allT = traficos || []
  if (allT.length === 0) return null // No activity

  const withSemaforo = allT.filter(t => t.semaforo !== null && t.semaforo !== undefined)
  const rojoCount = withSemaforo.filter(t => t.semaforo === 1).length
  const clientRecoRate = withSemaforo.length > 0 ? rojoCount / withSemaforo.length : 0
  const recoRatio = fleetRecoRate > 0 ? clientRecoRate / fleetRecoRate : 1

  let recoScore = 0
  if (recoRatio > 2) recoScore = 90
  else if (recoRatio > 1.5) recoScore = 70
  else if (recoRatio > 1) recoScore = 40
  else recoScore = 10

  factors.push({
    factor: 'reconocimiento_rate',
    weight: 30,
    score: recoScore,
    detail: `${Math.round(clientRecoRate * 100)}% vs ${Math.round(fleetRecoRate * 100)}% flota (ratio: ${recoRatio.toFixed(1)}x)`,
  })

  // ── Factor 2: Value Anomalies (25%) ──
  const values = allT.map(t => Number(t.importe_total) || 0).filter(v => v > 0)
  const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

  // Check for suspiciously low values
  const lowCount = values.filter(v => v < avgValue * 0.85).length
  const lowPct = values.length > 0 ? lowCount / values.length : 0

  let valueScore = 0
  if (lowPct > 0.3) valueScore = 80
  else if (lowPct > 0.15) valueScore = 50
  else if (lowPct > 0.05) valueScore = 25
  else valueScore = 5

  factors.push({
    factor: 'value_anomalies',
    weight: 25,
    score: valueScore,
    detail: `${Math.round(lowPct * 100)}% operaciones con valor <85% del promedio ($${Math.round(avgValue).toLocaleString()})`,
  })

  // ── Factor 3: Document Completeness (20%) ──
  const withPedimento = allT.filter(t => !!t.pedimento).length
  const docRate = allT.length > 0 ? withPedimento / allT.length : 0

  let docScore = 0
  if (docRate < 0.7) docScore = 80
  else if (docRate < 0.85) docScore = 50
  else if (docRate < 0.95) docScore = 25
  else docScore = 5

  factors.push({
    factor: 'document_completeness',
    weight: 20,
    score: docScore,
    detail: `${Math.round(docRate * 100)}% con pedimento asignado (${withPedimento}/${allT.length})`,
  })

  // ── Factor 4: Fracción Concentration (15%) ──
  const fracciones = new Set()
  const flaggedFracciones = ['8471', '8473', '8542', '8523'] // electronics SAT flags
  let flaggedCount = 0

  for (const t of allT) {
    const desc = (t.descripcion_mercancia || '').toLowerCase()
    if (desc.includes('electr') || desc.includes('comput') || desc.includes('circuit')) {
      flaggedCount++
    }
  }

  const flaggedPct = allT.length > 0 ? flaggedCount / allT.length : 0

  let concScore = 0
  if (flaggedPct > 0.5) concScore = 70
  else if (flaggedPct > 0.2) concScore = 40
  else concScore = 10

  factors.push({
    factor: 'fraccion_concentration',
    weight: 15,
    score: concScore,
    detail: `${Math.round(flaggedPct * 100)}% en fracciones de alto escrutinio`,
  })

  // ── Factor 5: MVE Status (10%) ──
  // MVE mandatory since March 31, 2026 — check if compliant
  const withoutMVE = allT.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return (r === 'ITE' || r === 'ITR' || r === 'IMD' || r === 'A1') && !t.pedimento
  }).length

  let mveScore = 0
  if (withoutMVE > 5) mveScore = 80
  else if (withoutMVE > 0) mveScore = 40
  else mveScore = 5

  factors.push({
    factor: 'mve_status',
    weight: 10,
    score: mveScore,
    detail: `${withoutMVE} operaciones sin pedimento/MVE completo`,
  })

  // ── Calculate weighted audit probability ──
  const weightedSum = factors.reduce((s, f) => s + f.score * (f.weight / 100), 0)
  const auditProbability = Math.round(weightedSum)

  const riskLevel = auditProbability >= 60 ? 'alto'
    : auditProbability >= 35 ? 'medio'
    : auditProbability >= 15 ? 'bajo'
    : 'mínimo'

  // ── Recommended actions ──
  const actions = []
  if (recoScore >= 50) actions.push({ action: 'Revisar motivos de reconocimiento frecuente', deadline: '30 días', impact: 'Reduce probabilidad de auditoría 10-15%' })
  if (valueScore >= 50) actions.push({ action: 'Verificar valores declarados vs mercado', deadline: '15 días', impact: 'Elimina bandera roja de subvaluación' })
  if (docScore >= 50) actions.push({ action: 'Completar expedientes antes de transmisión', deadline: 'inmediato', impact: 'Demuestra cumplimiento proactivo' })
  if (concScore >= 50) actions.push({ action: 'Preparar soporte técnico para fracciones electrónicas', deadline: '60 días', impact: 'Previene reclasificación SAT' })
  if (mveScore >= 50) actions.push({ action: 'Regularizar MVE formato E2', deadline: 'inmediato', impact: 'Evita multa $1,610-$7,190 MXN por operación' })
  if (actions.length === 0) actions.push({ action: 'Mantener expedientes al 95%+', deadline: 'continuo', impact: 'Operación ejemplar' })

  return {
    company_id: companyId,
    audit_probability: auditProbability,
    risk_level: riskLevel,
    risk_factors: factors,
    recommended_actions: actions,
    trafico_count: allT.length,
  }
}

async function main() {
  console.log(`🛡️ Compliance Risk Model — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  const quarter = getCurrentQuarter()
  console.log(`  Quarter: ${quarter}`)

  // Get active companies
  const { data: companies } = await supabase.from('companies')
    .select('company_id, name')
    .eq('active', true)

  if (!companies || companies.length === 0) {
    console.log('  No active companies.')
    return
  }

  // Fleet-wide reconocimiento rate
  const fleetSemaforo = await fetchAll(supabase.from('traficos')
    .select('semaforo')
    .not('semaforo', 'is', null)
    .gte('fecha_llegada', new Date(Date.now() - 90 * 86400000).toISOString()))

  const fleetTotal = fleetSemaforo.length
  const fleetRojo = fleetSemaforo.filter(t => t.semaforo === 1).length
  const fleetRecoRate = fleetTotal > 0 ? fleetRojo / fleetTotal : 0.05

  console.log(`  Fleet reconocimiento rate: ${Math.round(fleetRecoRate * 100)}% (${fleetRojo}/${fleetTotal})`)

  const results = []

  for (const co of companies) {
    const result = await scoreClient(co.company_id, fleetRecoRate)
    if (!result) continue

    results.push({ ...result, name: co.name })

    if (!DRY_RUN) {
      await supabase.from('compliance_risk_scores').upsert({
        company_id: co.company_id,
        quarter,
        audit_probability: result.audit_probability,
        risk_level: result.risk_level,
        risk_factors: result.risk_factors,
        recommended_actions: result.recommended_actions,
      }, { onConflict: 'company_id,quarter' }).catch(() => {})
    }

    const icon = result.risk_level === 'alto' ? '🔴' : result.risk_level === 'medio' ? '🟡' : '🟢'
    console.log(`  ${icon} ${co.name.substring(0, 30).padEnd(30)} ${result.audit_probability}% (${result.risk_level}) · ${result.trafico_count} ops`)
  }

  // Sort by risk for Telegram
  results.sort((a, b) => b.audit_probability - a.audit_probability)
  const highRisk = results.filter(r => r.risk_level === 'alto' || r.risk_level === 'medio')

  const lines = [
    `🛡️ <b>Riesgo de Auditoría SAT — ${quarter}</b>`,
    ``,
    `${results.length} clientes evaluados`,
    `Fleet reconocimiento: ${Math.round(fleetRecoRate * 100)}%`,
    ``,
  ]

  if (highRisk.length > 0) {
    lines.push(`<b>⚠️ Atención requerida:</b>`)
    highRisk.slice(0, 5).forEach(r => {
      const icon = r.risk_level === 'alto' ? '🔴' : '🟡'
      lines.push(`${icon} ${r.name.substring(0, 25)}: ${r.audit_probability}% (${r.risk_level})`)
    })
  } else {
    lines.push(`✅ Todos los clientes en riesgo bajo o mínimo.`)
  }

  lines.push(``, `— CRUZ 🛡️`)
  await tg(lines.join('\n'))

  console.log(`\n✅ ${results.length} scored · ${highRisk.length} elevated risk`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
