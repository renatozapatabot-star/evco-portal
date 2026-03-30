#!/usr/bin/env node
// scripts/bridge-intelligence.js — FEATURE 10
// Build historical bridge performance database
// Cron: 45 1 * * * (1:45 AM nightly)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const COMPANY_ID = 'evco'

// Laredo bridges
const BRIDGES = [
  { id: 'world_trade', name: 'World Trade Bridge', patterns: ['world trade', 'wtb', 'comercio mundial'] },
  { id: 'colombia', name: 'Colombia Solidarity', patterns: ['colombia', 'solidaridad'] },
  { id: 'laredo_1', name: 'Gateway to the Americas', patterns: ['gateway', 'puente 1', 'laredo 1'] },
  { id: 'laredo_2', name: 'Juarez-Lincoln', patterns: ['juarez', 'lincoln', 'puente 2'] },
]

function inferBridge(carrier, description) {
  // Default for commercial freight in Laredo
  const desc = ((carrier || '') + ' ' + (description || '')).toLowerCase()
  for (const b of BRIDGES) {
    if (b.patterns.some(p => desc.includes(p))) return b.id
  }
  return 'world_trade' // Most commercial freight uses WTB
}

function getCategory(desc) {
  const d = (desc || '').toLowerCase()
  if (['plast', 'resin', 'polim', 'poly', 'pellet', 'mold'].some(k => d.includes(k))) return 'plasticos'
  if (['quim', 'chem', 'acid', 'solvent'].some(k => d.includes(k))) return 'quimicos'
  if (['metal', 'acero', 'steel', 'alum'].some(k => d.includes(k))) return 'metalicos'
  if (['electr', 'circuit', 'cable'].some(k => d.includes(k))) return 'electronica'
  return 'general'
}

async function main() {
  console.log('🌉 Bridge Intelligence Engine — CRUZ')
  const start = Date.now()

  // 1. Get completed tráficos with real fecha_cruce
  const { data: cruzados } = await supabase.from('traficos')
    .select('trafico, transportista_mexicano, transportista_extranjero, fecha_llegada, fecha_cruce, descripcion_mercancia, semaforo')
    .eq('company_id', COMPANY_ID).ilike('estatus', '%cruz%')
    .not('fecha_llegada', 'is', null).not('fecha_cruce', 'is', null).limit(3000)

  // 2. Get eventos for timestamp data
  const traficoIds = (cruzados || []).map(t => t.trafico).filter(Boolean)
  const { data: eventos } = traficoIds.length > 0
    ? await supabase.from('globalpc_eventos').select('cve_trafico, fecha').in('cve_trafico', traficoIds.slice(0, 500))
    : { data: [] }

  const eventMap = {}
  ;(eventos || []).forEach(e => {
    if (!eventMap[e.cve_trafico]) eventMap[e.cve_trafico] = []
    eventMap[e.cve_trafico].push(new Date(e.fecha))
  })

  // 3. Build bridge intelligence records
  const records = []
  ;(cruzados || []).forEach(t => {
    if (!t.fecha_llegada || !t.fecha_cruce) return

    const crossingHours = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 3600000
    if (crossingHours <= 0 || crossingHours > 72) return // Filter outliers > 72h

    const llegada = new Date(t.fecha_llegada)
    const endDate = new Date(t.fecha_cruce)
    const bridge = inferBridge(t.transportista_mexicano || t.transportista_extranjero, t.descripcion_mercancia)

    records.push({
      trafico_id: t.trafico,
      company_id: COMPANY_ID,
      bridge_id: bridge,
      carrier: t.transportista_mexicano || t.transportista_extranjero || 'UNKNOWN',
      product_category: getCategory(t.descripcion_mercancia),
      day_of_week: llegada.getDay(),
      hour_of_day: llegada.getHours(),
      crossing_hours: Math.round(crossingHours * 10) / 10,
      semaforo: t.semaforo === 1 ? 'verde' : t.semaforo === 2 ? 'rojo' : null,
      fecha_cruce: endDate.toISOString().split('T')[0],
      calculated_at: new Date().toISOString(),
    })
  })

  console.log(`${records.length} bridge crossing records`)

  // 4. Save to bridge_intelligence
  await supabase.from('bridge_intelligence').delete().eq('company_id', COMPANY_ID)
  for (const batch of chunk(records, 100)) {
    await supabase.from('bridge_intelligence').insert(batch)
  }

  // 5. Calculate recommendations
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const bridgeByDay = {}
  records.forEach(r => {
    const key = `${r.bridge_id}|${r.day_of_week}`
    if (!bridgeByDay[key]) bridgeByDay[key] = { total: 0, count: 0 }
    bridgeByDay[key].total += r.crossing_hours
    bridgeByDay[key].count++
  })

  // Find fastest bridge per day
  const recommendations = {}
  for (let dow = 0; dow < 7; dow++) {
    let best = null
    BRIDGES.forEach(b => {
      const stats = bridgeByDay[`${b.id}|${dow}`]
      if (stats && stats.count >= 3) {
        const avg = stats.total / stats.count
        if (!best || avg < best.avg) best = { bridge: b.name, avg, samples: stats.count }
      }
    })
    recommendations[dayNames[dow]] = best || { bridge: 'World Trade Bridge', avg: 0, samples: 0 }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✅ Bridge Intelligence updated`)
  console.log(`   ${records.length} records · ${BRIDGES.length} bridges`)
  console.log(`   Recommendations:`)
  Object.entries(recommendations).forEach(([day, rec]) => {
    console.log(`     ${day}: ${rec.bridge} (avg ${rec.avg.toFixed(1)}h, n=${rec.samples})`)
  })
  console.log(`   ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
