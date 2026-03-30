#!/usr/bin/env node
/**
 * CRUZ Knowledge Graph Builder
 * Builds entity relationships from operational data
 * Runs weekly
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function upsertRelationship(a_type, a_id, rel, b_type, b_id, strength, company_id = 'all') {
  await supabase.from('entity_relationships').upsert({
    entity_a_type: a_type,
    entity_a_id: a_id,
    relationship: rel,
    entity_b_type: b_type,
    entity_b_id: b_id,
    strength: Math.min(100, Math.round(strength)),
    company_id,
    last_updated: new Date().toISOString()
  }, { onConflict: 'entity_a_type,entity_a_id,relationship,entity_b_type,entity_b_id' })
}

async function buildSupplierProductRelationships() {
  const { data } = await supabase
    .from('globalpc_productos')
    .select('cve_proveedor, fraccion, company_id')
    .not('cve_proveedor', 'is', null)
    .not('fraccion', 'is', null)
    .limit(50000)

  const pairs = {}
  ;(data || []).forEach(r => {
    const key = `${r.cve_proveedor}__${r.fraccion}`
    if (!pairs[key]) pairs[key] = { prov: r.cve_proveedor, frac: r.fraccion, count: 0 }
    pairs[key].count++
  })

  let written = 0
  for (const p of Object.values(pairs)) {
    if (p.count >= 3) {
      await upsertRelationship('supplier', p.prov, 'ships_hts_code', 'hts_code', p.frac, p.count)
      written++
    }
  }
  return written
}

async function buildCarrierPerformance() {
  const { data } = await supabase
    .from('traficos')
    .select('transportista_extranjero, fecha_llegada, fecha_cruce')
    .not('transportista_extranjero', 'is', null)
    .not('fecha_cruce', 'is', null)
    .limit(10000)

  const carriers = {}
  ;(data || []).forEach(r => {
    const c = r.transportista_extranjero
    if (!carriers[c]) carriers[c] = { hours: [], count: 0 }
    carriers[c].count++
    if (r.fecha_llegada && r.fecha_cruce) {
      const h = (new Date(r.fecha_cruce).getTime() - new Date(r.fecha_llegada).getTime()) / 3600000
      if (h > 0 && h < 720) carriers[c].hours.push(h)
    }
  })

  let written = 0
  for (const [name, stats] of Object.entries(carriers)) {
    if (stats.hours.length >= 5) {
      const avg = stats.hours.reduce((a, b) => a + b, 0) / stats.hours.length
      await upsertRelationship('carrier', name, 'avg_crossing_hours', 'metric', Math.round(avg).toString(), stats.count)
      written++
    }
  }
  return written
}

async function run() {
  console.log('\n🕸️  KNOWLEDGE GRAPH BUILDER')
  console.log('═'.repeat(40))

  const [supplierRels, carrierRels] = await Promise.all([
    buildSupplierProductRelationships(),
    buildCarrierPerformance()
  ])

  console.log(`  Supplier→Product: ${supplierRels} relationships`)
  console.log(`  Carrier→Performance: ${carrierRels} relationships`)
  console.log(`  Total: ${supplierRels + carrierRels}`)
}

run().catch(console.error)
