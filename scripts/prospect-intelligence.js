#!/usr/bin/env node
/**
 * CRUZ Prospect Intelligence Engine
 *
 * Scans aduanet_facturas data and builds prospect profiles
 * for companies crossing through Aduana 240.
 * Cross-references with current clients.
 *
 * Data: aduanet_facturas (RFC, value, proveedor, regime)
 *       companies (current clients to exclude)
 *       globalpc_productos (fracciones for T-MEC analysis)
 *
 * Cron: 0 23 * * 0 (Sunday night)
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const { getExchangeRate } = require('./lib/rates')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function fmtMXN(n) { return '$' + Math.round(n).toLocaleString('en-US') }
function fmtUSD(n) { return '$' + Math.round(n).toLocaleString('en-US') }

// ── T-MEC eligible chapters ──────────────────────────
const TMEC_CHAPTERS = new Set([
  '39', '84', '85', '87', '40', '73', '38', '90', '72', '48',
  '76', '82', '83', '94', '29', '32', '68', '70', '74'
])

// ── Opportunity scoring algorithm ────────────────────
function calculateOpportunityScore(profile) {
  let score = 0

  // Volume: more pedimentos = better prospect
  if (profile.total_pedimentos >= 100) score += 25
  else if (profile.total_pedimentos >= 50) score += 20
  else if (profile.total_pedimentos >= 20) score += 15
  else if (profile.total_pedimentos >= 10) score += 10
  else score += 5

  // Value: higher value = higher fees
  if (profile.total_valor_usd >= 10000000) score += 25
  else if (profile.total_valor_usd >= 5000000) score += 20
  else if (profile.total_valor_usd >= 1000000) score += 15
  else if (profile.total_valor_usd >= 500000) score += 10
  else score += 5

  // T-MEC opportunity
  if (profile.tmec_savings_opportunity_mxn > 500000) score += 20
  else if (profile.tmec_savings_opportunity_mxn > 100000) score += 15
  else if (profile.tmec_savings_opportunity_mxn > 50000) score += 10

  // IMMEX complexity
  if (profile.uses_immex) score += 10

  // Frequency (active importers)
  const avgPerMonth = profile.total_pedimentos / 12
  if (avgPerMonth >= 10) score += 10
  else if (avgPerMonth >= 5) score += 7
  else score += 3

  // Multiple suppliers = more complex = needs expert broker
  if (profile.supplier_count >= 10) score += 10
  else if (profile.supplier_count >= 5) score += 5

  return Math.min(100, score)
}

// Estimated annual fees
let _cachedTC = null
async function getCachedTC() {
  if (!_cachedTC) { const { rate } = await getExchangeRate(); _cachedTC = rate }
  return _cachedTC
}

async function estimateAnnualFees(valorUSD, pedimentos) {
  const tc = await getCachedTC()
  const valueFee = valorUSD * 0.003 * tc // 0.3% of value in MXN
  const pedFee = pedimentos * 2500 // avg per pedimento MXN
  return Math.round(valueFee + pedFee)
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🎯 PROSPECT INTELLIGENCE ENGINE — CRUZ Build 9')
  console.log('═'.repeat(55))
  const start = Date.now()

  // 1. Load current clients
  console.log('\n📋 Loading current clients...')
  const { data: clients } = await supabase.from('companies')
    .select('rfc, clave_cliente, company_id, name')
  const clientRFCs = new Set((clients || []).map(c => c.rfc?.toUpperCase()).filter(Boolean))
  const clientClaves = new Set((clients || []).map(c => c.clave_cliente).filter(Boolean))
  console.log(`  ${clientRFCs.size} current client RFCs`)

  // 2. Load ALL aduanet facturas
  console.log('\n📦 Loading aduanet facturas...')
  let allFacturas = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('aduanet_facturas')
      .select('rfc, nombre_cliente, clave_cliente, pedimento, proveedor, valor_usd, igi, dta, fecha_pago, operacion, cve_documento')
      .range(offset, offset + 2999)
    if (!data || data.length === 0) break
    allFacturas = allFacturas.concat(data)
    offset += 3000
    if (data.length < 3000) break
  }
  console.log(`  ${allFacturas.length} facturas loaded`)

  // 3. Group by RFC
  console.log('\n🔍 Building prospect profiles...')
  const byRFC = {}
  for (const f of allFacturas) {
    if (!f.rfc) continue
    const rfc = f.rfc.toUpperCase()
    if (!byRFC[rfc]) {
      byRFC[rfc] = {
        rfc,
        name: f.nombre_cliente,
        clave: f.clave_cliente,
        pedimentos: new Set(),
        proveedores: new Set(),
        totalValorUSD: 0,
        totalIGI: 0,
        regimes: new Set(),
        facturas: [],
        firstDate: null,
        lastDate: null,
      }
    }
    const g = byRFC[rfc]
    if (f.pedimento) g.pedimentos.add(f.pedimento)
    if (f.proveedor) g.proveedores.add(f.proveedor)
    g.totalValorUSD += Number(f.valor_usd) || 0
    g.totalIGI += Number(f.igi) || 0
    if (f.operacion) g.regimes.add(f.operacion)
    if (f.cve_documento) g.regimes.add(f.cve_documento)
    g.facturas.push(f)
    if (f.fecha_pago) {
      if (!g.firstDate || f.fecha_pago < g.firstDate) g.firstDate = f.fecha_pago
      if (!g.lastDate || f.fecha_pago > g.lastDate) g.lastDate = f.fecha_pago
    }
  }

  console.log(`  ${Object.keys(byRFC).length} unique RFCs found`)

  // 4. Build prospect profiles
  const prospects = []
  for (const [rfc, g] of Object.entries(byRFC)) {
    const isCurrentClient = clientRFCs.has(rfc)
    const pedCount = g.pedimentos.size
    const supplierCount = g.proveedores.size
    const usesImmex = g.regimes.has('IN') || g.regimes.has('A1')

    // T-MEC opportunity: if they paid IGI but could have used T-MEC
    // Estimate: 5% avg duty rate * value from US/CA suppliers
    const tc = await getCachedTC()
    const tmecSavingsMXN = g.totalIGI > 0 ? g.totalIGI * 0.5 : g.totalValorUSD * 0.02 * tc

    const profile = {
      rfc,
      razon_social: g.name,
      aduana: '240',
      first_seen_date: g.firstDate,
      last_seen_date: g.lastDate,
      total_pedimentos: pedCount,
      total_valor_usd: Math.round(g.totalValorUSD * 100) / 100,
      avg_valor_por_pedimento: pedCount > 0 ? Math.round(g.totalValorUSD / pedCount * 100) / 100 : 0,
      top_proveedores: [...g.proveedores].slice(0, 10).map(p => ({ name: p })),
      primary_regime: [...g.regimes][0] || null,
      uses_immex: usesImmex,
      likely_tmec_eligible: tmecSavingsMXN > 10000,
      tmec_savings_opportunity_mxn: Math.round(tmecSavingsMXN),
      estimated_annual_value_usd: Math.round(g.totalValorUSD),
      estimated_annual_fees_mxn: await estimateAnnualFees(g.totalValorUSD, pedCount),
      high_value_importer: g.totalValorUSD > 1000000,
      is_current_client: isCurrentClient,
      current_client_clave: isCurrentClient ? g.clave : null,
      supplier_count: supplierCount,
      status: isCurrentClient ? 'current_client' : 'prospect',
    }

    profile.opportunity_score = calculateOpportunityScore(profile)
    prospects.push(profile)
  }

  // Sort by score
  prospects.sort((a, b) => b.opportunity_score - a.opportunity_score)

  // 5. Save to database
  console.log('\n💾 Saving to trade_prospects...')
  let saved = 0
  let errors = 0

  for (const p of prospects) {
    const { error } = await supabase.from('trade_prospects').upsert({
      rfc: p.rfc,
      razon_social: p.razon_social,
      aduana: p.aduana,
      first_seen_date: p.first_seen_date,
      last_seen_date: p.last_seen_date,
      total_pedimentos: p.total_pedimentos,
      total_valor_usd: p.total_valor_usd,
      avg_valor_por_pedimento: p.avg_valor_por_pedimento,
      top_proveedores: p.top_proveedores,
      primary_regime: p.primary_regime,
      uses_immex: p.uses_immex,
      likely_tmec_eligible: p.likely_tmec_eligible,
      tmec_savings_opportunity_mxn: p.tmec_savings_opportunity_mxn,
      estimated_annual_value_usd: p.estimated_annual_value_usd,
      estimated_annual_fees_mxn: p.estimated_annual_fees_mxn,
      opportunity_score: p.opportunity_score,
      high_value_importer: p.high_value_importer,
      is_current_client: p.is_current_client,
      current_client_clave: p.current_client_clave,
      status: p.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'rfc' })

    if (error) {
      if (errors === 0) console.log(`  ⚠️ First error: ${error.message}`)
      errors++
    } else {
      saved++
    }
  }

  // Save sightings (top 5 facturas per prospect)
  let sightingsSaved = 0
  for (const [rfc, g] of Object.entries(byRFC)) {
    for (const f of g.facturas.slice(0, 5)) {
      const { error } = await supabase.from('prospect_sightings').insert({
        prospect_rfc: rfc,
        pedimento: f.pedimento,
        fecha_pago: f.fecha_pago,
        valor_usd: f.valor_usd,
        proveedor: f.proveedor,
        regime: f.cve_documento || f.operacion,
        patente_agente: '3596',
        source: 'aduanet',
      })
      if (!error) sightingsSaved++
    }
  }

  // 6. Print results
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const nonClients = prospects.filter(p => !p.is_current_client)
  const highPriority = nonClients.filter(p => p.opportunity_score >= 70)

  console.log('\n' + '═'.repeat(55))
  console.log('PROSPECT INTELLIGENCE COMPLETE')
  console.log('═'.repeat(55))
  console.log(`Total companies: ${prospects.length}`)
  console.log(`Current clients: ${prospects.filter(p => p.is_current_client).length}`)
  console.log(`Prospects (non-client): ${nonClients.length}`)
  console.log(`High priority (70+): ${highPriority.length}`)
  console.log(`Saved: ${saved} | Sightings: ${sightingsSaved} | Errors: ${errors}`)
  console.log(`Time: ${elapsed}s`)

  console.log('\nTOP 10 PROSPECTS:')
  prospects.slice(0, 10).forEach((p, i) => {
    const tag = p.is_current_client ? ' [CLIENT]' : ''
    console.log(
      `${String(i + 1).padStart(2)}. ${(p.razon_social || p.rfc).substring(0, 35).padEnd(37)}` +
      `Score: ${String(p.opportunity_score).padStart(3)} | ` +
      `${fmtUSD(p.total_valor_usd)} USD | ` +
      `${p.total_pedimentos} peds | ` +
      `Fees: ${fmtMXN(p.estimated_annual_fees_mxn)} MXN/yr${tag}`
    )
  })

  // 7. Telegram report
  const topNonClients = nonClients.slice(0, 5)
  const totalPipeline = nonClients.reduce((s, p) => s + p.estimated_annual_fees_mxn, 0)

  await tg(
    `🎯 <b>PROSPECT INTELLIGENCE — ADUANA 240</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${prospects.length} empresas identificadas\n` +
    `${nonClients.length} prospectos (no clientes)\n` +
    `${highPriority.length} alta prioridad (70+)\n` +
    `Pipeline total: ${fmtMXN(totalPipeline)} MXN/año\n` +
    `\n<b>TOP 5 PROSPECTOS:</b>\n` +
    (topNonClients.length > 0
      ? topNonClients.map((p, i) =>
          `${i + 1}. ${(p.razon_social || p.rfc).substring(0, 28)}\n` +
          `   Score: ${p.opportunity_score}/100 · ${fmtUSD(p.total_valor_usd)} USD\n` +
          `   Est. honorarios: ${fmtMXN(p.estimated_annual_fees_mxn)} MXN/año`
        ).join('\n\n')
      : 'Todos son clientes actuales — excelente cobertura') +
    `\n\n${elapsed}s\n━━━━━━━━━━━━━━━━━━━━\n— CRUZ 🦀`
  )
}

main().catch(async (err) => {
  console.error('❌ Fatal:', err.message)
  await tg(`❌ Prospect engine error:\n${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
