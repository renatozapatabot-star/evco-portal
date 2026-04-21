#!/usr/bin/env node
/**
 * CRUZ Exchange Rate Optimizer — filing timing recommendations
 *
 * Tracks Banxico rate trends, recommends when to file pedimentos
 * to minimize duty costs. Never delays past compliance deadlines.
 *
 * Cron: 0 7 * * 1-6 (daily business days, after Banxico publishes)
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

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1))
}

async function main() {
  console.log(`💱 Exchange Rate Optimizer — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Get current rate
  const { data: config } = await supabase.from('system_config')
    .select('value')
    .eq('key', 'banxico_exchange_rate')
    .single()

  if (!config?.value?.rate) {
    console.log('  No exchange rate found in system_config.')
    return
  }

  const currentRate = Number(config.value.rate)
  const rateDate = config.value.date || new Date().toISOString().split('T')[0]
  console.log(`  Current rate: $${currentRate} MXN/USD (${rateDate})`)

  // Get rate history from learned_patterns
  const { data: rateHistory } = await supabase.from('learned_patterns')
    .select('pattern_value, confidence, last_confirmed')
    .eq('pattern_type', 'exchange_rate')
    .eq('active', true)
    .order('last_confirmed', { ascending: false })
    .limit(90)

  // Build rate array (current + historical)
  const rates = [currentRate]
  if (rateHistory) {
    for (const r of rateHistory) {
      const match = r.pattern_value.match(/([\d.]+)\s*MXN/)
      if (match) rates.push(parseFloat(match[1]))
    }
  }

  // Store today's rate as a pattern for history
  if (!DRY_RUN) {
    await supabase.from('learned_patterns').upsert({
      pattern_type: 'exchange_rate',
      pattern_key: `rate:${rateDate}`,
      pattern_value: `${currentRate} MXN/USD`,
      confidence: 1.0,
      source: 'banxico',
      sample_size: 1,
      last_confirmed: new Date().toISOString(),
      active: true,
    }, { onConflict: 'pattern_type,pattern_key' }).catch(() => {})
  }

  // Calculate metrics
  const last7 = rates.slice(0, Math.min(7, rates.length))
  const last30 = rates.slice(0, Math.min(30, rates.length))

  const avg7 = last7.reduce((a, b) => a + b, 0) / last7.length
  const avg30 = last30.reduce((a, b) => a + b, 0) / last30.length
  const volatility30 = stdDev(last30)

  // Trend: lower rate = peso stronger = favorable for importer (lower MXN duties)
  const trend7pct = last7.length >= 2
    ? Math.round((currentRate - last7[last7.length - 1]) / last7[last7.length - 1] * 10000) / 100
    : 0

  const trendDirection = trend7pct < -0.3 ? 'strengthening' // peso getting stronger = good
    : trend7pct > 0.3 ? 'weakening' // peso getting weaker = bad
    : 'stable'

  const trendIcon = trendDirection === 'strengthening' ? '↓' : trendDirection === 'weakening' ? '↑' : '→'
  const trendLabel = trendDirection === 'strengthening' ? 'fortalecimiento del peso'
    : trendDirection === 'weakening' ? 'debilitamiento del peso'
    : 'estable'

  console.log(`  7-day avg: $${avg7.toFixed(4)} · 30-day avg: $${avg30.toFixed(4)}`)
  console.log(`  7-day trend: ${trendIcon} ${trend7pct > 0 ? '+' : ''}${trend7pct}% (${trendLabel})`)
  console.log(`  30-day volatility: σ=${volatility30.toFixed(4)}`)

  // Find pending pedimentos (not yet filed, active)
  const { data: pending } = await supabase.from('traficos')
    .select('trafico, company_id, importe_total, pedimento, fecha_llegada')
    .is('fecha_cruce', null)
    .not('importe_total', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .order('importe_total', { ascending: false })
    .limit(30)

  const pendingWithValue = (pending || []).filter(t => Number(t.importe_total) > 10000)

  // Generate recommendations
  const recommendations = []

  for (const t of pendingWithValue) {
    const value = Number(t.importe_total) || 0
    const dutiesAtCurrent = Math.round(value * currentRate * 0.008) // DTA estimate
    const dutiesAtAvg = Math.round(value * avg30 * 0.008)
    const savingsVsAvg = Math.round((dutiesAtAvg - dutiesAtCurrent) / currentRate)

    // Check deadline proximity
    const daysActive = t.fecha_llegada
      ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000)
      : 0
    const isUrgent = daysActive > 12 // Near 15-day transmission deadline

    let recommendation
    if (isUrgent) {
      recommendation = 'TRANSMITIR HOY — cerca del plazo'
    } else if (trendDirection === 'strengthening' && savingsVsAvg > 50) {
      recommendation = `FAVORABLE — transmitir hoy (ahorro ~$${savingsVsAvg} USD vs promedio)`
    } else if (trendDirection === 'weakening' && !isUrgent && savingsVsAvg < -50) {
      recommendation = `ESPERAR 24-48h si es posible (posible ahorro ~$${Math.abs(savingsVsAvg)} USD)`
    } else {
      recommendation = 'NEUTRAL — transmitir cuando sea conveniente'
    }

    recommendations.push({
      trafico: t.trafico,
      company_id: t.company_id,
      value,
      savingsVsAvg,
      recommendation,
      isUrgent,
    })
  }

  // Log recommendation to operational_decisions
  if (!DRY_RUN && recommendations.length > 0) {
    try {
      const { logDecision } = require('./decision-logger')
      const favorable = recommendations.filter(r => r.recommendation.includes('FAVORABLE')).length
      const wait = recommendations.filter(r => r.recommendation.includes('ESPERAR')).length
      await logDecision({
        decision_type: 'crossing_choice',
        decision: `TC $${currentRate}: ${favorable} favorable, ${wait} esperar, ${recommendations.length - favorable - wait} neutral`,
        reasoning: `Tendencia 7d: ${trend7pct}% (${trendLabel}). Volatilidad: σ=${volatility30.toFixed(2)}`,
      })
    } catch {}
  }

  // Telegram report
  const lines = [
    `💱 <b>Tipo de Cambio — Recomendación</b>`,
    ``,
    `Hoy: <b>$${currentRate.toFixed(4)} MXN/USD</b>`,
    `Promedio 7d: $${avg7.toFixed(4)} | 30d: $${avg30.toFixed(4)}`,
    `Tendencia: ${trendIcon} ${trend7pct > 0 ? '+' : ''}${trend7pct}% (${trendLabel})`,
    `Volatilidad: σ=${volatility30.toFixed(3)}`,
    ``,
  ]

  if (pendingWithValue.length > 0) {
    const favorable = recommendations.filter(r => r.recommendation.includes('FAVORABLE'))
    const wait = recommendations.filter(r => r.recommendation.includes('ESPERAR'))
    const urgent = recommendations.filter(r => r.isUrgent)

    if (favorable.length > 0) lines.push(`✅ ${favorable.length} operación(es): buen momento para transmitir`)
    if (wait.length > 0) lines.push(`⏳ ${wait.length} operación(es): considerar esperar 24-48h`)
    if (urgent.length > 0) lines.push(`🔴 ${urgent.length} operación(es): transmitir HOY (plazo)`)

    // Show top 3 by savings
    const sorted = [...recommendations].sort((a, b) => Math.abs(b.savingsVsAvg) - Math.abs(a.savingsVsAvg))
    if (sorted.length > 0) {
      lines.push(``)
      sorted.slice(0, 3).forEach(r => {
        const icon = r.isUrgent ? '🔴' : r.recommendation.includes('FAVORABLE') ? '✅' : r.recommendation.includes('ESPERAR') ? '⏳' : '➡️'
        lines.push(`${icon} ${r.trafico}: $${r.value.toLocaleString()} · ${r.savingsVsAvg > 0 ? '+' : ''}$${r.savingsVsAvg} vs prom`)
      })
    }
  } else {
    lines.push(`Sin pedimentos pendientes de alta valor.`)
  }

  lines.push(``, `— CRUZ 💱`)
  await tg(lines.join('\n'))

  console.log(`\n✅ Rate: $${currentRate} · Trend: ${trendLabel} · ${recommendations.length} recommendations`)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
