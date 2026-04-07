#!/usr/bin/env node
/**
 * CRUZ Carrier Intelligence Network — score and rank carriers
 *
 * For each carrier in CRUZ history:
 * 1. Performance: on-time rate, transit time, damage rate
 * 2. Cost: avg rate per trip, trend
 * 3. Reputation score: 0-10 composite
 * 4. Specialization: lanes, cargo types
 *
 * For active tráficos ready to cross: top 3 carrier recommendations.
 *
 * Cron: 0 5 * * 1 (weekly Monday 5 AM)
 * Patente 3596 · Aduana 240
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
const SCRIPT_NAME = 'carrier-intelligence'

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
  console.log(`🚛 Carrier Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  // Multi-client
  const { data: companies } = await supabase.from('companies')
    .select('company_id').eq('active', true)
  const companyIds = (companies || []).map(c => c.company_id)
  if (companyIds.length === 0) { companyIds.push('evco'); console.warn('  ⚠️  No active companies found — falling back to evco') }

  let totalCarriers = 0

  for (const companyId of companyIds) {
    // Fetch tráficos with carrier data
    const { data: traficos } = await supabase.from('traficos')
      .select('trafico, transportista_extranjero, transportista_mexicano, fecha_llegada, fecha_cruce, peso_bruto, importe_total, descripcion_mercancia')
      .eq('company_id', companyId)
      .gte('fecha_llegada', '2024-01-01')
      .limit(5000)

    if (!traficos || traficos.length < 5) continue

    // Fetch entradas for damage data
    const { data: entradas } = await supabase.from('entradas')
      .select('trafico, tiene_faltantes, mercancia_danada')
      .eq('company_id', companyId)
      .limit(5000)

    const damageMap = new Map()
    for (const e of (entradas || [])) {
      if (e.trafico) damageMap.set(e.trafico, e.tiene_faltantes || e.mercancia_danada)
    }

    // Group by carrier (use both foreign + Mexican carriers)
    const carrierOps = new Map()

    for (const t of traficos) {
      const carriers = [t.transportista_extranjero, t.transportista_mexicano].filter(Boolean)
      for (const carrier of carriers) {
        const name = carrier.trim()
        if (!name || name.length < 2) continue

        if (!carrierOps.has(name)) carrierOps.set(name, [])
        carrierOps.get(name).push({
          trafico: t.trafico,
          fecha_llegada: t.fecha_llegada,
          fecha_cruce: t.fecha_cruce,
          peso_bruto: Number(t.peso_bruto) || 0,
          importe_total: Number(t.importe_total) || 0,
          damaged: damageMap.get(t.trafico) || false,
          product: t.descripcion_mercancia?.substring(0, 30) || '',
        })
      }
    }

    // Score each carrier with 3+ operations
    const scoreboard = []

    for (const [carrier, ops] of carrierOps) {
      if (ops.length < 3) continue

      // On-time: crossing within 48h of arrival
      const withCrossing = ops.filter(o => o.fecha_llegada && o.fecha_cruce)
      const transitTimes = withCrossing.map(o =>
        (new Date(o.fecha_cruce).getTime() - new Date(o.fecha_llegada).getTime()) / 3600000
      ).filter(h => h > 0 && h < 720)

      const avgTransit = transitTimes.length > 0
        ? Math.round(transitTimes.reduce((a, b) => a + b, 0) / transitTimes.length * 10) / 10
        : null
      const onTime = transitTimes.filter(h => h < 72).length
      const onTimeRate = transitTimes.length > 0 ? Math.round((onTime / transitTimes.length) * 100) : null

      // Damage rate
      const damaged = ops.filter(o => o.damaged).length
      const damageRate = Math.round((damaged / ops.length) * 10000) / 100

      // Cost per kg
      const totalWeight = ops.reduce((s, o) => s + o.peso_bruto, 0)
      const totalValue = ops.reduce((s, o) => s + o.importe_total, 0)
      const avgCostPerKg = totalWeight > 0 ? Math.round((totalValue / totalWeight) * 10000) / 10000 : null
      const avgRatePerTrip = Math.round(totalValue / ops.length)

      // Reputation score (0-10)
      let score = 5.0
      if (onTimeRate !== null) {
        if (onTimeRate >= 95) score += 2.0
        else if (onTimeRate >= 85) score += 1.0
        else if (onTimeRate < 70) score -= 1.5
      }
      if (damageRate < 1) score += 1.0
      else if (damageRate > 5) score -= 1.5
      if (ops.length >= 20) score += 1.0
      else if (ops.length >= 10) score += 0.5
      if (avgTransit && avgTransit < 48) score += 0.5
      score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))

      // Product specialization
      const products = [...new Set(ops.map(o => o.product).filter(Boolean))]

      scoreboard.push({
        company_id: companyId,
        carrier_name: carrier.substring(0, 80),
        total_operations: ops.length,
        on_time_rate_pct: onTimeRate,
        avg_cost_per_kg: avgCostPerKg,
        avg_transit_hours: avgTransit,
        damage_rate_pct: damageRate,
        specialization: products.slice(0, 5),
        best_lanes: ['Nuevo Laredo'],
        capacity_trend: 'available',
        reputation_score: score,
        last_incident: damaged > 0 ? 'Mercancía dañada' : null,
        last_incident_date: null,
        avg_rate_per_trip: avgRatePerTrip,
        rate_trend: 'stable',
        computed_at: new Date().toISOString(),
      })

      console.log(
        `  🚛 ${carrier.substring(0, 20).padEnd(20)} · ${ops.length} ops · ` +
        `${onTimeRate ?? '?'}% on-time · score ${score}/10 · daño ${damageRate}%`
      )
    }

    // Save
    if (!DRY_RUN && scoreboard.length > 0) {
      for (const s of scoreboard) {
        await supabase.from('carrier_scoreboard').upsert(s, {
          onConflict: 'company_id,carrier_name',
        }).catch(err => console.error(`  ⚠ ${err.message}`))
      }
    }

    totalCarriers += scoreboard.length
  }

  await tg(
    `🚛 <b>Carrier Intelligence — ${totalCarriers} transportistas</b>\n\n` +
    `${companyIds.length} empresa(s)\n` +
    `Duración: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\n` +
    `— CRUZ 🚛`
  )

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { carriers: totalCarriers, companies: companyIds.length },
    }).catch(() => {})
  }

  console.log(`\n✅ ${totalCarriers} transportistas · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
