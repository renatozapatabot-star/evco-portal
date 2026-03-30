#!/usr/bin/env node
/**
 * CRUZ T-MEC Optimization Engine
 * Runs weekly — finds savings opportunities across all clients
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function optimizeClient(company) {
  const cid = company.company_id
  const clave = company.clave_cliente || company.globalpc_clave

  // Get facturas where IGI was paid
  const { data: withIGI } = await supabase
    .from('aduanet_facturas')
    .select('referencia, proveedor, fraccion, valor_usd, igi, fecha_pago')
    .eq('clave_cliente', clave)
    .gt('igi', 0)
    .order('igi', { ascending: false })
    .limit(500)

  if (!withIGI?.length) return null

  // Get T-MEC eligible suppliers
  const { data: suppliers } = await supabase
    .from('supplier_network')
    .select('supplier_name, tmec_eligible')
    .eq('tmec_eligible', true)

  const tmecSuppliers = new Set((suppliers || []).map(s => s.supplier_name?.toUpperCase()))

  let recoveryTotal = 0
  const opportunities = []

  for (const f of withIGI) {
    const supplierUpper = (f.proveedor || '').toUpperCase()
    if (tmecSuppliers.has(supplierUpper)) {
      recoveryTotal += f.igi || 0
      opportunities.push({
        referencia: f.referencia,
        proveedor: f.proveedor,
        fraccion: f.fraccion,
        igi_paid: f.igi,
        valor_usd: f.valor_usd,
        fecha_pago: f.fecha_pago,
        action: 'Request USMCA certificate — rectificación possible'
      })
    }
  }

  // Calculate current T-MEC rate
  const { data: allFacturas } = await supabase
    .from('aduanet_facturas')
    .select('igi')
    .eq('clave_cliente', clave)
    .limit(5000)

  const totalOps = allFacturas?.length || 1
  const tmecOps = (allFacturas || []).filter(f => (f.igi || 0) === 0).length
  const currentRate = ((tmecOps / totalOps) * 100).toFixed(1)

  // Future savings estimate
  const futureSavings = recoveryTotal * 2 // conservative 2x multiplier

  const report = {
    company_id: cid,
    company_name: company.name,
    current_tmec_rate: parseFloat(currentRate),
    target_rate: 85,
    igi_paid_unnecessarily_mxn: Math.round(recoveryTotal * 17.5),
    recovery_opportunities: opportunities.slice(0, 20),
    future_savings_if_optimized_mxn: Math.round(futureSavings * 17.5),
    total_operations: totalOps,
    tmec_operations: tmecOps,
    generated_at: new Date().toISOString()
  }

  // Save to financial_intelligence
  await supabase.from('financial_intelligence').upsert({
    company_id: cid,
    metric_name: 'tmec_optimization',
    metric_value: report.igi_paid_unnecessarily_mxn,
    details: report,
    calculated_at: new Date().toISOString()
  }, { onConflict: 'company_id,metric_name' })

  return report
}

async function run() {
  console.log('🇺🇸🇲🇽🇨🇦 T-MEC Optimization Engine — CRUZ')
  console.log('═'.repeat(50))

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('active', true)

  let totalRecovery = 0
  let clientsWithOpportunities = 0
  const highlights = []

  for (const company of (companies || [])) {
    const report = await optimizeClient(company)
    if (report && report.recovery_opportunities.length > 0) {
      clientsWithOpportunities++
      totalRecovery += report.igi_paid_unnecessarily_mxn
      console.log(`  📊 ${company.name}: T-MEC ${report.current_tmec_rate}% → target 85% | Recovery: MX$${report.igi_paid_unnecessarily_mxn.toLocaleString()}`)
      if (report.igi_paid_unnecessarily_mxn > 10000) {
        highlights.push(`${company.name}: MX$${report.igi_paid_unnecessarily_mxn.toLocaleString()}`)
      }
    } else {
      console.log(`  ✅ ${company.name}: No IGI recovery opportunities`)
    }
  }

  if (totalRecovery > 0) {
    await tg([
      `🇺🇸🇲🇽🇨🇦 <b>T-MEC OPTIMIZATION REPORT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${clientsWithOpportunities} clientes con oportunidades`,
      `💰 Total recuperable: MX$${totalRecovery.toLocaleString()}`,
      highlights.length > 0 ? `\n<b>TOP:</b>\n${highlights.join('\n')}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ].join('\n'))
  }

  console.log(`\n✅ ${clientsWithOpportunities} clients with opportunities`)
  console.log(`💰 Total recovery: MX$${totalRecovery.toLocaleString()}`)
}

run().catch(console.error)
