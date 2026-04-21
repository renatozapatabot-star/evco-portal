#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 2 — Classification History Mining
//
// Aggregates 748K globalpc_productos rows into ~2K fraccion_patterns.
// Pure SQL + JS aggregation. No AI. $0 cost.
//
// Usage:
//   node scripts/bootcamp-fraccion-mining.js              # full batch
//   node scripts/bootcamp-fraccion-mining.js --dry-run     # preview only
//   node scripts/bootcamp-fraccion-mining.js --incremental  # since last run
//   node scripts/bootcamp-fraccion-mining.js --limit=1000   # cap rows fetched
//
// Cron: 0 3 * * 0  (Sunday 3 AM — weekly incremental)
// ============================================================================

const {
  initBootcamp, fetchBatched, upsertChunked,
  saveCheckpoint, loadCheckpoint, fatalHandler,
  topN,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-fraccion-mining'

// ── Stop words for keyword extraction (Spanish customs terms) ───────────────
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'en', 'con', 'para', 'por',
  'una', 'uno', 'unos', 'unas', 'que', 'sin', 'mas', 'pero', 'como',
  'tipo', 'otros', 'otras', 'demas', 'articulo', 'articulos',
  'piezas', 'pieza', 'parte', 'partes', 'material', 'materiales',
])

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 2: Classification History Mining`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : args.incremental ? 'INCREMENTAL' : 'FULL BATCH'}`)

  // ── Step 1: Fetch all productos with fracciones ───────────────────────
  console.log('\n📦 Step 1: Fetching globalpc_productos...')

  const filters = { fraccion: { op: 'not', value: null } }
  // Can't use not-null via the simple filter; use raw approach
  let offset = 0
  const batchSize = args.batchSize || 5000
  const fraccionMap = new Map() // fraccion → { products, suppliers, countries, keywords, prices }
  const descFraccionMap = new Map() // normalized_desc → Map<fraccion, count>
  let totalFetched = 0

  while (true) {
    const { data, error } = await supabase
      .from('globalpc_productos')
      .select('fraccion, descripcion, cve_proveedor, pais_origen, precio_unitario, company_id')
      .not('fraccion', 'is', null)
      .range(offset, offset + batchSize - 1)

    if (error) throw new Error(`Fetch error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const row of data) {
      const frac = (row.fraccion || '').trim()
      if (!frac || frac.length < 6) continue

      // Aggregate by fraccion
      if (!fraccionMap.has(frac)) {
        fraccionMap.set(frac, {
          products: 0,
          suppliers: new Map(),
          countries: new Map(),
          keywords: new Map(),
          prices: [],
        })
      }

      const entry = fraccionMap.get(frac)
      entry.products++

      if (row.cve_proveedor) {
        entry.suppliers.set(row.cve_proveedor, (entry.suppliers.get(row.cve_proveedor) || 0) + 1)
      }
      if (row.pais_origen) {
        entry.countries.set(row.pais_origen, (entry.countries.get(row.pais_origen) || 0) + 1)
      }
      if (row.precio_unitario && row.precio_unitario > 0) {
        entry.prices.push(Number(row.precio_unitario))
      }

      // Extract keywords from description
      const desc = (row.descripcion || '').toLowerCase().trim()
      if (desc) {
        const words = desc.split(/\s+/)
          .map(w => w.replace(/[^a-záéíóúñü0-9]/g, ''))
          .filter(w => w.length > 3 && !STOP_WORDS.has(w))

        for (const word of words) {
          entry.keywords.set(word, (entry.keywords.get(word) || 0) + 1)
        }

        // Track description → fraccion mapping for ambiguity detection
        const normDesc = words.slice(0, 5).join(' ')
        if (normDesc.length > 8) {
          if (!descFraccionMap.has(normDesc)) {
            descFraccionMap.set(normDesc, new Map())
          }
          const fracMap = descFraccionMap.get(normDesc)
          fracMap.set(frac, (fracMap.get(frac) || 0) + 1)
        }
      }
    }

    totalFetched += data.length
    offset += batchSize
    process.stdout.write(`\r  Fetched: ${totalFetched.toLocaleString()} productos...`)

    if (args.limit && totalFetched >= args.limit) break
    if (data.length < batchSize) break
  }

  console.log(`\r  Fetched: ${totalFetched.toLocaleString()} productos ✓`)
  console.log(`  Unique fracciones: ${fraccionMap.size.toLocaleString()}`)

  // ── Step 2: Detect ambiguous descriptions ─────────────────────────────
  console.log('\n🔍 Step 2: Detecting ambiguous classifications...')

  const ambiguousDescs = new Map() // fraccion → Set<alt_fracciones>
  let ambiguousCount = 0

  for (const [desc, fracMap] of descFraccionMap) {
    if (fracMap.size > 1) {
      ambiguousCount++
      const total = [...fracMap.values()].reduce((a, b) => a + b, 0)
      const sorted = [...fracMap.entries()].sort((a, b) => b[1] - a[1])

      for (const [frac] of sorted) {
        if (!ambiguousDescs.has(frac)) ambiguousDescs.set(frac, new Map())
        for (const [altFrac, count] of sorted) {
          if (altFrac !== frac) {
            const existing = ambiguousDescs.get(frac).get(altFrac) || 0
            ambiguousDescs.get(frac).set(altFrac, existing + count)
          }
        }
      }
    }
  }

  console.log(`  Ambiguous descriptions: ${ambiguousCount.toLocaleString()}`)

  // ── Step 3: Build fraccion_patterns rows ──────────────────────────────
  console.log('\n📊 Step 3: Building fraccion patterns...')

  const patterns = []

  for (const [fraccion, data] of fraccionMap) {
    const avgPrice = data.prices.length > 0
      ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length * 100) / 100
      : null

    const isAmbiguous = ambiguousDescs.has(fraccion) && ambiguousDescs.get(fraccion).size > 0
    let altFracciones = null

    if (isAmbiguous) {
      const alts = ambiguousDescs.get(fraccion)
      const totalAlt = [...alts.values()].reduce((a, b) => a + b, 0)
      altFracciones = [...alts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([frac, count]) => ({
          fraccion: frac,
          count,
          pct: Math.round(count / (totalAlt + data.products) * 100),
        }))
    }

    patterns.push({
      fraccion,
      description_keywords: topN(data.keywords, 5),
      supplier_count: data.suppliers.size,
      product_count: data.products,
      total_partida_count: data.products,
      avg_unit_price: avgPrice,
      primary_suppliers: topN(data.suppliers, 3),
      primary_countries: topN(data.countries, 3),
      ambiguous: isAmbiguous,
      alt_fracciones: altFracciones,
      confidence: isAmbiguous ? 0.7 : 0.95,
      computed_at: new Date().toISOString(),
    })
  }

  console.log(`  Patterns built: ${patterns.length.toLocaleString()}`)
  console.log(`  Ambiguous: ${patterns.filter(p => p.ambiguous).length}`)

  // ── Step 4: Upsert to fraccion_patterns ───────────────────────────────
  if (args.dryRun) {
    console.log('\n🏁 DRY RUN — would upsert', patterns.length, 'rows to fraccion_patterns')
    // Show top 5 examples
    patterns.slice(0, 5).forEach(p => {
      console.log(`  ${p.fraccion}: ${p.product_count} products, suppliers=${p.supplier_count}, ambiguous=${p.ambiguous}`)
      if (p.ambiguous) console.log(`    alts: ${JSON.stringify(p.alt_fracciones)}`)
    })
  } else {
    console.log('\n💾 Step 4: Upserting to fraccion_patterns...')
    const upserted = await upsertChunked(supabase, 'fraccion_patterns', patterns, 'fraccion')
    console.log(`  Upserted: ${upserted.toLocaleString()} rows`)
  }

  // ── Step 5: Write top patterns to learned_patterns ────────────────────
  if (!args.dryRun) {
    console.log('\n🧠 Step 5: Writing to learned_patterns...')

    const topPatterns = patterns
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, 50)
      .map(p => ({
        pattern_type: 'fraccion_usage',
        pattern_key: `fraccion:${p.fraccion}`,
        pattern_value: {
          fraccion: p.fraccion,
          product_count: p.product_count,
          supplier_count: p.supplier_count,
          keywords: p.description_keywords,
          ambiguous: p.ambiguous,
          alt_fracciones: p.alt_fracciones,
        },
        confidence: p.confidence,
        source: 'bootcamp_fraccion_mining',
        sample_size: p.product_count,
        first_detected: new Date().toISOString(),
        last_confirmed: new Date().toISOString(),
        active: true,
      }))

    await upsertChunked(supabase, 'learned_patterns', topPatterns, 'pattern_type,pattern_key')
    console.log(`  Wrote ${topPatterns.length} patterns to learned_patterns`)
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    productos_analyzed: totalFetched,
    unique_fracciones: fraccionMap.size,
    ambiguous_fracciones: patterns.filter(p => p.ambiguous).length,
    elapsed_s: elapsed,
    mode: args.dryRun ? 'dry-run' : args.incremental ? 'incremental' : 'full',
  }

  console.log(`\n✅ Bootcamp 2 complete in ${elapsed}s`)
  console.log(`   ${totalFetched.toLocaleString()} productos → ${fraccionMap.size.toLocaleString()} fracciones`)
  console.log(`   ${patterns.filter(p => p.ambiguous).length} ambiguous classifications detected`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    await sendTelegram(
      `🎓 <b>Bootcamp 2: Fracción Mining</b>\n` +
      `${totalFetched.toLocaleString()} productos → ${fraccionMap.size.toLocaleString()} fracciones\n` +
      `Ambiguos: ${patterns.filter(p => p.ambiguous).length}\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
    saveCheckpoint(SCRIPT_NAME, { lastRun: new Date().toISOString(), ...summary })
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
