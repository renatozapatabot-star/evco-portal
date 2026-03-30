#!/usr/bin/env node
// scripts/monthly-report.js — BUILD 3 PHASE 13
// Auto-generated monthly intelligence report for ALL clients
// 5-section report: Executive, Operations, Financial, Compliance, Intelligence
// Cron: 0 8 1-7 * 1 (1st Monday of month, 8 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

// ── Multi-client config ──────────────────────────────
const CLIENTS = [
  { name: 'EVCO Plastics de México', company_id: 'evco', clave: '9254', active: true },
  // Add more clients as they onboard
]

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' MXN' }

async function generateClientReport(client) {
  console.log(`\n📊 Generating report for ${client.name}`)

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const periodStr = lastMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const monthFrom = lastMonth.toISOString().split('T')[0]
  const monthTo = lastMonthEnd.toISOString().split('T')[0]
  const reportPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

  // Gather all data
  const [trafRes, entRes, factRes, riskRes, rectRes, compRes, benchRes, regRes] = await Promise.all([
    supabase.from('traficos').select('trafico, estatus, fecha_llegada, fecha_cruce, updated_at, importe_total, transportista_extranjero, peso_bruto').eq('company_id', client.company_id).gte('fecha_llegada', monthFrom).lte('fecha_llegada', monthTo),
    supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', client.company_id),
    supabase.from('aduanet_facturas').select('valor_usd, igi, dta, iva, pedimento, proveedor, tc').eq('clave_cliente', client.clave).gte('fecha_pago', monthFrom).lte('fecha_pago', monthTo),
    supabase.from('pedimento_risk_scores').select('score, overall_score, trafico_id').eq('company_id', client.company_id).gte('calculated_at', monthFrom),
    supabase.from('rectificacion_opportunities').select('potential_recovery_mxn, opportunity_type').eq('company_id', client.company_id).eq('status', 'identified'),
    supabase.from('compliance_predictions').select('severity, resolved, prediction_type').eq('company_id', client.company_id),
    supabase.from('client_benchmarks').select('metrics, period').eq('company_id', client.company_id).order('period', { ascending: false }).limit(2),
    supabase.from('regulatory_alerts').select('title, severity, affected_clients').gte('created_at', monthFrom).limit(20),
  ])

  const traficos = trafRes.data || []
  const entradas = entRes.data || []
  const facturas = factRes.data || []
  const risks = riskRes.data || []
  const rectOps = rectRes.data || []
  const compliance = compRes.data || []
  const benchmarks = benchRes.data || []
  const regAlerts = (regRes.data || []).filter(a =>
    !a.affected_clients || a.affected_clients.includes(client.company_id)
  )

  // ── PAGE 1: Executive Summary ──────────────────────
  const totalOps = traficos.length
  const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz')).length
  const enProceso = totalOps - cruzados
  const totalValueUSD = facturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
  const tmecOps = facturas.filter(f => Number(f.igi || 0) === 0).length
  const tmecRate = facturas.length > 0 ? Math.round(tmecOps / facturas.length * 100) : 0

  // Health score
  const unresolved = compliance.filter(c => !c.resolved)
  const criticalCount = unresolved.filter(c => c.severity === 'critical').length
  const warningCount = unresolved.filter(c => c.severity === 'warning').length
  const healthScore = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5))
  const grade = healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : 'D'

  // ── PAGE 2: Operations ─────────────────────────────
  const crossingHours = traficos.filter(t => t.fecha_cruce && t.fecha_llegada).map(t => {
    const h = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    return h > 0 && h < 240 ? h : null
  }).filter(Boolean)
  const avgCrossing = crossingHours.length > 0 ? Math.round(crossingHours.reduce((a, b) => a + b, 0) / crossingHours.length * 10) / 10 : null
  const incidents = entradas.filter(e => e.tiene_faltantes || e.mercancia_danada).length
  const incidentRate = entradas.length > 0 ? (incidents / entradas.length * 100).toFixed(1) : '0'

  // Carrier performance
  const carrierOps = {}
  traficos.forEach(t => {
    const c = t.transportista_extranjero || 'Unknown'
    if (!carrierOps[c]) carrierOps[c] = { count: 0, crossedCount: 0 }
    carrierOps[c].count++
    if ((t.estatus || '').toLowerCase().includes('cruz')) carrierOps[c].crossedCount++
  })

  // ── PAGE 3: Financial ──────────────────────────────
  const totalIGI = facturas.reduce((s, f) => s + (Number(f.igi) || 0), 0)
  const totalDTA = facturas.reduce((s, f) => s + (Number(f.dta) || 0), 0)
  const totalIVA = facturas.reduce((s, f) => s + (Number(f.iva) || 0), 0)
  const avgTC = facturas.length > 0
    ? facturas.reduce((s, f) => s + (Number(f.tc) || 20), 0) / facturas.length
    : 20
  const tmecSavings = tmecOps * (totalValueUSD / Math.max(facturas.length, 1) * 0.05 * avgTC)
  const totalRecovery = rectOps.reduce((s, r) => s + (r.potential_recovery_mxn || 0), 0)

  // ── PAGE 4: Compliance ─────────────────────────────
  const avgRisk = risks.length > 0 ? Math.round(risks.reduce((s, r) => s + (r.overall_score || r.score || 0), 0) / risks.length) : 0

  // ── PAGE 5: Intelligence ───────────────────────────
  const highlights = []
  const recommendations = []

  if (tmecRate >= 80) highlights.push(`T-MEC aplicado en ${tmecRate}% de operaciones`)
  if (Number(incidentRate) < 1) highlights.push('Tasa de incidentes por debajo del 1%')
  if (avgCrossing && avgCrossing < 40) highlights.push(`Tiempo promedio de cruce ${avgCrossing}h — por debajo del benchmark`)
  if (totalOps > 0) highlights.push(`${totalOps} operaciones procesadas — ${fmtUSD(totalValueUSD)}`)

  if (tmecRate < 85) recommendations.push('Incrementar uso de T-MEC — revisar proveedores sin certificado USMCA')
  if (totalRecovery > 10000) recommendations.push(`Iniciar rectificaciones: ${fmtMXN(totalRecovery)} recuperable`)
  if (criticalCount > 0) recommendations.push(`Resolver ${criticalCount} alertas críticas de cumplimiento`)
  if (regAlerts.length > 0) recommendations.push(`Revisar ${regAlerts.length} cambios regulatorios del periodo`)
  recommendations.push('Verificar vigencia de e.firma, encargo conferido y padrón de importadores')

  // Build full report
  const reportData = {
    period: periodStr,
    report_period: reportPeriod,
    client: client.name,
    company_id: client.company_id,
    generated_at: new Date().toISOString(),

    page1_executive: {
      health_score: healthScore,
      grade,
      total_operations: totalOps,
      total_value_usd: Math.round(totalValueUSD),
      tmec_rate: tmecRate,
      key_metrics_vs_last_month: benchmarks.length >= 2 ? 'available' : 'first_report',
    },

    page2_operations: {
      total_traficos: totalOps,
      cruzados,
      en_proceso: enProceso,
      remesas_total: entradas.length,
      remesas_incidencias: incidents,
      avg_crossing_hours: avgCrossing,
      benchmark_hours: 39.5,
      carrier_performance: Object.entries(carrierOps).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([name, stats]) => ({ name, ops: stats.count, crossed: stats.crossedCount })),
    },

    page3_financial: {
      valor_total_usd: Math.round(totalValueUSD),
      valor_total_mxn: Math.round(totalValueUSD * avgTC),
      dta_total: Math.round(totalDTA),
      igi_total: Math.round(totalIGI),
      iva_total: Math.round(totalIVA),
      tmec_utilization: tmecRate,
      tmec_savings_mxn: Math.round(tmecSavings),
      rectificacion_potential: Math.round(totalRecovery),
      tipo_cambio_avg: Math.round(avgTC * 100) / 100,
    },

    page4_compliance: {
      health_score: healthScore,
      grade,
      critical_alerts: criticalCount,
      warning_alerts: warningCount,
      avg_risk_score: avgRisk,
      incident_rate: incidentRate,
    },

    page5_intelligence: {
      highlights,
      recommendations,
      regulatory_changes: regAlerts.slice(0, 5).map(a => ({ title: a.title, severity: a.severity })),
    },
  }

  // Generate narrative with Claude
  let narrative = ''
  if (ANTHROPIC_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1500,
          messages: [{ role: 'user', content: `Genera un resumen ejecutivo profesional en español para el reporte mensual de operaciones aduanales de ${client.name}, periodo ${periodStr}.

Datos clave:
- ${totalOps} operaciones, ${cruzados} cruzados
- Valor importado: ${fmtUSD(totalValueUSD)}
- T-MEC: ${tmecRate}%, ahorro estimado: ${fmtMXN(Math.round(tmecSavings))}
- Tiempo promedio cruce: ${avgCrossing || 'N/A'}h
- Score de cumplimiento: ${healthScore}/100 (${grade})
- Incidentes: ${incidentRate}%
- Rectificaciones potenciales: ${fmtMXN(totalRecovery)}
- Alertas regulatorias: ${regAlerts.length}

Hallazgos: ${JSON.stringify(highlights)}
Recomendaciones: ${JSON.stringify(recommendations)}

Máximo 4 párrafos. Tono ejecutivo profesional. Incluye recomendaciones accionables.` }]
        })
      })
      const data = await res.json()
      narrative = data.content?.[0]?.text || ''
    } catch (e) {
      console.log(`  ⚠️  Claude narrative failed: ${e.message}`)
    }
  }
  reportData.narrative = narrative

  // Save to database
  await supabase.from('monthly_intelligence_reports').delete()
    .eq('company_id', client.company_id).eq('period', reportPeriod)

  const { error: saveErr } = await supabase.from('monthly_intelligence_reports').insert({
    company_id: client.company_id,
    period: reportPeriod,
    report_data: reportData,
    generated_at: new Date().toISOString(),
  })
  if (saveErr) console.log(`  ⚠️  Save error: ${saveErr.message}`)

  // Console summary
  console.log(`  ${totalOps} ops · ${fmtUSD(totalValueUSD)} · T-MEC ${tmecRate}% · Health ${healthScore}/${grade}`)

  return { client: client.name, reportData }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('📊 MONTHLY INTELLIGENCE REPORT — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  const allFlag = process.argv.includes('--all')
  const clientFilter = process.argv.find(a => a.startsWith('--client='))?.split('=')[1]

  const clientsToProcess = CLIENTS.filter(c => {
    if (!c.active) return false
    if (clientFilter) return c.company_id === clientFilter
    return allFlag || c.company_id === 'evco' // Default to EVCO
  })

  console.log(`Processing ${clientsToProcess.length} client(s)`)

  const results = []
  for (const client of clientsToProcess) {
    try {
      const result = await generateClientReport(client)
      results.push(result)
    } catch (err) {
      console.log(`  ❌ ${client.name}: ${err.message}`)
    }
  }

  // Telegram summary
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodStr = lastMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  const tgLines = [`📊 <b>REPORTES MENSUALES — ${periodStr.toUpperCase()}</b>`, `━━━━━━━━━━━━━━━━━━━━━`]
  for (const r of results) {
    const rd = r.reportData
    const icon = rd.page1_executive.grade === 'A' ? '🟢' : rd.page1_executive.grade === 'B' ? '🟡' : '🔴'
    tgLines.push(`${icon} <b>${r.client}</b>`)
    tgLines.push(`  ${rd.page2_operations.total_traficos} ops · ${fmtUSD(rd.page3_financial.valor_total_usd)} · T-MEC ${rd.page3_financial.tmec_utilization}%`)
    tgLines.push(`  Health: ${rd.page1_executive.health_score}/100 (${rd.page1_executive.grade})`)
    tgLines.push('')
  }
  tgLines.push(`${results.length} reportes generados en ${elapsed}s`)
  tgLines.push(`👉 https://evco-portal.vercel.app/reportes`)
  tgLines.push(`━━━━━━━━━━━━━━━━━━━━━`)
  tgLines.push(`— CRUZ 🦀`)

  await sendTG(tgLines.join('\n'))

  console.log(`\n✅ ${results.length} reports generated · ${elapsed}s`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
