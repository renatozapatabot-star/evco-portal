#!/usr/bin/env node
// scripts/pedimento-risk-score.js — FEATURE 1
// Calculate risk scores for all active tráficos
// Cron: 0 */4 * * * (every 4 hours)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function main() {
  console.log('🔍 Pedimento Risk Score Engine — CRUZ')
  const start = Date.now()

  // 1. Fetch active tráficos
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, estatus, pedimento, fecha_llegada, transportista_extranjero, descripcion_mercancia, importe_total, peso_bruto')
    .eq('company_id', COMPANY_ID).eq('estatus', 'En Proceso')

  if (!traficos?.length) { console.log('No active tráficos'); return }
  console.log(`${traficos.length} active tráficos to score`)

  // 2. Fetch supporting data in parallel
  const [entRes, supplierRes, carrierRes, factRes] = await Promise.all([
    supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID),
    supabase.from('supplier_contacts').select('supplier_name, usmca_eligible'),
    supabase.from('traficos').select('transportista_extranjero').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('referencia, valor_usd, pedimento').eq('clave_cliente', '9254'),
  ])

  // Build lookup maps
  const entradaMap = {}
  ;(entRes.data || []).forEach(e => {
    if (!entradaMap[e.trafico]) entradaMap[e.trafico] = { faltantes: false, danos: false }
    if (e.tiene_faltantes) entradaMap[e.trafico].faltantes = true
    if (e.mercancia_danada) entradaMap[e.trafico].danos = true
  })

  const approvedSuppliers = new Set((supplierRes.data || []).map(s => s.supplier_name?.toUpperCase()))
  const tmecSuppliers = new Set((supplierRes.data || []).filter(s => s.usmca_eligible).map(s => s.supplier_name?.toUpperCase()))

  // Carrier frequency
  const carrierCount = {}
  ;(carrierRes.data || []).forEach(t => {
    const c = t.transportista_extranjero || 'UNKNOWN'
    carrierCount[c] = (carrierCount[c] || 0) + 1
  })

  // Value stats per fracción (use importe_total as proxy)
  const values = (factRes.data || []).map(f => f.valor_usd || 0).filter(v => v > 0)
  const avgVal = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  const stdVal = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - avgVal) ** 2, 0) / values.length) : avgVal * 0.5

  // 3. Score each tráfico
  const scores = []
  const highRisk = []

  for (const t of traficos) {
    let score = 0
    const factors = []
    const now = Date.now()

    // No pedimento number: +35
    if (!t.pedimento) { score += 35; factors.push('Sin pedimento (+35)') }

    // Days since arrival
    if (t.fecha_llegada) {
      const days = Math.floor((now - new Date(t.fecha_llegada).getTime()) / 86400000)
      if (days > 14) { score += 30; factors.push(`${days}d desde llegada (+30)`) }
      else if (days > 7) { score += 15; factors.push(`${days}d desde llegada (+15)`) }
      else if (days > 3) { score += 5; factors.push(`${days}d desde llegada (+5)`) }
    }

    // Value deviation
    const val = Number(t.importe_total) || 0
    if (val > 0 && stdVal > 0 && Math.abs(val - avgVal) > 2 * stdVal) {
      score += 20; factors.push('Valor atipico (+20)')
    }

    // New carrier (< 3 ops)
    const carrier = t.transportista_extranjero || 'UNKNOWN'
    if ((carrierCount[carrier] || 0) < 3) {
      score += 10; factors.push('Carrier nuevo (+10)')
    }

    // Supplier not approved
    const supplierName = (t.descripcion_mercancia || '').split(' ')[0]?.toUpperCase()
    if (supplierName && !approvedSuppliers.has(supplierName)) {
      // This is approximate — in practice we'd match against globalpc_proveedores
    }

    // Missing USMCA for T-MEC eligible
    // (approximation — would need doc check per trafico)

    // Friday
    if (new Date().getDay() === 5) { score += 5; factors.push('Viernes (+5)') }

    // Faltantes / daños
    const ent = entradaMap[t.trafico]
    if (ent?.faltantes) { score += 25; factors.push('Con faltantes (+25)') }
    if (ent?.danos) { score += 20; factors.push('Con danos (+20)') }

    score = Math.min(100, score)

    scores.push({
      trafico_id: t.trafico,
      company_id: COMPANY_ID,
      score,
      overall_score: score,
      risk_factors: factors,
      carrier,
      valor_usd: val,
      calculated_at: new Date().toISOString(),
    })

    if (score > 70) highRisk.push({ trafico: t.trafico, score, factors })
  }

  // 4. Upsert to pedimento_risk_scores
  console.log(`Saving ${scores.length} risk scores...`)
  // Clear old scores for this company, then insert fresh
  await supabase.from('pedimento_risk_scores').delete().eq('company_id', COMPANY_ID)
  for (const batch of chunk(scores, 50)) {
    await supabase.from('pedimento_risk_scores').insert(batch)
  }

  // 5. Also update risk_score on traficos table
  for (const s of scores) {
    await supabase.from('traficos').update({ risk_score: s.score }).eq('trafico', s.trafico_id)
  }

  // 6. Telegram alerts for high risk
  if (highRisk.length > 0) {
    const lines = highRisk.slice(0, 10).map(r =>
      `  🔴 ${r.trafico}: ${r.score}/100\n     ${r.factors.slice(0, 3).join(', ')}`
    ).join('\n')
    await sendTG(`🚨 <b>RISK ALERT</b> — ${highRisk.length} tráficos con score > 70\n\n${lines}\n\n— CRUZ 🦀`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0
  console.log(`✅ ${scores.length} scored · avg ${avgScore} · ${highRisk.length} high risk · ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
