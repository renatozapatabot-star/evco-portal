#!/usr/bin/env node
/**
 * CRUZ — Carrier Scoreboard Builder (BUILD 154)
 *
 * Scores every carrier from real operational data:
 * - On-time rate (crossing speed vs average)
 * - Damage rate (from entradas faltantes)
 * - Volume (total operations)
 * - Combined score 0-100
 *
 * Top 3 get "Transportista Verificado CRUZ" badge.
 * Stores in carrier_scores table for portal display.
 *
 * Usage:
 *   node scripts/carrier-scoreboard.js --dry-run
 *   node scripts/carrier-scoreboard.js
 *
 * Cron: 0 4 * * 0 (Sunday 4 AM)
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function tg(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🚛 ${prefix}CRUZ — Carrier Scoreboard`)
  console.log('═'.repeat(55))

  // Get traficos with carrier data
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, transportista_mexicano, transportista_extranjero, fecha_llegada, fecha_cruce, company_id')
    .not('transportista_mexicano', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(10000)

  // Get entradas for damage data
  const { data: entradas } = await supabase.from('entradas')
    .select('trafico, transportista_mexicano, tiene_faltantes, mercancia_danada')
    .not('trafico', 'is', null)
    .limit(10000)

  console.log(`   Traficos with carrier: ${(traficos || []).length}`)
  console.log(`   Entradas with damage data: ${(entradas || []).length}`)

  // Score each carrier
  const carrierData = {}

  for (const t of (traficos || [])) {
    const carrier = t.transportista_mexicano || t.transportista_extranjero
    if (!carrier) continue

    if (!carrierData[carrier]) {
      carrierData[carrier] = { operations: 0, crossingDays: [], damages: 0, totalEntradas: 0 }
    }
    carrierData[carrier].operations++

    if (t.fecha_llegada && t.fecha_cruce) {
      const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
      if (days >= 0 && days <= 60) carrierData[carrier].crossingDays.push(days)
    }
  }

  // Add damage data from entradas
  for (const e of (entradas || [])) {
    const carrier = e.transportista_mexicano
    if (!carrier || !carrierData[carrier]) continue
    carrierData[carrier].totalEntradas++
    if (e.tiene_faltantes || e.mercancia_danada) carrierData[carrier].damages++
  }

  // Calculate scores
  const scores = Object.entries(carrierData)
    .filter(([, d]) => d.operations >= 3)
    .map(([name, d]) => {
      const avgCrossing = d.crossingDays.length > 0
        ? d.crossingDays.reduce((s, v) => s + v, 0) / d.crossingDays.length
        : null

      const speedScore = avgCrossing !== null ? Math.max(0, 100 - avgCrossing * 5) : 50
      const damageRate = d.totalEntradas > 0 ? d.damages / d.totalEntradas : 0
      const damageScore = Math.max(0, 100 - damageRate * 200)
      const volumeScore = Math.min(100, d.operations * 5)

      const combined = Math.round(speedScore * 0.4 + damageScore * 0.4 + volumeScore * 0.2)

      return {
        carrier_name: name,
        operations: d.operations,
        avg_crossing_days: avgCrossing ? Math.round(avgCrossing * 10) / 10 : null,
        damage_rate: Math.round(damageRate * 1000) / 10,
        score: combined,
        verified: combined >= 85,
      }
    })
    .sort((a, b) => b.score - a.score)

  console.log(`\n   Carriers scored: ${scores.length}`)
  console.log('   Top 10:')
  scores.slice(0, 10).forEach((s, i) => {
    console.log(`     #${i + 1} ${s.carrier_name.substring(0, 25).padEnd(25)} score=${s.score} ops=${s.operations} avg=${s.avg_crossing_days || '?'}d ${s.verified ? '⭐ VERIFIED' : ''}`)
  })

  // Save to system_config
  if (!DRY_RUN) {
    await supabase.from('system_config').upsert({
      key: 'carrier_scoreboard',
      value: { carriers: scores, built_at: new Date().toISOString(), total: scores.length },
      valid_to: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    }, { onConflict: 'key' })
    console.log('\n   ✅ Scoreboard saved')
  }

  const verified = scores.filter(s => s.verified)
  if (verified.length > 0) {
    await tg(
      `🚛 <b>CARRIER SCOREBOARD</b>\n` +
      `${scores.length} transportistas evaluados\n` +
      `⭐ Verificados: ${verified.length}\n` +
      verified.slice(0, 3).map((s, i) => `  ${['🥇', '🥈', '🥉'][i]} ${s.carrier_name.substring(0, 20)}: ${s.score}/100`).join('\n') +
      `\n— CRUZ 🦀`
    )
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>carrier-scoreboard FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
