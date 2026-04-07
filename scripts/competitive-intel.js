#!/usr/bin/env node
/**
 * CRUZ Competitive Intelligence Scanner — daily digest for Tito
 *
 * Scans available data sources for competitive intelligence:
 * 1. Internal: fraccion rate changes from aduanet_facturas trends
 * 2. Internal: ghost clients (CAZA) pipeline changes
 * 3. Internal: network volume trends (growing/shrinking sectors)
 * 4. Regulatory: fraccion patterns with sudden IGI changes
 * 5. Market: volume concentration shifts
 *
 * External sources (LinkedIn, SAT public, VUCEM) require manual seed
 * or future API integrations — this script handles the internal analysis.
 *
 * Cron: 0 6 * * 1-5 (weekdays 6 AM)
 * Patente 3596 · Aduana 240
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
const SCRIPT_NAME = 'competitive-intel'

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

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString() }

async function detectTariffChanges() {
  const insights = []

  // Look for fracciones where IGI rate changed recently
  const recent = await fetchAll(supabase.from('aduanet_facturas')
    .select('referencia, proveedor, valor_usd, igi, fecha_pago')
    .not('igi', 'is', null)
    .not('valor_usd', 'is', null)
    .gte('fecha_pago', daysAgo(30)))

  // Dedup
  const seen = new Set()
  const facturas = recent.filter(f => {
    if (!f.referencia || seen.has(f.referencia)) return false
    seen.add(f.referencia)
    return f.valor_usd > 0
  })

  // Group by supplier, compute IGI rate
  const supplierRates = new Map()
  for (const f of facturas) {
    const supplier = (f.proveedor || '').substring(0, 30).trim()
    if (!supplier) continue
    const rate = f.igi / f.valor_usd
    if (!supplierRates.has(supplier)) supplierRates.set(supplier, [])
    supplierRates.get(supplier).push(rate)
  }

  // Compare with historical (30-90 days ago)
  const historical = await fetchAll(supabase.from('aduanet_facturas')
    .select('referencia, proveedor, valor_usd, igi')
    .not('igi', 'is', null)
    .not('valor_usd', 'is', null)
    .gte('fecha_pago', daysAgo(90))
    .lt('fecha_pago', daysAgo(30)))

  const seenH = new Set()
  const histFacturas = historical.filter(f => {
    if (!f.referencia || seenH.has(f.referencia)) return false
    seenH.add(f.referencia)
    return f.valor_usd > 0
  })

  const histRates = new Map()
  for (const f of histFacturas) {
    const supplier = (f.proveedor || '').substring(0, 30).trim()
    if (!supplier) continue
    const rate = f.igi / f.valor_usd
    if (!histRates.has(supplier)) histRates.set(supplier, [])
    histRates.get(supplier).push(rate)
  }

  // Find significant rate changes
  for (const [supplier, rates] of supplierRates) {
    if (rates.length < 3) continue
    const histArr = histRates.get(supplier) || []
    if (histArr.length < 3) continue

    const avgRecent = rates.reduce((a, b) => a + b, 0) / rates.length
    const avgHist = histArr.reduce((a, b) => a + b, 0) / histArr.length
    const changePct = Math.round(((avgRecent - avgHist) / avgHist) * 100)

    if (Math.abs(changePct) >= 20) {
      insights.push({
        intel_type: 'tariff_change',
        title: `Cambio de tasa IGI: ${supplier.substring(0, 25)}`,
        summary: `La tasa IGI para ${supplier} cambió ${changePct > 0 ? '+' : ''}${changePct}% ` +
          `(de ${(avgHist * 100).toFixed(1)}% a ${(avgRecent * 100).toFixed(1)}%) en los últimos 30 días.`,
        source: 'internal',
        relevance_score: Math.min(90, 50 + Math.abs(changePct)),
        actionable: Math.abs(changePct) >= 30,
        suggested_action: changePct > 0
          ? `Revisar clasificación arancelaria para ${supplier}. Posible reclasificación o cambio regulatorio.`
          : `Tasa IGI bajó para ${supplier}. Verificar si aplica retroactivamente.`,
      })
    }
  }

  return insights
}

async function detectVolumeShifts() {
  const insights = []

  // Compare this month's volume by company vs last month
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const thisMonth = await fetchAll(supabase.from('traficos')
    .select('company_id')
    .gte('fecha_llegada', thisMonthStart))

  const lastMonth = await fetchAll(supabase.from('traficos')
    .select('company_id')
    .gte('fecha_llegada', lastMonthStart)
    .lt('fecha_llegada', thisMonthStart))

  const thisCount = new Map()
  for (const t of thisMonth) {
    thisCount.set(t.company_id, (thisCount.get(t.company_id) || 0) + 1)
  }

  const lastCount = new Map()
  for (const t of lastMonth) {
    lastCount.set(t.company_id, (lastCount.get(t.company_id) || 0) + 1)
  }

  // Detect significant shifts (>30%)
  for (const [company, count] of thisCount) {
    const prev = lastCount.get(company) || 0
    if (prev < 3) continue
    const changePct = Math.round(((count - prev) / prev) * 100)

    if (changePct >= 40) {
      insights.push({
        intel_type: 'industry_trend',
        title: `Crecimiento de volumen: ${company}`,
        summary: `${company} incrementó operaciones +${changePct}% este mes (${prev} → ${count}).`,
        source: 'internal',
        relevance_score: 60,
        actionable: false,
        suggested_action: null,
      })
    } else if (changePct <= -40) {
      insights.push({
        intel_type: 'market_opportunity',
        title: `Caída de volumen: ${company}`,
        summary: `${company} redujo operaciones ${changePct}% este mes (${prev} → ${count}). Verificar si hay problema.`,
        source: 'internal',
        relevance_score: 75,
        actionable: true,
        suggested_action: `Contactar a ${company} para verificar satisfacción y retención.`,
      })
    }
  }

  return insights
}

async function detectCAZAChanges() {
  const insights = []

  // Check CAZA pipeline for new high-score prospects
  const { data: hotProspects } = await supabase.from('caza_pipeline')
    .select('company_name, rfc, score, created_at')
    .gte('score', 70)
    .gte('created_at', daysAgo(7))
    .limit(10)

  for (const p of (hotProspects || [])) {
    insights.push({
      intel_type: 'market_opportunity',
      title: `Prospecto caliente: ${p.company_name}`,
      summary: `${p.company_name} (RFC: ${p.rfc}) tiene score ${p.score}/100 en el pipeline CAZA.`,
      source: 'caza_pipeline',
      relevance_score: p.score,
      actionable: true,
      suggested_action: `Contactar a ${p.company_name} — alto potencial de conversión.`,
    })
  }

  return insights
}

async function main() {
  console.log(`🔭 Competitive Intelligence — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const startTime = Date.now()

  const allInsights = [
    ...(await detectTariffChanges()),
    ...(await detectVolumeShifts()),
    ...(await detectCAZAChanges()),
  ]

  console.log(`  ${allInsights.length} insights detectados`)

  // Dedup: check if we already reported this
  for (const ins of allInsights) {
    const { data: existing } = await supabase.from('competitive_intel')
      .select('id')
      .eq('title', ins.title)
      .gte('detected_at', daysAgo(7))
      .maybeSingle()

    if (existing) {
      console.log(`  skip (recent): ${ins.title}`)
      continue
    }

    console.log(`  🔭 [${ins.intel_type}] ${ins.title}`)

    if (!DRY_RUN) {
      await supabase.from('competitive_intel').insert(ins)
        .catch(err => console.error(`  ⚠ ${err.message}`))
    }
  }

  // Telegram digest (only if there are actionable items)
  const actionable = allInsights.filter(i => i.actionable)
  if (actionable.length > 0) {
    const lines = [
      `🔭 <b>Inteligencia Competitiva</b>`,
      ``,
      ...actionable.slice(0, 5).map(i =>
        `• <b>${i.title}</b>\n  ${i.summary.substring(0, 80)}`
      ),
      ``,
      `${allInsights.length} total · ${actionable.length} accionables`,
      `— CRUZ 🔭`,
    ]
    await tg(lines.join('\n'))
  }

  if (!DRY_RUN) {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME, status: 'success',
      details: { insights: allInsights.length, actionable: actionable.length },
    }).catch(() => {})
  }

  console.log(`\n✅ ${allInsights.length} insights · ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await tg(`🔴 <b>${SCRIPT_NAME}</b> failed: ${err.message}`)
  process.exit(1)
})
