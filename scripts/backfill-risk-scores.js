#!/usr/bin/env node
/**
 * backfill-risk-scores.js — Score ALL tráficos with null risk_score
 * Unlike pedimento-risk-score.js (which only scores "En Proceso"),
 * this runs the same engine on every trafico regardless of status.
 *
 * Run: node scripts/backfill-risk-scores.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const BATCH_SIZE = 1000

async function tg(msg) {
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function main() {
  const start = Date.now()
  console.log('\n🔍 RISK SCORE BACKFILL — All tráficos with null risk_score')
  console.log('═'.repeat(55))

  // 1. Count total null-scored tráficos
  const { count: nullCount } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .is('risk_score', null)

  console.log(`Tráficos with null risk_score: ${(nullCount || 0).toLocaleString()}`)

  if (!nullCount || nullCount === 0) {
    console.log('Nothing to backfill — all tráficos already scored')
    return
  }

  await tg(`🔍 <b>Risk score backfill</b>\n${nullCount.toLocaleString()} tráficos to score\n— CRUZ 🦀`)

  // 2. Load supporting data (same as pedimento-risk-score.js)
  console.log('Loading supporting data...')
  const [entRes, supplierRes, carrierRes, factRes] = await Promise.all([
    supabase.from('entradas').select('cve_entrada, tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID),
    supabase.from('supplier_contacts').select('supplier_name, usmca_eligible'),
    supabase.from('traficos').select('transportista_extranjero').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('referencia, valor_usd, pedimento').eq('clave_cliente', '9254'),
  ])

  // Entrada lookup by trafico pattern (entradas use cve_entrada, not trafico directly)
  const entradaIssues = new Set()
  ;(entRes.data || []).forEach(e => {
    if (e.tiene_faltantes || e.mercancia_danada) entradaIssues.add(e.cve_entrada)
  })

  // Carrier frequency
  const carrierCount = {}
  ;(carrierRes.data || []).forEach(t => {
    const c = t.transportista_extranjero || 'UNKNOWN'
    carrierCount[c] = (carrierCount[c] || 0) + 1
  })

  // Value stats
  const values = (factRes.data || []).map(f => f.valor_usd || 0).filter(v => v > 0)
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const stdVal = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - avgVal) ** 2, 0) / values.length) : avgVal * 0.5

  console.log(`  Carriers: ${Object.keys(carrierCount).length} · Avg value: $${Math.round(avgVal).toLocaleString()} · Std: $${Math.round(stdVal).toLocaleString()}`)

  // 3. Process in batches
  let totalScored = 0, totalHighRisk = 0, page = 0
  const allScores = []

  while (true) {
    const { data: traficos, error } = await supabase
      .from('traficos')
      .select('id, trafico, estatus, pedimento, fecha_llegada, transportista_extranjero, descripcion_mercancia, importe_total, peso_bruto')
      .eq('company_id', COMPANY_ID)
      .is('risk_score', null)
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)

    if (error) {
      console.error(`Fetch error: ${error.message}`)
      break
    }
    if (!traficos || traficos.length === 0) break

    // Score each trafico
    const updates = []
    const riskScores = []

    for (const t of traficos) {
      let score = 0
      const factors = []
      const now = Date.now()

      // No pedimento: +35
      if (!t.pedimento) { score += 35; factors.push('Sin pedimento (+35)') }

      // Days since arrival
      if (t.fecha_llegada) {
        const days = Math.floor((now - new Date(t.fecha_llegada).getTime()) / 86400000)
        if (t.estatus === 'En Proceso') {
          // Only penalize age for active tráficos
          if (days > 14) { score += 30; factors.push(`${days}d activo (+30)`) }
          else if (days > 7) { score += 15; factors.push(`${days}d activo (+15)`) }
          else if (days > 3) { score += 5; factors.push(`${days}d activo (+5)`) }
        }
        // For "Cruzado" — no age penalty (already crossed)
      } else {
        score += 10; factors.push('Sin fecha llegada (+10)')
      }

      // Value deviation
      const val = Number(t.importe_total) || 0
      if (val > 0 && stdVal > 0 && Math.abs(val - avgVal) > 2 * stdVal) {
        score += 20; factors.push('Valor atípico (+20)')
      }

      // No value at all
      if (!val || val === 0) { score += 10; factors.push('Sin importe (+10)') }

      // New carrier (< 3 ops)
      const carrier = t.transportista_extranjero || 'UNKNOWN'
      if ((carrierCount[carrier] || 0) < 3) {
        score += 10; factors.push('Carrier nuevo (+10)')
      }

      // No description
      if (!t.descripcion_mercancia) { score += 5; factors.push('Sin descripción (+5)') }

      // No weight
      if (!t.peso_bruto || Number(t.peso_bruto) === 0) { score += 5; factors.push('Sin peso (+5)') }

      score = Math.min(100, score)

      updates.push({ id: t.id, risk_score: score })
      riskScores.push({
        trafico_id: t.trafico,
        company_id: COMPANY_ID,
        score,
        overall_score: score,
        risk_factors: factors,
        carrier,
        valor_usd: val,
        calculated_at: new Date().toISOString(),
      })

      if (score > 70) totalHighRisk++
    }

    // Batch update traficos.risk_score
    for (const u of updates) {
      await supabase.from('traficos').update({ risk_score: u.risk_score }).eq('id', u.id)
    }

    // Batch insert to pedimento_risk_scores
    for (let i = 0; i < riskScores.length; i += 50) {
      await supabase.from('pedimento_risk_scores').upsert(
        riskScores.slice(i, i + 50),
        { onConflict: 'trafico_id,company_id' }
      ).catch(() => {
        // If upsert fails (no unique constraint), try insert
        supabase.from('pedimento_risk_scores').insert(riskScores.slice(i, i + 50)).catch(() => {})
      })
    }

    totalScored += traficos.length
    allScores.push(...riskScores)

    process.stdout.write(`\r  Scored: ${totalScored.toLocaleString()} / ${nullCount.toLocaleString()} (${Math.round(totalScored / nullCount * 100)}%)`)

    // Don't increment page — we always fetch null risk_score, and we just updated them
    // So the next fetch will get the next batch of nulls
    if (traficos.length < BATCH_SIZE) break
  }

  // 4. Summary
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((s, r) => s + r.score, 0) / allScores.length)
    : 0

  // Distribution
  const dist = { low: 0, medium: 0, high: 0, critical: 0 }
  allScores.forEach(s => {
    if (s.score <= 25) dist.low++
    else if (s.score <= 50) dist.medium++
    else if (s.score <= 75) dist.high++
    else dist.critical++
  })

  console.log('\n\n═'.repeat(55))
  console.log('  RISK SCORE BACKFILL COMPLETE')
  console.log(`  Total scored:  ${totalScored.toLocaleString()}`)
  console.log(`  Average score: ${avgScore}`)
  console.log(`  High risk:     ${totalHighRisk} (score > 70)`)
  console.log(`  Distribution:  🟢 ${dist.low} low · 🟡 ${dist.medium} med · 🟠 ${dist.high} high · 🔴 ${dist.critical} critical`)
  console.log(`  Elapsed: ${elapsed}s`)
  console.log('═'.repeat(55))

  await tg(`✅ <b>Risk score backfill</b>\n${totalScored.toLocaleString()} tráficos scored\nAvg: ${avgScore} · High risk: ${totalHighRisk}\n🟢 ${dist.low} · 🟡 ${dist.medium} · 🟠 ${dist.high} · 🔴 ${dist.critical}\n${elapsed}s\n— CRUZ 🦀`)

  // Log to scrape_runs
  await supabase.from('scrape_runs').insert({
    source: 'risk_score_backfill',
    started_at: new Date(start).toISOString(),
    completed_at: new Date().toISOString(),
    status: 'success',
    records_found: nullCount,
    records_updated: totalScored,
    metadata: { avg_score: avgScore, high_risk: totalHighRisk, distribution: dist }
  })
}

main().catch(async e => {
  console.error('❌', e.message)
  await tg(`❌ <b>Risk score backfill FAILED</b>\n${e.message}\n— CRUZ 🦀`)
  process.exit(1)
})
