#!/usr/bin/env node
/**
 * CRUZ Post-Operation Analysis — daily learning from outcomes
 *
 * For every tráfico completed yesterday:
 * SCORE it (0-100), LEARN from it, STORE the lessons.
 *
 * Cron: 0 5 * * * (daily 5 AM)
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

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

async function main() {
  console.log(`📊 Post-Operation Analysis — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Find tráficos that crossed yesterday
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const dayStart = yesterday.toISOString().split('T')[0]
  const dayEnd = new Date(yesterday); dayEnd.setDate(dayEnd.getDate() + 1)

  const { data: completed } = await supabase.from('traficos')
    .select('trafico, company_id, estatus, fecha_llegada, fecha_cruce, pedimento, proveedores, importe_total, regimen')
    .gte('fecha_cruce', dayStart)
    .lt('fecha_cruce', dayEnd.toISOString().split('T')[0])
    .limit(200)

  if (!completed || completed.length === 0) {
    console.log('  No completed tráficos yesterday.')
    return
  }

  console.log(`  ${completed.length} tráficos completed yesterday`)

  // Get company averages for scoring
  const companyAvgs = {}
  for (const t of completed) {
    if (!companyAvgs[t.company_id]) {
      const { data: hist } = await supabase.from('traficos')
        .select('fecha_llegada, fecha_cruce')
        .eq('company_id', t.company_id)
        .not('fecha_cruce', 'is', null)
        .gte('fecha_llegada', '2024-01-01')
        .limit(200)
      const days = (hist || []).map(h => {
        if (!h.fecha_llegada || !h.fecha_cruce) return null
        return (new Date(h.fecha_cruce).getTime() - new Date(h.fecha_llegada).getTime()) / 86400000
      }).filter(d => d !== null && d >= 0 && d < 30)
      companyAvgs[t.company_id] = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 5
    }
  }

  let totalScore = 0
  const patterns = []

  for (const t of completed) {
    let score = 0

    // Speed vs average (25 pts)
    const dwellDays = t.fecha_llegada && t.fecha_cruce
      ? (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
      : null
    const avg = companyAvgs[t.company_id] || 5
    if (dwellDays !== null && dwellDays >= 0) {
      score += dwellDays <= avg ? 25 : dwellDays <= avg * 1.5 ? 15 : 5
    }

    // Doc completeness at filing (25 pts)
    const { count: docCount } = await supabase.from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('pedimento_id', t.trafico)
    score += (docCount || 0) >= 3 ? 25 : (docCount || 0) >= 1 ? 15 : 0

    // Pedimento present (25 pts)
    score += t.pedimento ? 25 : 0

    // Zero exceptions (25 pts) — no anomalies logged
    const { count: anomalyCount } = await supabase.from('anomaly_log')
      .select('id', { count: 'exact', head: true })
      .eq('client', t.company_id)
    score += (anomalyCount || 0) === 0 ? 25 : 10

    totalScore += score

    // Learn from crossing time
    if (dwellDays !== null && Math.abs(dwellDays - avg) > avg * 0.3) {
      patterns.push({
        pattern_type: 'crossing_time',
        pattern_key: `crossing_avg:${t.company_id}`,
        pattern_value: `Promedio actualizado: ${Math.round(dwellDays * 10) / 10} días (anterior: ${Math.round(avg * 10) / 10})`,
        confidence: 0.7,
        source: 'post_operation_analysis',
        sample_size: 1,
      })
    }

    // Log the scored outcome
    if (!DRY_RUN) {
      await supabase.from('operational_decisions').insert({
        trafico: t.trafico,
        company_id: t.company_id,
        decision_type: 'post_operation_score',
        decision: `Score: ${score}/100`,
        reasoning: `Speed: ${dwellDays !== null ? Math.round(dwellDays * 10) / 10 + 'd' : '?'} vs ${Math.round(avg * 10) / 10}d avg. Docs: ${docCount || 0}. Pedimento: ${t.pedimento ? 'yes' : 'no'}.`,
        outcome: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs_improvement',
        outcome_score: score,
      })
    }

    console.log(`  ${t.trafico.padEnd(20)} Score: ${score}/100 · ${dwellDays !== null ? Math.round(dwellDays * 10) / 10 + 'd' : '?'} · ${docCount || 0} docs`)
  }

  // Write new patterns
  if (!DRY_RUN && patterns.length > 0) {
    for (const p of patterns) {
      await supabase.from('learned_patterns').upsert(p, { onConflict: 'pattern_type,pattern_key' }).catch(() => {})
    }
  }

  const avgScore = completed.length > 0 ? Math.round(totalScore / completed.length) : 0

  await tg(
    `📊 <b>Post-Operation Analysis</b>\n\n` +
    `${completed.length} operaciones completadas ayer\n` +
    `Score promedio: ${avgScore}/100\n` +
    `${patterns.length} patrones detectados\n\n` +
    `— CRUZ 🧠`
  )

  console.log(`\n✅ ${completed.length} scored · avg ${avgScore}/100 · ${patterns.length} patterns`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
