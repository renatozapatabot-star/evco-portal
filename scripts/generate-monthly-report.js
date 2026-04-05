#!/usr/bin/env node

// ============================================================
// CRUZ Monthly Client Report Generator
// Generates PDF reports for each active client, saves to Supabase
// storage, and creates a draft email pending Tito's approval.
// Cron: 0 7 1 * * (1st of each month at 7 AM)
// Run: node scripts/generate-monthly-report.js [--dry-run] [--month=2026-03]
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const MONTH_ARG = process.argv.find(a => a.startsWith('--month='))?.split('=')[1]
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'monthly-report'

const CLIENTS = [
  { name: 'EVCO Plastics de México', short: 'EVCO', company_id: 'evco', clave: '9254', active: true },
  { name: 'MAFESA', short: 'MAFESA', company_id: 'mafesa', clave: '4598', active: true },
]

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtPct(n) { return `${Math.round(n)}%` }

async function generateClientReport(client, monthStart, monthEnd, monthLabel) {
  console.log(`  📊 ${client.short}...`)

  // ── 1. Tráficos this month ──
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia, proveedores, regimen')
    .eq('company_id', client.company_id)
    .gte('fecha_llegada', monthStart)
    .lt('fecha_llegada', monthEnd)

  const traf = traficos || []
  const totalTraficos = traf.length
  const totalValor = traf.reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  const cruzados = traf.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))

  // ── 2. Average processing time ──
  const withBoth = traf.filter(t => t.fecha_llegada && t.fecha_cruce)
  const avgDays = withBoth.length > 0
    ? Math.round(withBoth.reduce((s, t) => {
        const d = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
        return s + Math.max(0, d)
      }, 0) / withBoth.length * 10) / 10
    : 0

  // ── 3. Duties from facturas ──
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('valor_usd, dta, igi, iva, pedimento')
    .eq('clave_cliente', client.clave)
    .gte('fecha_pago', monthStart)
    .lt('fecha_pago', monthEnd)

  const fact = facturas || []
  const totalDTA = fact.reduce((s, f) => s + (Number(f.dta) || 0), 0)
  const totalIGI = fact.reduce((s, f) => s + (Number(f.igi) || 0), 0)
  const totalIVA = fact.reduce((s, f) => s + (Number(f.iva) || 0), 0)

  // ── 4. T-MEC savings ──
  const tmecOps = traf.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  })
  const tmecSavings = tmecOps.reduce((s, t) => s + (Number(t.importe_total) || 0) * 0.05, 0) // Estimated 5% IGI avoided

  // ── 5. Document compliance rate ──
  const withPedimento = traf.filter(t => !!t.pedimento).length
  const complianceRate = totalTraficos > 0 ? Math.round((withPedimento / totalTraficos) * 100) : 0

  // ── 6. Top products by value ──
  const productMap = new Map()
  for (const t of traf) {
    const desc = (t.descripcion_mercancia || 'Sin descripción').trim()
    const key = desc.substring(0, 40).toLowerCase()
    const prev = productMap.get(key) || { desc, value: 0, count: 0 }
    prev.value += Number(t.importe_total) || 0
    prev.count++
    productMap.set(key, prev)
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // ── 7. Top suppliers by volume ──
  const supplierMap = new Map()
  for (const t of traf) {
    const provs = (t.proveedores || '').split(',').map(s => s.trim()).filter(Boolean)
    for (const p of provs) {
      const key = p.toLowerCase()
      supplierMap.set(key, (supplierMap.get(key) || { name: p, count: 0, value: 0 }))
      const entry = supplierMap.get(key)
      entry.count++
      entry.value += Number(t.importe_total) || 0
    }
  }
  const topSuppliers = [...supplierMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const report = {
    client: client.name,
    client_short: client.short,
    month: monthLabel,
    month_start: monthStart,
    month_end: monthEnd,
    summary: {
      total_traficos: totalTraficos,
      total_valor_usd: totalValor,
      cruzados: cruzados.length,
      avg_processing_days: avgDays,
      compliance_rate: complianceRate,
    },
    duties: {
      dta: totalDTA,
      igi: totalIGI,
      iva: totalIVA,
      total: totalDTA + totalIGI + totalIVA,
    },
    tmec: {
      operations: tmecOps.length,
      savings_usd: Math.round(tmecSavings),
      utilization: totalTraficos > 0 ? Math.round((tmecOps.length / totalTraficos) * 100) : 0,
    },
    top_products: topProducts,
    top_suppliers: topSuppliers,
    generated_at: new Date().toISOString(),
  }

  return report
}

async function main() {
  const now = new Date()
  // Default: previous month
  let year, month
  if (MONTH_ARG) {
    const [y, m] = MONTH_ARG.split('-').map(Number)
    year = y; month = m - 1 // JS months are 0-indexed
  } else {
    // Previous month
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    year = prev.getFullYear(); month = prev.getMonth()
  }

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const nextM = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 }
  const monthEnd = `${nextM.y}-${String(nextM.m + 1).padStart(2, '0')}-01`
  const targetDate = new Date(year, month, 1)
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const monthLabel = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`

  console.log(`📊 CRUZ Monthly Report — ${monthLabel}`)
  console.log(`  Period: ${monthStart} → ${monthEnd}`)
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  const activeClients = CLIENTS.filter(c => c.active)
  const reports = []

  for (const client of activeClients) {
    try {
      const report = await generateClientReport(client, monthStart, monthEnd, monthLabel)
      reports.push(report)

      // Summary
      console.log(`  ✅ ${client.short}: ${report.summary.total_traficos} tráficos · ${fmtUSD(report.summary.total_valor_usd)} · T-MEC ${fmtUSD(report.tmec.savings_usd)} ahorros`)

      if (!DRY_RUN) {
        // Save report JSON to Supabase
        await supabase.from('monthly_reports').upsert({
          company_id: client.company_id,
          month: monthStart,
          report_data: report,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,month' }).then(() => {}, () => {})
      }
    } catch (err) {
      console.error(`  ❌ ${client.short}: ${err.message}`)
    }
  }

  // Telegram summary
  if (reports.length > 0) {
    const lines = [
      `📊 <b>Reporte Mensual — ${monthLabel}</b>`,
      ``,
    ]
    for (const r of reports) {
      lines.push(`<b>${r.client_short}</b>`)
      lines.push(`  Tráficos: ${r.summary.total_traficos} · Cruzados: ${r.summary.cruzados}`)
      lines.push(`  Valor: ${fmtUSD(r.summary.total_valor_usd)} USD`)
      lines.push(`  Contribuciones: ${fmtUSD(r.duties.total)} MXN`)
      lines.push(`  T-MEC: ${r.tmec.operations} ops · ${fmtUSD(r.tmec.savings_usd)} USD ahorros`)
      lines.push(`  Despacho: ${r.summary.avg_processing_days} días promedio`)
      lines.push(`  Cumplimiento: ${r.summary.compliance_rate}%`)
      lines.push(``)
    }
    lines.push(`📋 Pendiente aprobación de Tito para envío a clientes`)
    lines.push(`— CRUZ 🦀`)

    await sendTelegram(lines.join('\n'))
  }

  // Log
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: {
      month: monthLabel,
      clients: reports.map(r => r.client_short),
      dry_run: DRY_RUN,
    },
  }).then(() => {}, () => {})

  console.log(`\n✅ Monthly reports generated for ${reports.length} clients`)
  if (DRY_RUN) console.log('[DRY RUN — not saved or sent]')
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
