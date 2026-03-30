#!/usr/bin/env node
/**
 * CRUZ Learning Engine
 * Discovers patterns from operational data per client
 * Runs nightly after pipeline
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function upsertMemory(company_id, pattern_key, pattern_value, confidence, actionable = false) {
  const { data: existing } = await supabase
    .from('cruz_memory')
    .select('id, observations')
    .eq('company_id', company_id)
    .eq('pattern_key', pattern_key)
    .single()

  if (existing) {
    await supabase.from('cruz_memory').update({
      pattern_value,
      confidence: Math.min(99, confidence),
      observations: (existing.observations || 0) + 1,
      last_seen: new Date().toISOString()
    }).eq('id', existing.id)
  } else {
    await supabase.from('cruz_memory').insert({
      company_id,
      pattern_type: 'operational',
      pattern_key,
      pattern_value,
      confidence,
      observations: 1,
      actionable,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString()
    })
  }
}

async function learnFromCompany(company) {
  const cid = company.company_id
  let patterns = 0

  // Pattern: Best crossing day
  const { data: crossings } = await supabase
    .from('traficos')
    .select('fecha_cruce')
    .eq('company_id', cid)
    .not('fecha_cruce', 'is', null)
    .limit(2000)

  if (crossings?.length > 20) {
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]
    crossings.forEach(c => { dayCounts[new Date(c.fecha_cruce).getDay()]++ })
    const bestIdx = dayCounts.indexOf(Math.max(...dayCounts))
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    await upsertMemory(cid, 'best_crossing_day', days[bestIdx],
      Math.min(95, 50 + crossings.length / 10), true)
    patterns++
  }

  // Pattern: Monthly volume spikes
  if (crossings?.length > 50) {
    const monthCounts = {}
    crossings.forEach(c => {
      const m = new Date(c.fecha_cruce).getMonth()
      monthCounts[m] = (monthCounts[m] || 0) + 1
    })
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const sorted = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      await upsertMemory(cid, 'peak_month', months[parseInt(sorted[0][0])], 75, true)
      patterns++
    }
  }

  // Pattern: Average crossing time
  const withBoth = (crossings || []).filter(c => c.fecha_cruce)
  const { data: withArrival } = await supabase
    .from('traficos')
    .select('fecha_llegada, fecha_cruce')
    .eq('company_id', cid)
    .not('fecha_llegada', 'is', null)
    .not('fecha_cruce', 'is', null)
    .limit(500)

  if (withArrival?.length > 10) {
    const hours = withArrival.map(t =>
      (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    ).filter(h => h > 0 && h < 720) // exclude outliers
    if (hours.length > 5) {
      const avg = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
      await upsertMemory(cid, 'avg_crossing_hours', `${avg}h`, 80, false)
      patterns++
    }
  }

  // Pattern: Top supplier by volume
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('cve_proveedor')
    .eq('company_id', cid)
    .limit(5000)

  if (facturas?.length > 20) {
    const provCounts = {}
    facturas.forEach(f => {
      if (f.cve_proveedor) provCounts[f.cve_proveedor] = (provCounts[f.cve_proveedor] || 0) + 1
    })
    const topProv = Object.entries(provCounts).sort((a, b) => b[1] - a[1])[0]
    if (topProv) {
      await upsertMemory(cid, 'top_supplier', `${topProv[0]} (${topProv[1]} ops)`, 90, false)
      patterns++
    }
  }

  return patterns
}

async function run() {
  console.log('\n🧠 CRUZ LEARNING ENGINE')
  console.log('═'.repeat(40))

  const { data: companies } = await supabase
    .from('companies').select('*').eq('active', true)

  let totalPatterns = 0
  for (const co of (companies || [])) {
    const p = await learnFromCompany(co)
    if (p > 0) console.log(`  ${co.name}: ${p} patterns`)
    totalPatterns += p
  }

  console.log(`\n✅ ${totalPatterns} patterns learned across ${companies?.length} clients`)
}

run().catch(console.error)
