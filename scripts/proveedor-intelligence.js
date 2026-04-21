const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CLAVE = '9254'

function fmt(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
  console.log('✅ Telegram sent')
}

async function runProveedorIntelligence() {
  console.log('🏭 Running Proveedor Intelligence...')

  // Pull all facturas
  const { data: all, error } = await supabase
    .from('aduanet_facturas')
    .select('proveedor, valor_usd, fecha_pago, pedimento, referencia')
    .eq('clave_cliente', CLAVE)
    .not('proveedor', 'is', null)
    .order('fecha_pago', { ascending: false })

  if (error) { console.error('Supabase error:', error); return }

  const facturas = all || []
  console.log(`📋 Analyzing ${facturas.length} facturas`)

  // Build supplier history
  const history = {}
  facturas.forEach(f => {
    if (!f.proveedor) return
    if (!history[f.proveedor]) {
      history[f.proveedor] = {
        name: f.proveedor,
        total_valor: 0,
        count: 0,
        first_seen: f.fecha_pago,
        last_seen: f.fecha_pago,
        fracciones: [],
      }
    }
    history[f.proveedor].total_valor += f.valor_usd || 0
    history[f.proveedor].count++
    if (f.fecha_pago < history[f.proveedor].first_seen) history[f.proveedor].first_seen = f.fecha_pago
    if (f.fecha_pago > history[f.proveedor].last_seen) history[f.proveedor].last_seen = f.fecha_pago
    // fracciones removed — column doesn't exist in aduanet_facturas
  })

  const suppliers = Object.values(history).map(s => ({
    ...s
  }))

  // Sort by total value
  suppliers.sort((a, b) => b.total_valor - a.total_valor)

  console.log(`\n📊 EVCO Supplier Summary:`)
  console.log(`Total suppliers: ${suppliers.length}`)

  // Top 10
  console.log(`\nTop 10 by value:`)
  suppliers.slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name}`)
    console.log(`     ${fmtUSD(s.total_valor)} · ${s.count} ops · Last: ${s.last_seen}`)
  })

  // New suppliers in last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0]

  // A "new" supplier is one whose first_seen is within last 30 days
  const newSuppliers = suppliers.filter(s => s.first_seen >= thirtyDaysStr)

  console.log(`\nNew suppliers (last 30 days): ${newSuppliers.length}`)
  newSuppliers.forEach(s => console.log(`  + ${s.name} · First seen: ${s.first_seen}`))

  // Dormant suppliers — not seen in 6+ months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsStr = sixMonthsAgo.toISOString().split('T')[0]
  const dormant = suppliers.filter(s => s.last_seen < sixMonthsStr && s.count >= 3)

  console.log(`Dormant suppliers (6+ months, 3+ ops): ${dormant.length}`)

  // Build Telegram report
  const lines = [
    `🏭 <b>PROVEEDOR INTELLIGENCE</b>`,
    `EVCO Plastics · ${nowCST()}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Total proveedores EVCO: <b>${suppliers.length}</b>`,
    ``,
    `<b>TOP 5 POR VALOR:</b>`,
    ...suppliers.slice(0, 5).map((s, i) =>
      `${i + 1}. ${s.name.substring(0, 35)}\n   ${fmtUSD(s.total_valor)} · ${s.count} ops`
    ),
    ``
  ]

  if (newSuppliers.length > 0) {
    lines.push(`<b>🆕 NUEVOS (últimos 30 días): ${newSuppliers.length}</b>`)
    newSuppliers.slice(0, 5).forEach(s => {
      lines.push(`  + ${s.name.substring(0, 40)}`)
      lines.push(`    Primera vez: ${s.first_seen}`)
    })
    lines.push(``)
  } else {
    lines.push(`✅ Sin proveedores nuevos este mes`)
    lines.push(``)
  }

  if (dormant.length > 0) {
    lines.push(`<b>💤 DORMANTES (6+ meses): ${dormant.length}</b>`)
    dormant.slice(0, 3).forEach(s => {
      lines.push(`  • ${s.name.substring(0, 40)} · Último: ${s.last_seen}`)
    })
    lines.push(``)
  }

  lines.push(`— CRUZ 🦀`)

  await sendTelegram(lines.join('\n'))

  // Save summary to file for reference
  const summary = {
    generated: new Date().toISOString(),
    total_suppliers: suppliers.length,
    new_last_30_days: newSuppliers.length,
    dormant_6_months: dormant.length,
    top_10: suppliers.slice(0, 10).map(s => ({
      name: s.name,
      total_valor_usd: Math.round(s.total_valor),
      operations: s.count,
      first_seen: s.first_seen,
      last_seen: s.last_seen,
      fracciones: s.fracciones
    }))
  }

  const fs = require('fs')
  const outputPath = './scripts/proveedor-summary.json'
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))
  console.log(`\n✅ Summary saved to ${outputPath}`)
}

runProveedorIntelligence().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
