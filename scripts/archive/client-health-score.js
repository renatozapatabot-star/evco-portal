#!/usr/bin/env node
// scripts/client-health-score.js — BUILD 3 PHASE 8
// Client Health Score Engine — Real 0-100 score with 6 weighted factors
// Runs for all clients, updates companies table
// Cron: 0 5 * * 1 (Monday 5 AM)

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

// ── CLIENTS CONFIG ───────────────────────────────────
const CLIENTS = [
  { name: 'EVCO Plastics de México', company_id: 'evco', clave: '9254' },
  // More clients added as they onboard
]

// ── REQUIRED DOCS (for completeness check) ───────────
const REQUIRED_DOCS = [
  'FACTURA', 'LISTA DE EMPAQUE', 'PEDIMENTO', 'ACUSE DE COVE',
  'CARTA PORTE', 'BL', 'CERTIFICADO DE ORIGEN'
]

// ── Calculate Health Score ───────────────────────────
async function calculateHealthScore(company_id, clave) {
  const scores = {}
  const details = {}

  // Factor 1: Document completeness (25 points)
  // % of active tráficos with required docs present
  const { data: activeTraficos } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', company_id)
    .not('estatus', 'ilike', '%cruz%')
    .limit(20)

  let docScore = 0
  let docsChecked = 0
  const { data: allDocs } = await supabase.from('documents')
    .select('metadata, document_type')
    .limit(2000)

  for (const t of (activeTraficos || []).slice(0, 20)) {
    const tDocs = (allDocs || []).filter(d =>
      d.metadata?.trafico === t.trafico
    )
    const foundTypes = new Set(tDocs.map(d => (d.document_type || '').toUpperCase()))
    const completeness = REQUIRED_DOCS.filter(r => foundTypes.has(r)).length / REQUIRED_DOCS.length * 100
    docScore += completeness
    docsChecked++
  }
  const avgDocScore = docsChecked > 0 ? docScore / docsChecked : 100
  scores.documents = Math.min(25, Math.round(avgDocScore * 0.25))
  details.documents = { avg_completeness: Math.round(avgDocScore), checked: docsChecked }

  // Factor 2: T-MEC utilization (20 points)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('igi, valor_usd')
    .eq('clave_cliente', clave)
    .gte('fecha_pago', ninetyDaysAgo)

  const totalOps = (facturas || []).length || 1
  const tmecOps = (facturas || []).filter(f => Number(f.igi || 0) === 0).length
  const tmecRate = tmecOps / totalOps
  scores.tmec = Math.round(tmecRate * 20)
  details.tmec = { rate: Math.round(tmecRate * 100), ops: totalOps, tmec_ops: tmecOps }

  // Factor 3: Compliance predictions (25 points)
  const { data: preds } = await supabase
    .from('compliance_predictions')
    .select('severity')
    .eq('company_id', company_id)
    .eq('resolved', false)

  const critical = (preds || []).filter(p => p.severity === 'critical').length
  const warnings = (preds || []).filter(p => p.severity === 'warning').length
  scores.compliance = Math.max(0, 25 - (critical * 8) - (warnings * 3))
  details.compliance = { critical, warnings }

  // Factor 4: Crossing time vs benchmark (15 points)
  const { data: completed } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .eq('company_id', company_id)
    .ilike('estatus', '%cruz%')
    .not('fecha_llegada', 'is', null)
    .not('fecha_cruce', 'is', null)
    .order('fecha_cruce', { ascending: false })
    .limit(50)

  let avgCrossing = 39.5
  if (completed?.length > 0) {
    const hours = completed
      .map(c => (new Date(c.fecha_cruce) - new Date(c.fecha_llegada)) / 3600000)
      .filter(h => h > 0 && h < 240)
    if (hours.length > 0) {
      avgCrossing = hours.reduce((a, b) => a + b, 0) / hours.length
    }
  }
  const benchmark = 39.5
  const crossingScore = avgCrossing <= benchmark ? 15
    : avgCrossing <= benchmark * 1.3 ? 10
    : avgCrossing <= benchmark * 1.6 ? 5 : 0
  scores.crossing = crossingScore
  details.crossing = { avg_hours: Math.round(avgCrossing * 10) / 10, benchmark }

  // Factor 5: Data freshness (10 points)
  const { data: latestTrafico } = await supabase
    .from('traficos')
    .select('updated_at')
    .eq('company_id', company_id)
    .order('updated_at', { ascending: false })
    .limit(1)

  const hoursOld = latestTrafico?.[0]?.updated_at
    ? (Date.now() - new Date(latestTrafico[0].updated_at).getTime()) / 3600000
    : 999
  scores.freshness = hoursOld < 24 ? 10 : hoursOld < 48 ? 7 : hoursOld < 168 ? 5 : 3
  details.freshness = { hours_old: Math.round(hoursOld) }

  // Factor 6: Risk score average (5 points)
  const { data: risks } = await supabase
    .from('pedimento_risk_scores')
    .select('overall_score')
    .eq('company_id', company_id)
    .limit(100)

  const avgRisk = (risks || []).length > 0
    ? (risks || []).reduce((s, r) => s + (r.overall_score || 0), 0) / risks.length
    : 50
  scores.risk = avgRisk < 30 ? 5 : avgRisk < 50 ? 3 : 1
  details.risk = { avg_score: Math.round(avgRisk), count: (risks || []).length }

  const total = Object.values(scores).reduce((s, v) => s + v, 0)

  return {
    total: Math.round(total),
    breakdown: scores,
    details,
    grade: total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D',
    trend: 'stable', // TODO: compare to last week
  }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('📊 CLIENT HEALTH SCORE ENGINE — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  const results = []

  for (const client of CLIENTS) {
    console.log(`\n🏢 ${client.name}`)
    try {
      const health = await calculateHealthScore(client.company_id, client.clave)

      console.log(`  Total: ${health.total}/100 (Grade: ${health.grade})`)
      console.log(`  Breakdown:`)
      for (const [factor, score] of Object.entries(health.breakdown)) {
        const maxPoints = { documents: 25, tmec: 20, compliance: 25, crossing: 15, freshness: 10, risk: 5 }
        console.log(`    ${factor}: ${score}/${maxPoints[factor] || '?'}`)
      }

      // Update companies table
      const { error: compErr } = await supabase.from('companies').upsert({
        company_id: client.company_id,
        name: client.name,
        clave_cliente: client.clave,
        health_score: health.total,
        health_grade: health.grade,
        health_breakdown: health.breakdown,
        health_details: health.details,
        health_updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' })
      if (compErr) console.log(`  ⚠️  Company update: ${compErr.message}`)

      // Also save to client_benchmarks for historical tracking
      const { error: benchErr } = await supabase.from('client_benchmarks').upsert({
        company_id: client.company_id,
        benchmark_type: 'health_score',
        metrics: {
          total: health.total,
          grade: health.grade,
          breakdown: health.breakdown,
          details: health.details,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,benchmark_type' })
      if (benchErr) console.log(`  ⚠️  Benchmark save: ${benchErr.message}`)

      results.push({
        name: client.name,
        company_id: client.company_id,
        ...health,
      })
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`)
    }
  }

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log('HEALTH SCORES COMPLETE')
  console.log('═'.repeat(55))

  // Sort by score descending
  results.sort((a, b) => b.total - a.total)
  for (const r of results) {
    const icon = r.grade === 'A' ? '🟢' : r.grade === 'B' ? '🟡' : r.grade === 'C' ? '🟠' : '🔴'
    console.log(`${icon} ${r.name}: ${r.total}/100 (${r.grade})`)
  }
  console.log(`Time: ${elapsed}s`)

  // ── Telegram ───────────────────────────────────────
  const lines = results.map(r => {
    const icon = r.grade === 'A' ? '🟢' : r.grade === 'B' ? '🟡' : r.grade === 'C' ? '🟠' : '🔴'
    return `${icon} ${r.name}: ${r.total}/100 (${r.grade})`
  })

  const lowScores = results.filter(r => r.total < 65)
  const alertLine = lowScores.length > 0
    ? `\n⚠️ ${lowScores.length} client(s) below 65 — action needed`
    : '\n✅ All clients above threshold'

  await sendTG(`📊 <b>CLIENT HEALTH SCORES</b>
━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n')}
${alertLine}

Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`)
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
