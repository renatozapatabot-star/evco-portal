#!/usr/bin/env node
// scripts/supplier-network.js — FEATURE 5
// Build cross-client supplier intelligence network
// Cron: 0 10 * * 1 (Monday 10 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  console.log('🕸️  Supplier Network Builder — CRUZ')
  const start = Date.now()

  // 1. Fetch data sources
  const [proveedores, facturas, entradas, partidas] = await Promise.all([
    fetchAll(supabase.from('globalpc_proveedores').select('cve_proveedor, nombre, pais')),
    fetchAll(supabase.from('aduanet_facturas').select('proveedor, valor_usd, igi, referencia, pedimento')),
    fetchAll(supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', 'evco')),
    fetchAll(supabase.from('globalpc_partidas').select('cve_proveedor, fraccion_arancelaria, fraccion')),
  ])

  // 2. Build supplier profiles
  const suppliers = {} // normalized_name -> profile

  function normName(name) {
    return (name || '').toUpperCase().trim().replace(/\s+/g, ' ')
      .replace(/,?\s*(S\.?A\.?\s*DE\s*C\.?V\.?|INC\.?|LLC|LTD|CORP\.?|CO\.?)$/i, '').trim()
  }

  // From globalpc_proveedores
  proveedores.forEach(p => {
    const name = normName(p.nombre || p.cve_proveedor)
    if (!name) return
    if (!suppliers[name]) suppliers[name] = {
      supplier_name: p.nombre || p.cve_proveedor,
      supplier_country: p.pais || 'US',
      total_operations: 0, tmec_count: 0, total_value_usd: 0,
      faltantes: 0, danos: 0, total_entradas: 0,
      fracciones: {}, seen_by_clients: ['evco'],
    }
    if (p.pais) suppliers[name].supplier_country = p.pais
  })

  // From aduanet_facturas
  facturas.forEach(f => {
    const name = normName(f.proveedor)
    if (!name) return
    if (!suppliers[name]) suppliers[name] = {
      supplier_name: f.proveedor,
      supplier_country: 'US',
      total_operations: 0, tmec_count: 0, total_value_usd: 0,
      faltantes: 0, danos: 0, total_entradas: 0,
      fracciones: {}, seen_by_clients: ['evco'],
    }
    suppliers[name].total_operations++
    suppliers[name].total_value_usd += Number(f.valor_usd || 0)
    if (Number(f.igi || 0) === 0) suppliers[name].tmec_count++
  })

  // From globalpc_partidas — fracciones per supplier
  partidas.forEach(p => {
    const name = normName(p.cve_proveedor)
    const frac = p.fraccion_arancelaria || p.fraccion
    if (!name || !frac || !suppliers[name]) return
    suppliers[name].fracciones[frac] = (suppliers[name].fracciones[frac] || 0) + 1
  })

  // From entradas — incident tracking
  const entradaMap = {}
  entradas.forEach(e => {
    if (!entradaMap[e.trafico]) entradaMap[e.trafico] = { f: 0, d: 0, t: 0 }
    entradaMap[e.trafico].t++
    if (e.tiene_faltantes) entradaMap[e.trafico].f++
    if (e.mercancia_danada) entradaMap[e.trafico].d++
  })

  // 3. Calculate scores
  const records = []
  Object.entries(suppliers).forEach(([key, s]) => {
    if (s.total_operations < 1) return

    const tmec_eligible = s.total_operations >= 3 && (s.tmec_count / s.total_operations) > 0.6
    const avg_value = s.total_operations > 0 ? Math.round(s.total_value_usd / s.total_operations) : 0
    const incident_rate = s.total_entradas > 0 ? (s.faltantes + s.danos) / s.total_entradas : 0

    // Value volatility
    const values = facturas.filter(f => normName(f.proveedor) === key).map(f => Number(f.valor_usd || 0)).filter(v => v > 0)
    let volatility = 0
    if (values.length >= 3) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
      volatility = mean > 0 ? std / mean : 0
    }

    const reliability_score = Math.max(0, Math.min(100,
      Math.round(100 - incident_rate * 100 - volatility * 20 + (tmec_eligible ? 5 : 0))
    ))

    // Top fracciones
    const topFracciones = Object.entries(s.fracciones)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f)

    records.push({
      supplier_name: s.supplier_name,
      supplier_name_normalized: key,
      supplier_country: s.supplier_country,
      typical_fracciones: topFracciones,
      tmec_eligible,
      avg_value_usd: avg_value,
      total_operations: s.total_operations,
      incident_rate: Math.round(incident_rate * 10000) / 100,
      reliability_score,
      value_volatility: Math.round(volatility * 100) / 100,
      seen_by_clients: s.seen_by_clients,
      updated_at: new Date().toISOString(),
    })
  })

  console.log(`${records.length} suppliers profiled`)

  // 4. Save to supplier_network
  await supabase.from('supplier_network').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  for (const batch of chunk(records, 100)) {
    await supabase.from('supplier_network').insert(batch)
  }

  // 5. Stats
  const tmecCount = records.filter(r => r.tmec_eligible).length
  const highReliability = records.filter(r => r.reliability_score >= 90).length
  const countries = [...new Set(records.map(r => r.supplier_country))]

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✅ Supplier Network built`)
  console.log(`   ${records.length} suppliers · ${tmecCount} T-MEC eligible`)
  console.log(`   ${highReliability} high reliability (≥90)`)
  console.log(`   Countries: ${countries.join(', ')}`)
  console.log(`   ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
