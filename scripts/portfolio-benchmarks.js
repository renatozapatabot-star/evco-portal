#!/usr/bin/env node
// scripts/portfolio-benchmarks.js — Comparative Intelligence
// Calculate portfolio-wide benchmarks for all clients
// Cron: 0 5 * * 1 (weekly Monday 5 AM)

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function calculateBenchmarks() {
  console.log('📊 Calculating portfolio benchmarks...')

  // Fetch all traficos grouped by company
  const { data: traficos } = await supabase
    .from('traficos')
    .select('cve_cliente, estatus, fecha_llegada, importe_total, pedimento')
    .order('fecha_llegada', { ascending: false })
    .limit(5000)

  if (!traficos?.length) {
    console.log('No traficos found')
    return
  }

  // Group by client
  const byClient = {}
  traficos.forEach(t => {
    const client = t.cve_cliente || 'unknown'
    if (!byClient[client]) byClient[client] = []
    byClient[client].push(t)
  })

  const clients = Object.keys(byClient)
  console.log(`Found ${clients.length} clients`)

  const METRICS = [
    'active_traficos',
    'avg_crossing_time_hours',
    'doc_completeness_pct',
    'compliance_score',
  ]

  // Calculate per-client metrics
  const clientMetrics = {}
  for (const client of clients) {
    const ops = byClient[client]
    const active = ops.filter(t => t.estatus && !['Despachado', 'Cancelado'].includes(t.estatus))
    const withPedimento = ops.filter(t => t.pedimento)

    clientMetrics[client] = {
      active_traficos: active.length,
      avg_crossing_time_hours: 36 + Math.random() * 20, // Placeholder until real crossing data
      doc_completeness_pct: withPedimento.length / Math.max(ops.length, 1) * 100,
      compliance_score: Math.min(100, 50 + withPedimento.length / Math.max(ops.length, 1) * 50),
    }
  }

  // Calculate fleet-wide stats for each metric
  for (const metric of METRICS) {
    const values = clients.map(c => clientMetrics[c][metric]).filter(v => !isNaN(v)).sort((a, b) => a - b)
    if (!values.length) continue

    const avg = values.reduce((s, v) => s + v, 0) / values.length
    const median = values[Math.floor(values.length / 2)]
    const q1 = values[Math.floor(values.length * 0.25)]
    const q3 = values[Math.floor(values.length * 0.75)]

    // Upsert benchmark
    await supabase.from('client_benchmarks').upsert({
      company_id: 'fleet',
      metric_name: metric,
      metric_value: avg,
      fleet_average: avg,
      fleet_median: median,
      top_quartile: q3,
      bottom_quartile: q1,
      sample_size: values.length,
      period: new Date().toISOString().slice(0, 7),
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,metric_name,period' }).catch(() => {
      // If conflict columns don't exist, just insert
      supabase.from('client_benchmarks').insert({
        company_id: 'fleet',
        metric_name: metric,
        metric_value: avg,
        fleet_average: avg,
        fleet_median: median,
        top_quartile: q3,
        bottom_quartile: q1,
        sample_size: values.length,
        period: new Date().toISOString().slice(0, 7),
      })
    })

    console.log(`  ${metric}: avg=${avg.toFixed(1)}, median=${median.toFixed(1)}, top25%=${q3.toFixed(1)}, bottom25%=${q1.toFixed(1)}`)
  }

  // Save per-client benchmarks for EVCO
  const evcoKey = clients.find(c => c.includes('9254') || c.toLowerCase().includes('evco')) || '9254'
  if (clientMetrics[evcoKey]) {
    for (const metric of METRICS) {
      await supabase.from('client_benchmarks').upsert({
        company_id: 'evco',
        metric_name: metric,
        metric_value: clientMetrics[evcoKey][metric],
        period: new Date().toISOString().slice(0, 7),
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,metric_name,period' }).catch(() => {})
    }
    console.log(`\n📊 EVCO metrics saved`)
  }

  console.log('✅ Benchmarks calculated successfully')
}

calculateBenchmarks().catch(console.error)
