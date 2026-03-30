#!/usr/bin/env node
// scripts/benchmark-network.js — Client benchmarks vs industry averages
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const COMPANY_ID = 'evco', CLAVE = '9254'
const INDUSTRY = { tmec_utilization_rate: 56.4, avg_crossing_hours: 4.2, incident_rate: 1.8,
  document_completeness: 72, duty_rate_pct: 3.4, days_to_pedimento: 2.3 }

function pctl(client, industry, higherBetter) {
  return Math.max(0, Math.min(100, Math.round((higherBetter ? client / industry : industry / client) * 50)))
}
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

async function main() {
  console.log('Benchmark Network — CRUZ')
  const start = Date.now(), now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [trafRes, entRes, factRes, docRes, evtRes] = await Promise.all([
    supabase.from('traficos').select('trafico, fecha_llegada').eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('referencia, valor_usd, igi, dta, fecha_pago').eq('clave_cliente', CLAVE),
    supabase.from('expediente_documentos').select('pedimento_id, doc_type').eq('company_id', COMPANY_ID),
    supabase.from('globalpc_eventos').select('trafico, tipo_evento, fecha_evento').eq('company_id', COMPANY_ID),
  ])
  const traficos = trafRes.data || [], entradas = entRes.data || []
  const facturas = factRes.data || [], docs = docRes.data || [], eventos = evtRes.data || []

  // tmec_utilization_rate: % facturas where igi=0
  const tmecRate = facturas.length > 0
    ? (facturas.filter(f => Number(f.igi || 0) === 0).length / facturas.length) * 100 : 0

  // avg_crossing_hours: from globalpc_eventos timestamps
  const enter = {}, exit = {}
  eventos.forEach(e => {
    const t = e.trafico, ts = new Date(e.fecha_evento).getTime()
    if ((e.tipo_evento || '').match(/entrada|ingreso|in/i) && (!enter[t] || ts < enter[t])) enter[t] = ts
    if ((e.tipo_evento || '').match(/salida|cruce|out|liber/i) && (!exit[t] || ts > exit[t])) exit[t] = ts
  })
  const crossHrs = Object.keys(enter).map(t => {
    if (!exit[t]) return null
    const h = (exit[t] - enter[t]) / 3600000
    return h > 0 && h < 720 ? h : null
  }).filter(Boolean)

  // incident_rate: % entradas with mercancia_danada or tiene_faltantes
  const incidentRate = entradas.length > 0
    ? (entradas.filter(e => e.tiene_faltantes || e.mercancia_danada).length / entradas.length) * 100 : 0

  // document_completeness: avg docs per trafico / 10 target
  const dc = {}
  docs.forEach(d => { dc[d.pedimento_id] = (dc[d.pedimento_id] || 0) + 1 })
  const compVals = Object.values(dc).map(c => Math.min(100, (c / 10) * 100))

  // duty_rate_pct: (igi+dta) as % of valor_usd
  const totalVal = facturas.reduce((s, f) => s + Number(f.valor_usd || 0), 0)
  const totalDuty = facturas.reduce((s, f) => s + Number(f.igi || 0) + Number(f.dta || 0), 0)

  // days_to_pedimento: avg days from fecha_llegada to pedimento fecha_pago
  const daysArr = facturas.map(f => {
    if (!f.fecha_pago) return null
    const traf = traficos.find(t => t.trafico === f.referencia)
    if (!traf?.fecha_llegada) return null
    const d = (new Date(f.fecha_pago) - new Date(traf.fecha_llegada)) / 86400000
    return d > 0 && d < 180 ? d : null
  }).filter(Boolean)

  const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
  const computed = {
    tmec_utilization_rate:  { v: r(tmecRate), hi: true },
    avg_crossing_hours:     { v: r(avg(crossHrs)), hi: false },
    incident_rate:          { v: r(incidentRate, 2), hi: false },
    document_completeness:  { v: Math.round(avg(compVals)), hi: true },
    duty_rate_pct:          { v: r(totalVal > 0 ? (totalDuty / totalVal) * 100 : 0, 2), hi: false },
    days_to_pedimento:      { v: r(avg(daysArr)), hi: false },
  }

  // Delete existing period rows, then insert
  await supabase.from('client_benchmarks').delete().eq('company_id', COMPANY_ID).eq('period', period)
  const rows = Object.entries(computed).map(([metric, m]) => ({
    company_id: COMPANY_ID, period, metric_name: metric,
    client_value: m.v, industry_avg: INDUSTRY[metric],
    percentile: pctl(m.v, INDUSTRY[metric], m.hi), calculated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('client_benchmarks').insert(rows)
  if (error) console.error('Save error:', error.message)

  // Print summary
  console.log(`\nBenchmarks for ${period} (${facturas.length} facturas, ${traficos.length} traficos)`)
  console.log('Metric                   Client   Industry  Pctl')
  console.log('-'.repeat(52))
  rows.forEach(r => {
    console.log(`${r.metric_name.padEnd(25)}${String(r.client_value).padStart(7)}${String(r.industry_avg).padStart(9)}${String(r.percentile + '%').padStart(5)}`)
  })
  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
