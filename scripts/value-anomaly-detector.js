#!/usr/bin/env node
// scripts/value-anomaly-detector.js — BUILD 3 PHASE 5
// Value Anomaly Detection — find transfer pricing risks before SAT does
// Checks: unit price z-scores, invoice totals, value/kg, COVE mismatches
// Cron: 0 6 * * * (daily 6 AM)

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
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🔍 VALUE ANOMALY DETECTOR — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  // Load active tráficos
  const { data: activeTraficos } = await supabase.from('traficos')
    .select('trafico, company_id, peso_bruto')
    .not('estatus', 'ilike', '%cruz%')
    .limit(500)

  if (!activeTraficos?.length) {
    console.log('No active tráficos found')
    return
  }
  console.log(`${activeTraficos.length} active tráficos to check`)

  // Load all products for baseline
  console.log('\n📦 Loading product baselines...')
  let allProducts = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('globalpc_productos')
      .select('producto_id, cve_trafico, descripcion, fraccion, valor_unitario, cantidad, cve_proveedor')
      .range(offset, offset + 2999)
    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    offset += 3000
    if (data.length < 3000) break
  }
  console.log(`  ${allProducts.length.toLocaleString()} products loaded`)

  // Load facturas
  const { data: allFacturas } = await supabase.from('globalpc_facturas')
    .select('factura_id, cve_trafico, proveedor, valor, cove')
    .limit(10000)

  // Build baselines per fraccion + proveedor
  console.log('\n📊 Building price baselines...')
  const baselines = {} // key: fraccion|proveedor -> { prices: [], avg, stdDev }
  for (const p of allProducts) {
    if (!p.fraccion || !p.valor_unitario || p.valor_unitario <= 0) continue
    const key = `${p.fraccion}|${p.cve_proveedor || 'ALL'}`
    if (!baselines[key]) baselines[key] = { prices: [] }
    baselines[key].prices.push(p.valor_unitario)
  }

  for (const [key, bl] of Object.entries(baselines)) {
    const prices = bl.prices
    bl.avg = prices.reduce((a, b) => a + b, 0) / prices.length
    bl.stdDev = prices.length > 1
      ? Math.sqrt(prices.reduce((s, p) => s + (p - bl.avg) ** 2, 0) / prices.length)
      : bl.avg * 0.3 // Default 30% std dev for single-sample
    bl.count = prices.length
  }
  console.log(`  ${Object.keys(baselines).length} price baselines built`)

  // Build invoice baselines per supplier
  const invoiceBaselines = {}
  for (const f of (allFacturas || [])) {
    const prov = (f.proveedor || 'UNKNOWN').toUpperCase().trim()
    if (!invoiceBaselines[prov]) invoiceBaselines[prov] = []
    if (f.valor > 0) invoiceBaselines[prov].push(f.valor)
  }

  // Build value-per-kg baseline
  const vpkValues = []
  for (const t of (activeTraficos || []).concat([])) {
    const tFacts = (allFacturas || []).filter(f => f.cve_trafico === t.trafico)
    const totalVal = tFacts.reduce((s, f) => s + (f.valor || 0), 0)
    if (totalVal > 0 && t.peso_bruto > 0) {
      vpkValues.push(totalVal / t.peso_bruto)
    }
  }
  // Also gather from historical
  let histTraficos = []
  const { data: histData } = await supabase.from('traficos')
    .select('trafico, peso_bruto')
    .ilike('estatus', '%cruz%')
    .limit(2000)
  histTraficos = histData || []
  for (const t of histTraficos) {
    const tFacts = (allFacturas || []).filter(f => f.cve_trafico === t.trafico)
    const totalVal = tFacts.reduce((s, f) => s + (f.valor || 0), 0)
    if (totalVal > 0 && t.peso_bruto > 0) {
      vpkValues.push(totalVal / t.peso_bruto)
    }
  }
  const vpkAvg = vpkValues.length > 0 ? vpkValues.reduce((a, b) => a + b, 0) / vpkValues.length : 1
  const vpkStd = vpkValues.length > 1
    ? Math.sqrt(vpkValues.reduce((s, v) => s + (v - vpkAvg) ** 2, 0) / vpkValues.length)
    : vpkAvg * 0.5

  // ── Check each active tráfico ──────────────────────
  console.log('\n🔎 Scanning for anomalies...')
  const anomalies = []

  for (const t of activeTraficos) {
    const tProds = allProducts.filter(p => p.cve_trafico === t.trafico)
    const tFacts = (allFacturas || []).filter(f => f.cve_trafico === t.trafico)

    // CHECK 1: Unit price vs historical average (z-score)
    for (const p of tProds) {
      if (!p.fraccion || !p.valor_unitario || p.valor_unitario <= 0) continue
      const key = `${p.fraccion}|${p.cve_proveedor || 'ALL'}`
      const bl = baselines[key]
      if (!bl || bl.count < 3 || bl.stdDev === 0) continue

      const zScore = (p.valor_unitario - bl.avg) / bl.stdDev
      if (Math.abs(zScore) > 2) {
        anomalies.push({
          trafico: t.trafico,
          company_id: t.company_id || 'evco',
          type: 'unit_price',
          severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
          description: `${p.descripcion?.substring(0, 60)} — price ${fmtUSD(p.valor_unitario)} vs avg ${fmtUSD(bl.avg)} (z=${zScore.toFixed(1)})`,
          details: {
            producto_id: p.producto_id,
            current_price: p.valor_unitario,
            avg_price: bl.avg,
            std_dev: bl.stdDev,
            z_score: Math.round(zScore * 10) / 10,
            fraccion: p.fraccion,
            proveedor: p.cve_proveedor,
          }
        })
      }
    }

    // CHECK 2: Total invoice value vs historical for same supplier
    for (const f of tFacts) {
      if (!f.valor || f.valor <= 0) continue
      const prov = (f.proveedor || 'UNKNOWN').toUpperCase().trim()
      const hist = invoiceBaselines[prov]
      if (!hist || hist.length < 3) continue

      const avg = hist.reduce((a, b) => a + b, 0) / hist.length
      const deviation = Math.abs(f.valor - avg) / avg
      if (deviation > 0.25) {
        anomalies.push({
          trafico: t.trafico,
          company_id: t.company_id || 'evco',
          type: 'invoice_total',
          severity: deviation > 0.5 ? 'critical' : 'warning',
          description: `Invoice from ${f.proveedor} — ${fmtUSD(f.valor)} vs avg ${fmtUSD(avg)} (${(deviation * 100).toFixed(0)}% deviation)`,
          details: {
            factura_id: f.factura_id,
            current_value: f.valor,
            avg_value: avg,
            deviation_pct: Math.round(deviation * 100),
            proveedor: f.proveedor,
          }
        })
      }
    }

    // CHECK 3: Value per kg anomaly
    const totalVal = tFacts.reduce((s, f) => s + (f.valor || 0), 0)
    if (totalVal > 0 && t.peso_bruto > 0) {
      const vpk = totalVal / t.peso_bruto
      if (vpk > vpkAvg * 3) {
        anomalies.push({
          trafico: t.trafico,
          company_id: t.company_id || 'evco',
          type: 'value_per_kg',
          severity: vpk > vpkAvg * 5 ? 'critical' : 'warning',
          description: `Value/kg ${fmtUSD(vpk)}/kg vs avg ${fmtUSD(vpkAvg)}/kg — possible under-declaration of weight`,
          details: {
            value_per_kg: Math.round(vpk * 100) / 100,
            avg_vpk: Math.round(vpkAvg * 100) / 100,
            total_value: totalVal,
            peso_bruto: t.peso_bruto,
          }
        })
      }
    }

    // CHECK 4: COVE vs invoice mismatch
    for (const f of tFacts) {
      if (!f.cove || !f.valor || f.valor <= 0) continue
      // If COVE value is stored as a number, compare
      const coveVal = typeof f.cove === 'number' ? f.cove : parseFloat(f.cove)
      if (!isNaN(coveVal) && coveVal > 0) {
        const mismatch = Math.abs(coveVal - f.valor) / f.valor
        if (mismatch > 0.01) { // > 1% discrepancy
          anomalies.push({
            trafico: t.trafico,
            company_id: t.company_id || 'evco',
            type: 'cove_mismatch',
            severity: mismatch > 0.05 ? 'critical' : 'warning',
            description: `COVE ${fmtUSD(coveVal)} vs Invoice ${fmtUSD(f.valor)} — ${(mismatch * 100).toFixed(1)}% discrepancy`,
            details: {
              factura_id: f.factura_id,
              cove_value: coveVal,
              invoice_value: f.valor,
              mismatch_pct: Math.round(mismatch * 100),
            }
          })
        }
      }
    }
  }

  // ── Save anomalies ─────────────────────────────────
  console.log(`\n💾 Found ${anomalies.length} anomalies`)
  const critical = anomalies.filter(a => a.severity === 'critical')
  const warnings = anomalies.filter(a => a.severity === 'warning')
  console.log(`  ${critical.length} critical, ${warnings.length} warnings`)

  // Save to anomaly_baselines or compliance_predictions
  for (const a of anomalies) {
    await supabase.from('compliance_predictions').insert({
      company_id: a.company_id,
      prediction_type: `value_anomaly_${a.type}`,
      severity: a.severity,
      description: a.description,
      details: a.details,
      source: 'value-anomaly-detector',
      resolved: false,
      predicted_at: new Date().toISOString(),
    }).catch(() => {})
  }

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log('VALUE ANOMALY SCAN COMPLETE')
  console.log('═'.repeat(55))

  const byType = {}
  for (const a of anomalies) {
    byType[a.type] = (byType[a.type] || 0) + 1
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log(`Total: ${anomalies.length} | Time: ${elapsed}s`)

  // ── Telegram (critical only) ───────────────────────
  if (critical.length > 0) {
    const list = critical.slice(0, 5).map(a =>
      `• ${a.trafico}: ${a.description.substring(0, 80)}`
    ).join('\n')

    await sendTG(`⚠️ <b>VALUE ANOMALY ALERT</b>
━━━━━━━━━━━━━━━━━━━━━
${critical.length} critical anomalies detected:

${list}
${critical.length > 5 ? `\n... and ${critical.length - 5} more` : ''}

Total anomalies: ${anomalies.length}
Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`)
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
