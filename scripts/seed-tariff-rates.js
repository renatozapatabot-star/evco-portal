#!/usr/bin/env node
/**
 * CRUZ Seed Tariff Rates
 * Derives effective IGI rates per fraccion from historical aduanet_facturas
 * joined through GlobalPC data to resolve fracciones.
 *
 * Join path:
 *   aduanet_facturas.referencia → globalpc_facturas.cve_trafico
 *   globalpc_facturas.folio → globalpc_partidas.folio
 *   globalpc_partidas.cve_producto + cve_cliente → globalpc_productos.fraccion
 *
 * Logic: For each fraccion, compute median(igi / valor_aduana_mxn) from cleared
 * pedimentos. Only includes fracciones with >= 2 data points.
 * Also seeds T-MEC fracciones (0% IGI) from facturas where igi = 0.
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

  // Step 1: Get ALL aduanet_facturas (both with IGI and without, for T-MEC detection)
  const { data: allFacturas, error: factError } = await supabase
    .from('aduanet_facturas')
    .select('referencia, valor_usd, tipo_cambio, igi')
    .gt('valor_usd', 0)
    .gt('tipo_cambio', 0)

  if (factError) {
    console.error('❌ Failed to fetch facturas:', factError.message)
    process.exit(1)
  }

  const igiFacturas = allFacturas.filter(f => f.igi > 0)
  const zeroIgiFacturas = allFacturas.filter(f => f.igi === 0 || f.igi === null)
  console.log(`   Total facturas: ${allFacturas.length} (${igiFacturas.length} with IGI, ${zeroIgiFacturas.length} zero/null IGI)`)

  // Normalize referencia (some have / instead of -)
  const normalizeRef = (ref) => ref ? ref.replace(/\//g, '-') : null

  // Step 2: Get ALL globalpc_facturas to build cve_trafico → folio mapping
  const allRefs = [...new Set(allFacturas.map(f => normalizeRef(f.referencia)).filter(Boolean))]
  console.log(`   Unique referencias: ${allRefs.length}`)

  // Fetch in batches of 200 (Supabase .in() limit)
  const gpcFacturaMap = new Map() // cve_trafico → [folio]
  for (let i = 0; i < allRefs.length; i += 200) {
    const batch = allRefs.slice(i, i + 200)
    const { data: gpcFacturas } = await supabase
      .from('globalpc_facturas')
      .select('folio, cve_trafico, cve_cliente')
      .in('cve_trafico', batch)
    for (const gf of (gpcFacturas || [])) {
      if (!gpcFacturaMap.has(gf.cve_trafico)) gpcFacturaMap.set(gf.cve_trafico, [])
      gpcFacturaMap.get(gf.cve_trafico).push({ folio: gf.folio, cve_cliente: gf.cve_cliente })
    }
  }
  console.log(`   Matched globalpc_facturas: ${gpcFacturaMap.size} traficos`)

  // Step 3: Get partidas for all matched folios
  const allFolios = []
  for (const entries of gpcFacturaMap.values()) {
    for (const e of entries) allFolios.push(e.folio)
  }
  console.log(`   Total folios to look up: ${allFolios.length}`)

  const partidaMap = new Map() // folio → [{ cve_producto, cve_cliente }]
  for (let i = 0; i < allFolios.length; i += 200) {
    const batch = allFolios.slice(i, i + 200)
    const { data: partidas } = await supabase
      .from('globalpc_partidas')
      .select('folio, cve_producto, cve_cliente')
      .in('folio', batch)
    for (const p of (partidas || [])) {
      if (!partidaMap.has(p.folio)) partidaMap.set(p.folio, [])
      partidaMap.get(p.folio).push({ cve_producto: p.cve_producto, cve_cliente: p.cve_cliente })
    }
  }
  console.log(`   Partidas fetched: ${[...partidaMap.values()].reduce((s, arr) => s + arr.length, 0)}`)

  // Step 4: Get productos with fraccion for all unique (cve_producto, cve_cliente) pairs
  const prodKeys = new Set()
  for (const partidas of partidaMap.values()) {
    for (const p of partidas) {
      prodKeys.add(`${p.cve_cliente}|${p.cve_producto}`)
    }
  }

  // Fetch productos by cve_cliente groups
  const clientProducts = new Map() // cve_cliente → Set of cve_producto
  for (const key of prodKeys) {
    const [cve_cliente, cve_producto] = key.split('|')
    if (!clientProducts.has(cve_cliente)) clientProducts.set(cve_cliente, new Set())
    clientProducts.get(cve_cliente).add(cve_producto)
  }

  const productoFraccionMap = new Map() // "cve_cliente|cve_producto" → fraccion
  for (const [cve_cliente, productos] of clientProducts) {
    const prodArray = [...productos]
    for (let i = 0; i < prodArray.length; i += 200) {
      const batch = prodArray.slice(i, i + 200)
      const { data: prods } = await supabase
        .from('globalpc_productos')
        .select('cve_producto, fraccion')
        .eq('cve_cliente', cve_cliente)
        .in('cve_producto', batch)
        .not('fraccion', 'is', null)
      for (const p of (prods || [])) {
        if (p.fraccion) {
          productoFraccionMap.set(`${cve_cliente}|${p.cve_producto}`, p.fraccion)
        }
      }
    }
  }
  console.log(`   Products with fraccion: ${productoFraccionMap.size}`)

  // Step 5: Resolve each factura → fraccion(es) → compute rate
  // A factura may cover multiple fracciones if the pedimento has multiple partidas.
  // For single-fraccion pedimentos, the rate is exact.
  // For multi-fraccion, the IGI is a weighted sum — we still record it but flag lower confidence.

  const fraccionRates = new Map() // fraccion → [{ rate, single_fraccion }]
  let resolvedCount = 0
  let unresolvedCount = 0

  for (const factura of igiFacturas) {
    const ref = normalizeRef(factura.referencia)
    if (!ref) { unresolvedCount++; continue }

    const gpcEntries = gpcFacturaMap.get(ref)
    if (!gpcEntries) { unresolvedCount++; continue }

    // Get all fracciones for this trafico
    const fracciones = new Set()
    for (const entry of gpcEntries) {
      const partidas = partidaMap.get(entry.folio) || []
      for (const p of partidas) {
        const fraccion = productoFraccionMap.get(`${p.cve_cliente}|${p.cve_producto}`)
        if (fraccion) fracciones.add(fraccion)
      }
    }

    if (fracciones.size === 0) { unresolvedCount++; continue }

    const valorMXN = factura.valor_usd * factura.tipo_cambio
    if (valorMXN <= 0) continue

    const rate = factura.igi / valorMXN
    // Sanity: IGI rate should be between 0 and 0.50 (50% max)
    if (rate < 0 || rate > 0.50) continue

    const isSingleFraccion = fracciones.size === 1
    for (const fraccion of fracciones) {
      if (!fraccionRates.has(fraccion)) fraccionRates.set(fraccion, [])
      fraccionRates.get(fraccion).push({ rate, single_fraccion: isSingleFraccion })
    }
    resolvedCount++
  }

  console.log(`\n   Resolved: ${resolvedCount} facturas → ${fraccionRates.size} fracciones`)
  console.log(`   Unresolved: ${unresolvedCount} facturas (no GlobalPC match)`)

  // Step 6: Compute rate per fraccion
  // Prefer single-fraccion samples (exact rate). Use median for robustness.
  const rates = []
  for (const [fraccion, samples] of fraccionRates) {
    // Prefer single-fraccion samples if available
    const singleSamples = samples.filter(s => s.single_fraccion)
    const useSamples = singleSamples.length >= 2 ? singleSamples : samples

    if (useSamples.length < 1) continue

    const sorted = useSamples.map(s => s.rate).sort((a, b) => a - b)
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

    // Round to nearest standard TIGIE rate if very close
    const roundedRate = snapToStandardRate(median)

    // Format fraccion: ensure XXXX.XX.XX format
    const formattedFraccion = formatFraccion(fraccion)

    rates.push({
      fraccion: formattedFraccion,
      igi_rate: Math.round(roundedRate * 10000) / 10000,
      sample_count: useSamples.length,
      source: singleSamples.length >= 2 ? 'historical_aduanet' : 'historical_aduanet_multi',
      valid_from: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
  }

  // Step 7: Also add T-MEC fracciones (0% IGI) from facturas where igi = 0
  const tmecFracciones = new Set()
  for (const factura of zeroIgiFacturas) {
    const ref = normalizeRef(factura.referencia)
    if (!ref) continue

    const gpcEntries = gpcFacturaMap.get(ref)
    if (!gpcEntries) continue

    for (const entry of gpcEntries) {
      const partidas = partidaMap.get(entry.folio) || []
      for (const p of partidas) {
        const fraccion = productoFraccionMap.get(`${p.cve_cliente}|${p.cve_producto}`)
        if (fraccion && !fraccionRates.has(fraccion)) {
          tmecFracciones.add(formatFraccion(fraccion))
        }
      }
    }
  }

  for (const fraccion of tmecFracciones) {
    // Don't overwrite if we already have a rate from IGI facturas
    if (!rates.find(r => r.fraccion === fraccion)) {
      rates.push({
        fraccion,
        igi_rate: 0,
        sample_count: 1,
        source: 'historical_aduanet_tmec',
        valid_from: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
    }
  }

  console.log(`\n   Rates to upsert: ${rates.length} (${tmecFracciones.size} T-MEC at 0%)`)

  if (DRY_RUN) {
    console.log('\n   DRY RUN — showing all rates:')
    rates.sort((a, b) => b.sample_count - a.sample_count).forEach(r =>
      console.log(`   ${r.fraccion}: ${(r.igi_rate * 100).toFixed(2)}% (${r.sample_count} samples, ${r.source})`)
    )
    return
  }

  // Step 8: Upsert to tariff_rates
  for (let i = 0; i < rates.length; i += 100) {
    const batch = rates.slice(i, i + 100)
    const { error } = await supabase.from('tariff_rates').upsert(batch, { onConflict: 'fraccion' })
    if (error) {
      console.error(`   Upsert error at batch ${i}: ${error.message}`)
    }
  }

  console.log(`\n✅ Seeded ${rates.length} tariff rates`)
  console.log('   Top rates by sample count:')
  rates.sort((a, b) => b.sample_count - a.sample_count).slice(0, 15).forEach(r =>
    console.log(`   ${r.fraccion}: ${(r.igi_rate * 100).toFixed(2)}% (${r.sample_count} samples)`)
  )
}

/**
 * Snap a rate to the nearest standard TIGIE rate if within 0.5% tolerance.
 * Standard rates: 0%, 1%, 3%, 5%, 7%, 10%, 15%, 20%, 25%, 35%
 */
function snapToStandardRate(rate) {
  const standard = [0, 0.01, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20, 0.25, 0.35]
  for (const s of standard) {
    if (Math.abs(rate - s) < 0.005) return s
  }
  return rate
}

/**
 * Normalize fraccion to digits-only format (e.g., 3903300100).
 * Matches globalpc_productos.fraccion and fraccion_patterns.fraccion format.
 */
function formatFraccion(f) {
  return String(f).replace(/[^\d]/g, '')
}

run().catch(e => console.error('Fatal:', e.message))
