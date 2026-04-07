#!/usr/bin/env node
// scripts/rectificacion-scanner.js — BUILD 3 PHASE 6
// Rectificación Opportunity Scanner — find money left on the table
// Scans last 5 years: T-MEC recovery, classification errors, value errors, DTA errors
// Cron: 0 8 * * 0 (Sunday 8 AM)

const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' MXN' }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' USD' }
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Clients to scan ──────────────────────────────────
const CLIENTS = [
  { name: 'EVCO Plastics', clave: '9254', company_id: 'evco' },
  // Add more clients as they onboard
]

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🔎 RECTIFICACIÓN OPPORTUNITY SCANNER — CRUZ Build 3')
  console.log('═'.repeat(60))
  const start = Date.now()

  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0]

  let allOpportunities = []

  for (const client of CLIENTS) {
    console.log(`\n📋 Scanning: ${client.name} (${client.clave})`)

    // Load facturas with financial data
    const { data: facturas } = await supabase.from('aduanet_facturas')
      .select('referencia, pedimento, proveedor, valor_usd, igi, dta, iva, fecha_pago, tc, valor_aduana')
      .eq('clave_cliente', client.clave)
      .gte('fecha_pago', fiveYearsAgoStr)
      .order('fecha_pago', { ascending: false })

    if (!facturas?.length) {
      console.log('  No facturas found')
      continue
    }
    console.log(`  ${facturas.length} facturas loaded (last 5 years)`)

    // Load supplier T-MEC data
    const { data: suppliers } = await supabase.from('supplier_network')
      .select('supplier_name, tmec_eligible, country')
      .limit(500)

    const tmecSuppliers = new Set()
    for (const s of (suppliers || [])) {
      if (s.tmec_eligible) tmecSuppliers.add((s.supplier_name || '').toUpperCase().trim())
    }

    // Build supplier ops profile
    const supplierOps = {}
    facturas.forEach(f => {
      const prov = (f.proveedor || '').toUpperCase().trim()
      if (!prov) return
      if (!supplierOps[prov]) supplierOps[prov] = { total: 0, tmec: 0 }
      supplierOps[prov].total++
      if (Number(f.igi || 0) === 0) supplierOps[prov].tmec++
    })

    // Also mark suppliers with >50% T-MEC usage as eligible
    Object.entries(supplierOps).forEach(([prov, stats]) => {
      if (stats.total >= 3 && stats.tmec / stats.total > 0.5) tmecSuppliers.add(prov)
    })

    const opportunities = []

    // ── SCAN 1: T-MEC not applied where it could have been ──
    console.log('  🏷���  Scanning T-MEC recovery...')
    for (const f of facturas) {
      const igi = Number(f.igi || 0)
      if (igi <= 0) continue

      const prov = (f.proveedor || '').toUpperCase().trim()
      if (!tmecSuppliers.has(prov)) continue

      const fechaPago = f.fecha_pago ? new Date(f.fecha_pago) : null
      if (!fechaPago) continue

      // Statute of limitations: 5 years from fecha_pago
      const statuteExpires = new Date(fechaPago)
      statuteExpires.setFullYear(statuteExpires.getFullYear() + 5)
      const daysUntilExpiry = Math.floor((statuteExpires - Date.now()) / 86400000)
      if (daysUntilExpiry < 0) continue // Expired

      const tmecRate = supplierOps[prov] ? Math.round((supplierOps[prov].tmec / supplierOps[prov].total) * 100) : 0
      const confidence = tmecRate > 80 ? 90 : tmecRate > 60 ? 75 : 60

      opportunities.push({
        type: 'tmec_recovery',
        pedimento: f.pedimento || f.referencia,
        fecha_pago: f.fecha_pago,
        current_amount_paid: igi,
        correct_amount: 0,
        recovery_potential_mxn: igi,
        recovery_potential_usd: Math.round(igi / (Number(f.tc) || 20)),
        statute_expires: statuteExpires.toISOString().split('T')[0],
        days_until_expiry: daysUntilExpiry,
        confidence,
        supplier: prov,
        recommended_action: daysUntilExpiry < 60
          ? 'URGENTE: File rectificación within 60 days'
          : 'File rectificación — T-MEC certificate available',
        supporting_docs_needed: ['USMCA/T-MEC certificate', 'Supplier origin letter', 'Bill of materials'],
        company_id: client.company_id,
      })
    }

    // ── SCAN 2: DTA calculation errors ──────────────────
    console.log('  💰 Scanning DTA errors...')
    for (const f of facturas) {
      const dta = Number(f.dta || 0)
      const valorAduana = Number(f.valor_aduana || 0) || (Number(f.valor_usd || 0) * (Number(f.tc) || 20))
      if (dta <= 0 || valorAduana <= 0) continue

      // DTA should be 8‰ of valor aduana
      const expectedDTA = valorAduana * 0.008
      const deviation = Math.abs(dta - expectedDTA) / expectedDTA

      if (deviation > 0.10 && Math.abs(dta - expectedDTA) > 100) { // >10% deviation and >$100 MXN difference
        const overpaid = dta > expectedDTA
        if (!overpaid) continue // Only flag overpayments

        const fechaPago = f.fecha_pago ? new Date(f.fecha_pago) : null
        const statuteExpires = fechaPago ? new Date(fechaPago) : new Date()
        statuteExpires.setFullYear(statuteExpires.getFullYear() + 5)
        const daysUntilExpiry = Math.floor((statuteExpires - Date.now()) / 86400000)
        if (daysUntilExpiry < 0) continue

        opportunities.push({
          type: 'dta',
          pedimento: f.pedimento || f.referencia,
          fecha_pago: f.fecha_pago,
          current_amount_paid: dta,
          correct_amount: Math.round(expectedDTA),
          recovery_potential_mxn: Math.round(dta - expectedDTA),
          recovery_potential_usd: Math.round((dta - expectedDTA) / (Number(f.tc) || 20)),
          statute_expires: statuteExpires.toISOString().split('T')[0],
          days_until_expiry: daysUntilExpiry,
          confidence: 85,
          supplier: f.proveedor,
          recommended_action: 'Review DTA calculation — overpayment detected',
          supporting_docs_needed: ['Pedimento original', 'Valor aduana calculation'],
          company_id: client.company_id,
        })
      }
    }

    // ── SCAN 3: Value anomalies (overstated values) ─────
    console.log('  📊 Scanning value errors...')
    const valueByProv = {}
    facturas.forEach(f => {
      const prov = (f.proveedor || '').toUpperCase().trim()
      const val = Number(f.valor_usd || 0)
      if (prov && val > 0) {
        if (!valueByProv[prov]) valueByProv[prov] = []
        valueByProv[prov].push({ val, f })
      }
    })

    for (const [prov, entries] of Object.entries(valueByProv)) {
      if (entries.length < 5) continue
      const values = entries.map(e => e.val)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length)
      if (std === 0) continue

      for (const { val, f } of entries) {
        const zScore = (val - avg) / std
        if (zScore > 2.5 && Number(f.igi || 0) > 0) {
          // Overstated value = higher IGI than needed
          const overpaymentPct = ((val - avg) / avg)
          const estimatedOverpayment = Math.round(Number(f.igi) * overpaymentPct)
          if (estimatedOverpayment < 500) continue // Skip tiny amounts

          const fechaPago = f.fecha_pago ? new Date(f.fecha_pago) : null
          const statuteExpires = fechaPago ? new Date(fechaPago) : new Date()
          statuteExpires.setFullYear(statuteExpires.getFullYear() + 5)
          const daysUntilExpiry = Math.floor((statuteExpires - Date.now()) / 86400000)
          if (daysUntilExpiry < 0) continue

          opportunities.push({
            type: 'value',
            pedimento: f.pedimento || f.referencia,
            fecha_pago: f.fecha_pago,
            current_amount_paid: Number(f.igi),
            correct_amount: Math.round(Number(f.igi) * (1 - overpaymentPct)),
            recovery_potential_mxn: estimatedOverpayment,
            recovery_potential_usd: Math.round(estimatedOverpayment / (Number(f.tc) || 20)),
            statute_expires: statuteExpires.toISOString().split('T')[0],
            days_until_expiry: daysUntilExpiry,
            confidence: 60,
            supplier: prov,
            recommended_action: 'Review declared value — significantly above supplier average',
            supporting_docs_needed: ['Commercial invoice', 'Purchase order', 'Value reconciliation'],
            company_id: client.company_id,
          })
        }
      }
    }

    // ── SCAN 4: Classification errors (same product, different fracciones)
    console.log('  🏷️  Scanning classification inconsistencies...')
    const productos = await fetchAll(supabase.from('globalpc_productos')
      .select('descripcion, fraccion, cve_proveedor, cve_trafico')
      .not('fraccion', 'is', null))

    if (productos?.length) {
      // Group by description keyword + proveedor
      const fraccionGroups = {}
      for (const p of productos) {
        if (!p.descripcion || !p.fraccion) continue
        // Use first 3 words as key
        const descKey = p.descripcion.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
        const key = `${descKey}|${p.cve_proveedor || 'ALL'}`
        if (!fraccionGroups[key]) fraccionGroups[key] = {}
        fraccionGroups[key][p.fraccion] = (fraccionGroups[key][p.fraccion] || 0) + 1
      }

      let classificationIssues = 0
      for (const [key, fracciones] of Object.entries(fraccionGroups)) {
        const fracList = Object.entries(fracciones)
        if (fracList.length <= 1) continue
        // Multiple fracciones for same product = potential misclassification
        const total = fracList.reduce((s, [, c]) => s + c, 0)
        if (total < 5) continue // Need enough history

        const dominant = fracList.sort((a, b) => b[1] - a[1])[0]
        const minority = fracList.filter(([f]) => f !== dominant[0])

        for (const [frac, count] of minority) {
          if (count < 2) continue
          classificationIssues++
          opportunities.push({
            type: 'classification',
            pedimento: `Multiple (${count} ops)`,
            fecha_pago: null,
            current_amount_paid: 0,
            correct_amount: 0,
            recovery_potential_mxn: 0, // Needs manual review
            recovery_potential_usd: 0,
            statute_expires: null,
            days_until_expiry: null,
            confidence: 50,
            supplier: key.split('|')[1] || 'Various',
            recommended_action: `Product "${key.split('|')[0]}" classified as ${frac} (${count}x) but usually ${dominant[0]} (${dominant[1]}x) — review`,
            supporting_docs_needed: ['Classification opinion', 'Product technical specs'],
            company_id: client.company_id,
          })
        }
      }
      console.log(`    ${classificationIssues} classification inconsistencies found`)
    }

    allOpportunities = allOpportunities.concat(opportunities)

    // Client summary
    const tmecOps = opportunities.filter(o => o.type === 'tmec_recovery')
    const dtaOps = opportunities.filter(o => o.type === 'dta')
    const valueOps = opportunities.filter(o => o.type === 'value')
    const classOps = opportunities.filter(o => o.type === 'classification')
    const totalRecovery = opportunities.reduce((s, o) => s + (o.recovery_potential_mxn || 0), 0)

    console.log(`\n  📊 ${client.name} Summary:`)
    console.log(`    T-MEC recovery: ${tmecOps.length} ops — ${fmtMXN(tmecOps.reduce((s, o) => s + o.recovery_potential_mxn, 0))}`)
    console.log(`    DTA errors: ${dtaOps.length} ops — ${fmtMXN(dtaOps.reduce((s, o) => s + o.recovery_potential_mxn, 0))}`)
    console.log(`    Value errors: ${valueOps.length} ops — ${fmtMXN(valueOps.reduce((s, o) => s + o.recovery_potential_mxn, 0))}`)
    console.log(`    Classification: ${classOps.length} issues`)
    console.log(`    TOTAL RECOVERY: ${fmtMXN(totalRecovery)}`)
  }

  // ── Save all opportunities ─────────────────────────
  console.log('\n💾 Saving opportunities...')
  // Clear previous identified
  await supabase.from('rectificacion_opportunities')
    .delete().eq('status', 'identified')
    .catch(() => {})

  const toSave = allOpportunities.map(o => ({
    trafico_id: o.pedimento,
    pedimento: o.pedimento,
    opportunity_type: o.type,
    supplier: o.supplier,
    potential_recovery_mxn: o.recovery_potential_mxn,
    potential_recovery_usd: o.recovery_potential_usd,
    description: o.recommended_action,
    fecha_pago: o.fecha_pago,
    statute_expires: o.statute_expires,
    confidence: o.confidence,
    supporting_docs: o.supporting_docs_needed,
    status: 'identified',
    company_id: o.company_id,
    identified_at: new Date().toISOString(),
  }))

  for (const batch of chunk(toSave, 50)) {
    await supabase.from('rectificacion_opportunities').insert(batch).catch(err => {
      console.log(`  ⚠️  Save error: ${err.message}`)
    })
  }

  // ── Final summary ──────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const totalRecovery = allOpportunities.reduce((s, o) => s + (o.recovery_potential_mxn || 0), 0)
  const urgentCount = allOpportunities.filter(o => o.days_until_expiry && o.days_until_expiry < 90).length

  console.log('\n' + '═'.repeat(60))
  console.log('RECTIFICACIÓN SCAN COMPLETE')
  console.log('═'.repeat(60))
  console.log(`Total opportunities: ${allOpportunities.length}`)
  console.log(`Total recovery potential: ${fmtMXN(totalRecovery)}`)
  console.log(`Urgent (< 90 days to expire): ${urgentCount}`)
  console.log(`Time: ${elapsed}s`)

  // ── Telegram ───────────────────────────────────────
  const byType = {}
  for (const o of allOpportunities) {
    if (!byType[o.type]) byType[o.type] = { count: 0, mxn: 0 }
    byType[o.type].count++
    byType[o.type].mxn += o.recovery_potential_mxn || 0
  }

  const report = `🔎 <b>RECTIFICACIÓN SCAN</b>
━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(byType).map(([t, v]) => `${t}: ${v.count} ops — ${fmtMXN(v.mxn)}`).join('\n')}

<b>TOTAL: ${fmtMXN(totalRecovery)}</b>
⚠️ ${urgentCount} urgent (statute < 90 days)

${allOpportunities.filter(o => o.days_until_expiry && o.days_until_expiry < 90).slice(0, 3).map(o =>
  `• ${o.pedimento}: ${fmtMXN(o.recovery_potential_mxn)} — expires ${o.statute_expires}`
).join('\n')}

Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  await sendTG(report)
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
