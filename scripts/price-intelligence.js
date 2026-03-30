#!/usr/bin/env node
// scripts/price-intelligence.js — FEATURE 18
// Statistical price anomaly detection per fraccion per proveedor

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const CLAVE = '9254'

async function main() {
  console.log('💰 Price Intelligence — CRUZ')
  const start = Date.now()

  // 1. Fetch facturas with value data
  const { data: facturas } = await supabase.from('aduanet_facturas')
    .select('referencia, proveedor, valor_usd, pedimento, fecha_pago')
    .eq('clave_cliente', CLAVE).not('valor_usd', 'is', null)

  if (!facturas?.length) { console.log('No facturas found'); return }

  // 2. Also get partidas for fraccion-level analysis
  const { data: partidas } = await supabase.from('globalpc_partidas')
    .select('cve_trafico, cve_proveedor, fraccion_arancelaria, fraccion, valor_comercial, precio_unitario')
    .limit(10000)

  // 3. Build price baselines per supplier
  const supplierPrices = {} // supplier -> [values]
  facturas.forEach(f => {
    const prov = (f.proveedor || '').toUpperCase().trim()
    const val = Number(f.valor_usd || 0)
    if (!prov || val <= 0) return
    if (!supplierPrices[prov]) supplierPrices[prov] = []
    supplierPrices[prov].push({ val, ref: f.referencia, ped: f.pedimento, fecha: f.fecha_pago })
  })

  // 4. Build price baselines per fraccion
  const fraccionPrices = {} // fraccion -> [unit_prices]
  ;(partidas || []).forEach(p => {
    const frac = p.fraccion_arancelaria || p.fraccion
    const price = Number(p.precio_unitario || p.valor_comercial || 0)
    if (!frac || price <= 0) return
    if (!fraccionPrices[frac]) fraccionPrices[frac] = []
    fraccionPrices[frac].push(price)
  })

  // 5. Detect anomalies
  const anomalies = []

  // Per supplier anomalies
  Object.entries(supplierPrices).forEach(([prov, entries]) => {
    if (entries.length < 5) return
    const values = entries.map(e => e.val)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
    if (std === 0) return

    entries.forEach(entry => {
      const zScore = Math.abs(entry.val - mean) / std
      if (zScore > 2) {
        const deviation = ((entry.val - mean) / mean * 100).toFixed(0)
        anomalies.push({
          type: 'price_anomaly',
          subtype: 'supplier_value',
          entity: prov,
          reference: entry.ref,
          pedimento: entry.ped,
          value: entry.val,
          expected_mean: Math.round(mean),
          z_score: Math.round(zScore * 10) / 10,
          deviation_pct: Number(deviation),
          fecha: entry.fecha,
          company_id: 'evco',
        })
      }
    })
  })

  // Per fraccion unit price anomalies
  Object.entries(fraccionPrices).forEach(([frac, prices]) => {
    if (prices.length < 5) return
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const std = Math.sqrt(prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length)
    if (std === 0) return

    prices.forEach((price, i) => {
      const zScore = Math.abs(price - mean) / std
      if (zScore > 2.5) {
        anomalies.push({
          type: 'price_anomaly',
          subtype: 'fraccion_unit_price',
          entity: frac,
          value: price,
          expected_mean: Math.round(mean * 100) / 100,
          z_score: Math.round(zScore * 10) / 10,
          deviation_pct: Math.round((price - mean) / mean * 100),
          company_id: 'evco',
        })
      }
    })
  })

  console.log(`${anomalies.length} price anomalies detected`)

  // 6. Save to anomaly_baselines
  if (anomalies.length > 0) {
    // Remove old price anomalies
    await supabase.from('anomaly_baselines').delete().eq('type', 'price_anomaly').eq('company_id', 'evco')

    for (const batch of chunk(anomalies, 100)) {
      await supabase.from('anomaly_baselines').insert(batch.map(a => ({
        metric_name: `${a.subtype}:${a.entity}`,
        baseline_value: a.expected_mean,
        current_value: a.value,
        deviation_pct: a.deviation_pct,
        type: 'price_anomaly',
        company_id: 'evco',
        calculated_at: new Date().toISOString(),
        metadata: { z_score: a.z_score, reference: a.reference, pedimento: a.pedimento },
      })))
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const supplierAnomalies = anomalies.filter(a => a.subtype === 'supplier_value').length
  const fraccionAnomalies = anomalies.filter(a => a.subtype === 'fraccion_unit_price').length
  console.log(`✅ Price Intelligence complete`)
  console.log(`   ${supplierAnomalies} supplier anomalies · ${fraccionAnomalies} fraccion anomalies`)
  console.log(`   ${Object.keys(supplierPrices).length} suppliers · ${Object.keys(fraccionPrices).length} fracciones analyzed`)
  console.log(`   ${elapsed}s`)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
