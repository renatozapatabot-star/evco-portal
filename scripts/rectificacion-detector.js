#!/usr/bin/env node
// scripts/rectificacion-detector.js — FEATURE 3
// Scan pedimentos for T-MEC recovery & rectificación opportunities
// Cron: 0 8 * * 0 (Sunday 8 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CLAVE = '9254'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

async function main() {
  console.log('🔎 Rectificacion Detector — CRUZ')
  const start = Date.now()

  // 1. Fetch all facturas with financial data
  const { data: facturas } = await supabase.from('aduanet_facturas')
    .select('referencia, pedimento, proveedor, valor_usd, igi, dta, iva, fecha_pago, tc')
    .eq('clave_cliente', CLAVE).order('fecha_pago', { ascending: false })

  if (!facturas?.length) { console.log('No facturas found'); return }
  console.log(`${facturas.length} facturas loaded`)

  // 2. Build supplier T-MEC profile
  // For each supplier: what % of ops have IGI = 0?
  const supplierOps = {} // supplier -> {total, tmec}
  facturas.forEach(f => {
    const prov = (f.proveedor || '').toUpperCase().trim()
    if (!prov) return
    if (!supplierOps[prov]) supplierOps[prov] = { total: 0, tmec: 0 }
    supplierOps[prov].total++
    if (Number(f.igi || 0) === 0) supplierOps[prov].tmec++
  })

  // Suppliers that usually use T-MEC (>50% ops with IGI=0)
  const tmecSuppliers = new Set()
  Object.entries(supplierOps).forEach(([prov, stats]) => {
    if (stats.total >= 3 && stats.tmec / stats.total > 0.5) tmecSuppliers.add(prov)
  })
  console.log(`${tmecSuppliers.size} T-MEC-typical suppliers identified`)

  // 3. Build fracción profiles for misclassification detection
  const fraccionByProduct = {} // description keyword -> Set of fracciones
  const valueByProv = {} // proveedor -> [valores]

  // 4. Scan for opportunities
  const opportunities = []
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

  facturas.forEach(f => {
    const prov = (f.proveedor || '').toUpperCase().trim()
    const igi = Number(f.igi || 0)
    const valorUSD = Number(f.valor_usd || 0)
    const tc = Number(f.tc || 20)
    const fechaPago = f.fecha_pago ? new Date(f.fecha_pago) : null

    // Track values per supplier for anomaly detection
    if (prov && valorUSD > 0) {
      if (!valueByProv[prov]) valueByProv[prov] = []
      valueByProv[prov].push(valorUSD)
    }

    // OPPORTUNITY 1: T-MEC retroactive recovery
    // Supplier usually does T-MEC but this op paid IGI
    if (igi > 0 && tmecSuppliers.has(prov) && fechaPago && fechaPago >= fiveYearsAgo) {
      const recoveryMXN = igi
      opportunities.push({
        trafico_id: f.referencia,
        pedimento: f.pedimento,
        opportunity_type: 'tmec_retroactive',
        supplier: prov,
        potential_recovery_mxn: recoveryMXN,
        potential_recovery_usd: Math.round(recoveryMXN / tc),
        description: `Proveedor ${prov} usa T-MEC en ${Math.round((supplierOps[prov].tmec / supplierOps[prov].total) * 100)}% de ops pero esta pagó IGI ${fmtMXN(igi)}`,
        fecha_pago: f.fecha_pago,
        status: 'identified',
        company_id: 'evco',
        identified_at: new Date().toISOString(),
      })
    }
  })

  // OPPORTUNITY 2: Value anomalies (declared value significantly off)
  Object.entries(valueByProv).forEach(([prov, values]) => {
    if (values.length < 5) return
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
    if (std === 0) return

    facturas.filter(f => (f.proveedor || '').toUpperCase().trim() === prov).forEach(f => {
      const val = Number(f.valor_usd || 0)
      if (val > 0 && Math.abs(val - avg) > 2.5 * std) {
        const deviation = ((val - avg) / avg * 100).toFixed(0)
        opportunities.push({
          trafico_id: f.referencia,
          pedimento: f.pedimento,
          opportunity_type: 'value_correction',
          supplier: prov,
          potential_recovery_mxn: 0, // needs manual review
          potential_recovery_usd: 0,
          description: `Valor ${deviation > 0 ? '+' : ''}${deviation}% vs promedio de ${prov} (${fmtMXN(val * 20)} vs avg ${fmtMXN(avg * 20)})`,
          fecha_pago: f.fecha_pago,
          status: 'identified',
          company_id: 'evco',
          identified_at: new Date().toISOString(),
        })
      }
    })
  })

  console.log(`${opportunities.length} opportunities identified`)

  // 5. Save to rectificacion_opportunities
  if (opportunities.length > 0) {
    // Clear old identified (not acted upon)
    await supabase.from('rectificacion_opportunities')
      .delete().eq('company_id', 'evco').eq('status', 'identified')

    for (const batch of chunk(opportunities, 50)) {
      const { error } = await supabase.from('rectificacion_opportunities').insert(batch)
      if (error) console.log('Insert error:', error.message)
    }
  }

  // 6. Calculate totals
  const tmecOps = opportunities.filter(o => o.opportunity_type === 'tmec_retroactive')
  const totalRecovery = tmecOps.reduce((s, o) => s + (o.potential_recovery_mxn || 0), 0)
  const valueOps = opportunities.filter(o => o.opportunity_type === 'value_correction')

  // 7. Telegram summary
  const summary = [
    `📊 <b>RECTIFICACION SCAN</b>`,
    ``,
    `T-MEC Recovery: ${tmecOps.length} oportunidades`,
    `💰 Recuperacion potencial: ${fmtMXN(totalRecovery)} MXN`,
    ``,
    `Anomalias de valor: ${valueOps.length} ops flagged`,
    ``,
    tmecOps.length > 0 ? `Top 3:` : '',
    ...tmecOps.sort((a, b) => b.potential_recovery_mxn - a.potential_recovery_mxn).slice(0, 3).map(o =>
      `  • ${o.pedimento || o.trafico_id}: ${fmtMXN(o.potential_recovery_mxn)} (${o.supplier})`
    ),
    ``,
    `— CRUZ 🦀`
  ].filter(Boolean).join('\n')

  // Only send Telegram if recovery opportunities found
  if (totalRecovery > 0 || tmecOps.length > 0 || valueOps.length > 0) {
    await sendTG(summary)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✅ ${opportunities.length} opportunities · ${fmtMXN(totalRecovery)} potential · ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
