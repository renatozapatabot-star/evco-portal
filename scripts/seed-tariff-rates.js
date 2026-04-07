#!/usr/bin/env node
/**
 * CRUZ Seed Tariff Rates
 * Derives effective IGI rates per fraccion from historical aduanet_facturas
 * joined with traficos (which carry fraccion_arancelaria).
 *
 * Logic: For each fraccion, compute avg(igi / valor_aduana_mxn) from cleared
 * pedimentos. Only includes fracciones with >= 2 data points.
 *
 * Usage: node scripts/seed-tariff-rates.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')

async function run() {
  console.log('\n📊 CRUZ Tariff Rate Seeder')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═'.repeat(50))

  // Step 1: Get exchange rate for converting USD → MXN
  const { data: tcRow } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'banxico_exchange_rate')
    .single()

  const tc = tcRow?.value?.rate
  if (!tc) {
    console.error('❌ Exchange rate not found in system_config')
    process.exit(1)
  }
  console.log(`   Exchange rate: ${tc} MXN/USD`)

  // Step 2: Get all aduanet_facturas with IGI > 0 and valor_usd > 0
  const { data: facturas, error: factError } = await supabase
    .from('aduanet_facturas')
    .select('pedimento, valor_usd, igi, referencia')
    .gt('igi', 0)
    .gt('valor_usd', 0)

  if (factError) {
    console.error('❌ Failed to fetch facturas:', factError.message)
    process.exit(1)
  }
  console.log(`   Facturas with IGI: ${facturas.length}`)

  // Step 3: Get fracciones from traficos table (fraccion_arancelaria column)
  // Link: aduanet_facturas.referencia → traficos.trafico → traficos.fraccion_arancelaria
  const { data: traficos, error: trafError } = await supabase
    .from('traficos')
    .select('trafico, fraccion_arancelaria')
    .not('fraccion_arancelaria', 'is', null)

  if (trafError) {
    console.error('❌ Failed to fetch traficos:', trafError.message)
    process.exit(1)
  }
  console.log(`   Traficos with fraccion: ${traficos.length}`)

  // Build map: trafico → fraccion_arancelaria
  const traficoFraccionMap = new Map()
  for (const t of traficos) {
    if (t.fraccion_arancelaria) {
      // Normalize fraccion to XXXX.XX.XX format
      let f = String(t.fraccion_arancelaria).replace(/[^\d.]/g, '')
      if (f.length === 8 && !f.includes('.')) {
        f = `${f.slice(0,4)}.${f.slice(4,6)}.${f.slice(6,8)}`
      }
      traficoFraccionMap.set(t.trafico, f)
    }
  }
  console.log(`   Unique traficos with fraccion: ${traficoFraccionMap.size}`)

  // Step 4: For each factura, find fraccion via referencia (which maps to trafico)
  // and compute IGI rate
  const fraccionData = new Map() // fraccion → [{ igi_rate }]

  for (const f of facturas) {
    const ref = f.referencia
    if (!ref) continue

    const fraccion = traficoFraccionMap.get(ref)
    if (!fraccion) continue

    // Calculate effective rate: igi / (valor_usd * tc)
    const valorMXN = f.valor_usd * tc
    if (valorMXN <= 0) continue

    const rate = f.igi / valorMXN

    // Sanity check — IGI rate should be between 0 and 0.50 (50% max)
    if (rate < 0 || rate > 0.50) continue

    if (!fraccionData.has(fraccion)) fraccionData.set(fraccion, [])
    fraccionData.get(fraccion).push(rate)
  }

  console.log(`   Fracciones with rate data: ${fraccionData.size}`)

  // Step 5: Compute average rate per fraccion (min 2 samples)
  const rates = []
  for (const [fraccion, samples] of fraccionData) {
    if (samples.length < 2) continue

    const avgRate = samples.reduce((s, r) => s + r, 0) / samples.length
    rates.push({
      fraccion,
      igi_rate: Math.round(avgRate * 10000) / 10000, // 4 decimal places
      sample_count: samples.length,
      source: 'historical_aduanet',
      valid_from: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
  }

  // Also add T-MEC fracciones (0% IGI) from facturas where igi = 0
  const { data: tmecFacturas } = await supabase
    .from('aduanet_facturas')
    .select('referencia')
    .eq('igi', 0)
    .gt('valor_usd', 0)

  const tmecFracciones = new Set()
  for (const f of (tmecFacturas || [])) {
    if (!f.referencia) continue
    const fraccion = traficoFraccionMap.get(f.referencia)
    if (fraccion && !fraccionData.has(fraccion)) {
      tmecFracciones.add(fraccion)
    }
  }

  for (const fraccion of tmecFracciones) {
    rates.push({
      fraccion,
      igi_rate: 0,
      sample_count: 1,
      source: 'historical_aduanet_tmec',
      valid_from: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
  }

  console.log(`\n   Rates to upsert: ${rates.length} (${tmecFracciones.size} T-MEC at 0%)`)

  if (DRY_RUN) {
    console.log('\n   DRY RUN — showing first 20:')
    rates.sort((a, b) => b.sample_count - a.sample_count).slice(0, 20).forEach(r =>
      console.log(`   ${r.fraccion}: ${(r.igi_rate * 100).toFixed(2)}% (${r.sample_count} samples, ${r.source})`)
    )
    return
  }

  // Step 6: Upsert to tariff_rates
  for (let i = 0; i < rates.length; i += 100) {
    const batch = rates.slice(i, i + 100)
    const { error } = await supabase.from('tariff_rates').upsert(batch, { onConflict: 'fraccion' })
    if (error) {
      console.error(`   Upsert error at batch ${i}: ${error.message}`)
    }
  }

  console.log(`\n✅ Seeded ${rates.length} tariff rates`)
  console.log('   Top rates by sample count:')
  rates.sort((a, b) => b.sample_count - a.sample_count).slice(0, 10).forEach(r =>
    console.log(`   ${r.fraccion}: ${(r.igi_rate * 100).toFixed(2)}% (${r.sample_count} samples)`)
  )
}

run().catch(e => console.error('Fatal:', e.message))
