#!/usr/bin/env node
// scripts/benchmark-intelligence.js — FEATURE 13
// Calculate client performance benchmarks
// Cron: 0 6 1 * * (1st of each month at 6 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const COMPANY_ID = 'evco'
const CLAVE = '9254'

async function main() {
  console.log('📊 Benchmark Intelligence — CRUZ')
  const start = Date.now()

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // 1. Fetch all data in parallel
  const [trafRes, entRes, factRes, docRes] = await Promise.all([
    supabase.from('traficos').select('trafico, estatus, fecha_llegada, fecha_cruce, fecha_pago, importe_total').eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada, created_at').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('referencia, valor_usd, igi, dta, iva, fecha_pago, pedimento').eq('clave_cliente', CLAVE),
    supabase.from('expediente_documentos').select('pedimento_id, doc_type').eq('company_id', COMPANY_ID),
  ])

  const traficos = trafRes.data || []
  const entradas = entRes.data || []
  const facturas = factRes.data || []
  const docs = docRes.data || []

  // 2. Calculate metrics

  // 2a. Avg crossing hours (using real fecha_cruce, filter outliers > 72h)
  const cruzados = traficos.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
  const crossingHours = cruzados.map(t => {
    if (!t.fecha_llegada || !t.fecha_cruce) return null
    const h = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    return h > 0 && h <= 72 ? h : null
  }).filter(Boolean)
  const avgCrossing = crossingHours.length > 0 ? crossingHours.reduce((a, b) => a + b, 0) / crossingHours.length : 0

  // 2b. T-MEC utilization rate
  const totalFacturas = facturas.length
  const tmecFacturas = facturas.filter(f => Number(f.igi || 0) === 0).length
  const tmecRate = totalFacturas > 0 ? (tmecFacturas / totalFacturas * 100) : 0

  // 2c. Duty rate (total duties / total declared value)
  const totalValue = facturas.reduce((s, f) => s + (Number(f.valor_usd || 0)), 0)
  const totalDuties = facturas.reduce((s, f) => s + (Number(f.igi || 0)) + (Number(f.dta || 0)) + (Number(f.iva || 0)), 0)
  const dutyRate = totalValue > 0 ? (totalDuties / (totalValue * 20)) * 100 : 0 // as % of MXN value

  // 2d. Incident rate
  const totalEntradas = entradas.length
  const incidents = entradas.filter(e => e.tiene_faltantes || e.mercancia_danada).length
  const incidentRate = totalEntradas > 0 ? (incidents / totalEntradas * 100) : 0

  // 2e. Document completeness — % of tráficos that have at least 1 document
  const traficosWithDocs = new Set(docs.map(d => d.pedimento_id).filter(Boolean))
  const totalTraficosForDocs = traficos.length
  const avgCompleteness = totalTraficosForDocs > 0 ? (traficosWithDocs.size / totalTraficosForDocs * 100) : 0

  // 2f. Days to pedimento — use fecha_pago directly from traficos table
  // Filter to cruzados with both dates, cap at 30 days to exclude outliers
  const daysToP = traficos.map(t => {
    if (!t.fecha_llegada || !t.fecha_pago) return null
    const days = (new Date(t.fecha_pago).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
    return days > 0 && days <= 30 ? days : null
  }).filter(Boolean)
  const avgDaysToP = daysToP.length > 0 ? daysToP.reduce((a, b) => a + b, 0) / daysToP.length : 0

  // 3. Get historical benchmarks (own history)
  const { data: historicalBenchmarks } = await supabase.from('client_benchmarks')
    .select('*').eq('company_id', COMPANY_ID)
    .order('period', { ascending: false }).limit(12)

  const lastMonth = (historicalBenchmarks || [])[0]

  // 4. Determine trends
  function trend(current, previous) {
    if (!previous || previous === 0) return 'stable'
    const pctChange = ((current - previous) / previous) * 100
    if (Math.abs(pctChange) < 3) return 'stable'
    return pctChange > 0 ? 'up' : 'down'
  }

  const metrics = {
    avg_crossing_hours: { value: Math.round(avgCrossing * 10) / 10, trend: trend(avgCrossing, lastMonth?.metrics?.avg_crossing_hours?.value), unit: 'hours' },
    tmec_utilization_rate: { value: Math.round(tmecRate * 10) / 10, trend: trend(tmecRate, lastMonth?.metrics?.tmec_utilization_rate?.value), unit: '%' },
    duty_rate_pct: { value: Math.round(dutyRate * 100) / 100, trend: trend(dutyRate, lastMonth?.metrics?.duty_rate_pct?.value), unit: '%' },
    incident_rate: { value: Math.round(incidentRate * 100) / 100, trend: trend(incidentRate, lastMonth?.metrics?.incident_rate?.value), unit: '%' },
    document_completeness: { value: Math.round(avgCompleteness), trend: trend(avgCompleteness, lastMonth?.metrics?.document_completeness?.value), unit: '%' },
    days_to_pedimento: { value: Math.round(avgDaysToP * 10) / 10, trend: trend(avgDaysToP, lastMonth?.metrics?.days_to_pedimento?.value), unit: 'days' },
  }

  // Add vs_last_month for each metric
  if (lastMonth?.metrics) {
    Object.keys(metrics).forEach(key => {
      const prev = lastMonth.metrics[key]?.value
      if (prev !== undefined) {
        metrics[key].vs_last = Math.round((metrics[key].value - prev) * 10) / 10
      }
    })
  }

  // 5. Save to client_benchmarks (delete old first, then insert)
  await supabase.from('client_benchmarks').delete().eq('company_id', COMPANY_ID).eq('period', currentMonth)
  const { error } = await supabase.from('client_benchmarks').insert({
    company_id: COMPANY_ID,
    period: currentMonth,
    metrics,
    total_operations: traficos.length,
    total_value_usd: Math.round(totalValue),
    calculated_at: new Date().toISOString(),
  }, { onConflict: 'company_id,period' })

  if (error) console.log('Save error:', error.message)

  // 6. Print results
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ Benchmarks for ${currentMonth}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  Object.entries(metrics).forEach(([key, m]) => {
    const arrow = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'
    const vsLast = m.vs_last !== undefined ? ` (${m.vs_last > 0 ? '+' : ''}${m.vs_last})` : ''
    console.log(`  ${key}: ${m.value}${m.unit} ${arrow}${vsLast}`)
  })
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  ${traficos.length} operations · $${Math.round(totalValue).toLocaleString()} USD`)
  console.log(`  ${elapsed}s`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
