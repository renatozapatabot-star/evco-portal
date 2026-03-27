const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function run() {
  console.log('🚛 Carrier Performance Scorecard\n')
  const { data: traficos } = await supabase.from('traficos').select('trafico, estatus, transportista_extranjero, transportista_mexicano, fecha_llegada, peso_bruto').eq('company_id', 'evco').not('transportista_extranjero', 'is', null)
  const { data: entradas } = await supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', 'evco')
  const rows = traficos || []; const entMap = {}
  ;(entradas || []).forEach(e => { if (!entMap[e.trafico]) entMap[e.trafico] = { f: 0, d: 0, t: 0 }; entMap[e.trafico].t++; if (e.tiene_faltantes) entMap[e.trafico].f++; if (e.mercancia_danada) entMap[e.trafico].d++ })
  const carriers = {}
  rows.forEach(t => { const c = t.transportista_extranjero; if (!c) return; if (!carriers[c]) carriers[c] = { s: 0, p: 0, f: 0, d: 0, e: 0 }; carriers[c].s++; carriers[c].p += t.peso_bruto || 0; const ent = entMap[t.trafico]; if (ent) { carriers[c].e += ent.t; carriers[c].f += ent.f; carriers[c].d += ent.d } })
  const ranked = Object.entries(carriers).sort((a, b) => b[1].s - a[1].s).slice(0, 15).map(([name, c]) => ({
    name: name.substring(0, 30), shipments: c.s, avg_peso: c.s > 0 ? Math.round(c.p / c.s) : 0,
    faltantes_rate: c.e > 0 ? ((c.f / c.e) * 100).toFixed(1) + '%' : '0%', danos_rate: c.e > 0 ? ((c.d / c.e) * 100).toFixed(1) + '%' : '0%',
    score: Math.max(0, 100 - (c.e > 0 ? ((c.f + c.d) / c.e) * 100 * 10 : 0)).toFixed(0)
  }))
  console.log('CARRIER'.padEnd(32) + 'SHIPS'.padEnd(8) + 'AVG KG'.padEnd(10) + 'FALTANTES'.padEnd(12) + 'DAÑOS'.padEnd(10) + 'SCORE')
  console.log('─'.repeat(80))
  ranked.forEach(c => console.log(c.name.padEnd(32) + String(c.shipments).padEnd(8) + String(c.avg_peso.toLocaleString('es-MX')).padEnd(10) + c.faltantes_rate.padEnd(12) + c.danos_rate.padEnd(10) + `${c.score}/100`))
  console.log(`\n✅ ${ranked.length} carriers analyzed from ${rows.length} tráficos`)
}
run().catch(console.error)
