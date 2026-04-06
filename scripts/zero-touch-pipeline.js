#!/usr/bin/env node

// ============================================================
// CRUZ Zero-Touch Pipeline — shipments that clear themselves
// For tráficos meeting ALL qualification criteria, CRUZ
// pre-fills, validates, and packages the pedimento automatically.
// One tap from Tito → filed with SAT.
// Cron: 0 8 * * 1-6 (weekdays 8 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

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
  }).catch(() => {})
}

async function qualifyTrafico(t, avgValue, stdValue) {
  const blockers = []
  let score = 100

  // 1. Documents complete (check expediente)
  const { count: docCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })
    .eq('pedimento_id', t.trafico)
  const docsPresent = docCount || 0
  if (docsPresent < 3) {
    score -= 30; blockers.push(`Documentos incompletos (${docsPresent} de 3+ requeridos)`)
  }

  // 2. Supplier history
  const prov = (t.proveedores || '').split(',')[0]?.trim()
  if (!prov || prov.startsWith('PRV_')) {
    score -= 25; blockers.push('Proveedor sin historial')
  }

  // 3. Value within range
  const val = Number(t.importe_total) || 0
  if (val <= 0) {
    score -= 20; blockers.push('Valor no registrado')
  } else if (stdValue > 0 && Math.abs(val - avgValue) > 2 * stdValue) {
    score -= 15; blockers.push(`Valor fuera de rango ($${Math.round(val)} vs promedio $${Math.round(avgValue)})`)
  }

  // 4. Pedimento assigned
  if (!t.pedimento) {
    score -= 20; blockers.push('Sin pedimento asignado')
  }

  // 5. Compliance risk
  const scoreReasons = t.score_reasons ? JSON.parse(t.score_reasons) : null
  if (scoreReasons?.score > 30) {
    score -= 10; blockers.push(`Riesgo compliance: ${scoreReasons.score}/100`)
  }

  // 6. Country risk
  const pais = (t.pais_procedencia || '').toUpperCase()
  const highRisk = ['CN', 'HK', 'TW'].includes(pais)
  if (highRisk) {
    score -= 10; blockers.push(`País alto escrutinio (${pais})`)
  }

  score = Math.max(0, score)
  const qualified = score >= 90 && blockers.length === 0

  return { trafico: t.trafico, company_id: t.company_id, score, qualified, blockers, docsPresent, value: val }
}

async function main() {
  console.log(`⚡ CRUZ Zero-Touch Pipeline — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Get pending tráficos
  const { data: pending } = await supabase
    .from('traficos')
    .select('trafico, company_id, estatus, fecha_llegada, importe_total, pedimento, proveedores, pais_procedencia, score_reasons, regimen')
    .neq('estatus', 'Cruzado')
    .gte('fecha_llegada', '2024-01-01')
    .limit(200)

  if (!pending || pending.length === 0) {
    console.log('  No pending tráficos')
    process.exit(0)
  }

  // Compute value statistics for outlier detection
  const values = pending.map(t => Number(t.importe_total) || 0).filter(v => v > 0)
  const avgValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
  const stdValue = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avgValue, 2), 0) / values.length) : 0

  console.log(`  ${pending.length} pending · avg $${Math.round(avgValue)} · std $${Math.round(stdValue)}`)

  // Qualify each
  const qualified = []
  const notQualified = []

  for (const t of pending) {
    const result = await qualifyTrafico(t, avgValue, stdValue)
    if (result.qualified) qualified.push(result)
    else notQualified.push(result)
  }

  // Sort qualified by score
  qualified.sort((a, b) => b.score - a.score)

  console.log(`\n  ⚡ Qualified for zero-touch: ${qualified.length}/${pending.length} (${pending.length > 0 ? Math.round(qualified.length / pending.length * 100) : 0}%)`)

  if (qualified.length > 0) {
    console.log('\n  Zero-touch ready:')
    qualified.slice(0, 10).forEach(q => {
      console.log(`    ✅ ${q.trafico} (${q.company_id}) — ${q.score}/100 · $${q.value.toLocaleString()} · ${q.docsPresent} docs`)
    })
  }

  // Top blockers across non-qualified
  const blockerCounts = {}
  for (const nq of notQualified) {
    for (const b of nq.blockers) {
      const key = b.split('(')[0].trim()
      blockerCounts[key] = (blockerCounts[key] || 0) + 1
    }
  }
  const topBlockers = Object.entries(blockerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (topBlockers.length > 0) {
    console.log('\n  Top blockers:')
    topBlockers.forEach(([blocker, count]) => console.log(`    ❌ ${blocker}: ${count}`))
  }

  // Telegram
  const zeroTouchRate = pending.length > 0 ? Math.round(qualified.length / pending.length * 100) : 0
  const lines = [
    `⚡ <b>Zero-Touch Pipeline</b>`,
    ``,
    `${qualified.length}/${pending.length} listos para transmisión automática (<b>${zeroTouchRate}%</b>)`,
    ``,
  ]

  if (qualified.length > 0) {
    lines.push(`✅ <b>Listos:</b>`)
    qualified.slice(0, 5).forEach(q => lines.push(`  • <code>${q.trafico}</code> (${q.company_id}) — ${q.score}/100`))
    lines.push(``)
  }

  if (topBlockers.length > 0) {
    lines.push(`❌ <b>Top blockers:</b>`)
    topBlockers.slice(0, 3).forEach(([b, c]) => lines.push(`  • ${b}: ${c}`))
  }

  lines.push(``, `— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))

  // Save metrics
  if (!DRY_RUN) {
    await supabase.from('benchmarks').upsert({
      metric: 'zero_touch_rate',
      dimension: 'fleet',
      value: zeroTouchRate,
      sample_size: pending.length,
      period: new Date().toISOString().split('T')[0],
    }, { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  // Log to Operational Brain
  try {
    const { logDecision } = require('./decision-logger')
    await logDecision({ decision_type: 'zero_touch', decision: `${qualified.length} calificados de ${pending.length} (${zeroTouchRate}%)`, reasoning: `Score ≥90, zero blockers` })
  } catch {}

  console.log(`\n✅ Zero-touch rate: ${zeroTouchRate}%`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
