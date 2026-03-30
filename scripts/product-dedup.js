#!/usr/bin/env node
// scripts/product-dedup.js — BUILD 3 PHASE 2
// Product Deduplication + Enrichment Engine
// Finds duplicates via fuzzy match, creates canonical product catalog
// Enriches with chapter data, T-MEC eligibility, NOM flags, price stats
// Run: node scripts/product-dedup.js

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.2.215:11434'

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Ensure product_catalog table ─────────────────────
async function ensureTable() {
  const { error } = await supabase.from('product_catalog').select('id').limit(1)
  if (error && error.code === '42P01') {
    // Table doesn't exist — create via RPC or log
    console.log('⚠️  product_catalog table needs creation — will attempt via RPC')
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS product_catalog (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          canonical_description TEXT,
          fraccion TEXT,
          fraccion_confidence INTEGER DEFAULT 0,
          fraccion_source TEXT DEFAULT 'globalpc',
          cve_proveedor TEXT,
          proveedor_nombre TEXT,
          company_id TEXT DEFAULT 'evco',
          chapter INTEGER,
          chapter_description TEXT,
          tmec_eligible BOOLEAN,
          nom_required BOOLEAN,
          typical_unit_price_usd NUMERIC,
          price_min_usd NUMERIC,
          price_max_usd NUMERIC,
          price_std_dev NUMERIC,
          total_imports INTEGER DEFAULT 0,
          total_value_usd NUMERIC DEFAULT 0,
          last_imported_at TIMESTAMPTZ,
          duplicate_ids JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_product_catalog_fraccion ON product_catalog(fraccion);
        CREATE INDEX IF NOT EXISTS idx_product_catalog_proveedor ON product_catalog(cve_proveedor);
        CREATE INDEX IF NOT EXISTS idx_product_catalog_company ON product_catalog(company_id);
      `
    }).catch(() => {})
  }
}

// ── Chapter descriptions (first 2 digits of fraccion) ─
const CHAPTER_DESC = {
  '39': 'Plásticos y sus manufacturas',
  '84': 'Máquinas y aparatos mecánicos',
  '85': 'Máquinas y aparatos eléctricos',
  '73': 'Manufacturas de fundición/hierro/acero',
  '90': 'Instrumentos y aparatos de óptica',
  '40': 'Caucho y sus manufacturas',
  '76': 'Aluminio y sus manufacturas',
  '72': 'Fundición, hierro y acero',
  '38': 'Productos químicos diversos',
  '29': 'Productos químicos orgánicos',
  '32': 'Extractos curtientes, pinturas',
  '48': 'Papel y cartón',
  '83': 'Manufacturas diversas de metales',
  '70': 'Vidrio y sus manufacturas',
  '68': 'Manufacturas de piedra, yeso, cemento',
  '87': 'Vehículos automóviles y partes',
  '94': 'Muebles, alumbrado',
  '82': 'Herramientas de metal común',
  '74': 'Cobre y sus manufacturas',
}

// ── NOM-required chapters ────────────────────────────
const NOM_CHAPTERS = new Set([
  '28', '29', '32', '34', '38', '39', '40', '44', '48',
  '68', '69', '70', '72', '73', '76', '82', '83', '84',
  '85', '87', '90', '94', '95', '96'
])

// ── T-MEC eligible origins (US/CA suppliers) ─────────
const TMEC_ORIGINS = new Set(['US', 'USA', 'CA', 'CAN', 'ESTADOS UNIDOS', 'CANADA', 'UNITED STATES'])

// ── Simple string similarity (Dice coefficient) ──────
function similarity(a, b) {
  if (!a || !b) return 0
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1

  const bigrams = (s) => {
    const result = new Set()
    for (let i = 0; i < s.length - 1; i++) {
      result.add(s.substring(i, i + 2))
    }
    return result
  }

  const aBi = bigrams(a)
  const bBi = bigrams(b)
  let intersection = 0
  for (const bi of aBi) {
    if (bBi.has(bi)) intersection++
  }
  return (2 * intersection) / (aBi.size + bBi.size)
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('🏭 PRODUCT DEDUPLICATION + ENRICHMENT — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  await ensureTable()

  // Step 1: Load all products
  console.log('\n📦 Loading products...')
  let allProducts = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('globalpc_productos')
      .select('producto_id, descripcion, fraccion, valor_unitario, cantidad, cve_proveedor, cve_trafico, company_id')
      .range(offset, offset + PAGE - 1)

    if (error) { console.log(`  ❌ Error: ${error.message}`); break }
    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    offset += PAGE
    if (data.length < PAGE) break
  }

  console.log(`  ${allProducts.length.toLocaleString()} total products loaded`)

  // Step 2: Group by fraccion + cve_proveedor for dedup
  console.log('\n🔍 Finding duplicates...')
  const groups = {}
  for (const p of allProducts) {
    const key = `${p.fraccion || 'NONE'}|${p.cve_proveedor || 'NONE'}`
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }

  let totalDuplicates = 0
  let catalogEntries = []

  for (const [key, products] of Object.entries(groups)) {
    if (products.length <= 1) {
      // Single product — no dedup needed, just catalog it
      const p = products[0]
      const chapter = p.fraccion ? p.fraccion.substring(0, 2) : null
      const prices = [p.valor_unitario].filter(v => v && v > 0)

      catalogEntries.push({
        canonical_description: p.descripcion?.substring(0, 500) || 'SIN DESCRIPCION',
        fraccion: p.fraccion,
        fraccion_source: 'globalpc',
        fraccion_confidence: p.fraccion ? 80 : 0,
        cve_proveedor: p.cve_proveedor,
        company_id: p.company_id || 'evco',
        chapter: chapter ? parseInt(chapter) : null,
        chapter_description: CHAPTER_DESC[chapter] || null,
        tmec_eligible: null, // Will enrich later
        nom_required: chapter ? NOM_CHAPTERS.has(chapter) : null,
        typical_unit_price_usd: prices.length > 0 ? prices[0] : null,
        price_min_usd: prices.length > 0 ? Math.min(...prices) : null,
        price_max_usd: prices.length > 0 ? Math.max(...prices) : null,
        total_imports: 1,
        total_value_usd: (p.valor_unitario || 0) * (p.cantidad || 1),
        duplicate_ids: [p.producto_id],
      })
      continue
    }

    // Multiple products in same fraccion+proveedor — cluster by description
    const clusters = []
    const used = new Set()

    for (let i = 0; i < products.length; i++) {
      if (used.has(i)) continue
      const cluster = [products[i]]
      used.add(i)

      for (let j = i + 1; j < products.length; j++) {
        if (used.has(j)) continue
        const sim = similarity(products[i].descripcion, products[j].descripcion)
        if (sim > 0.85) {
          cluster.push(products[j])
          used.add(j)
          totalDuplicates++
        }
      }
      clusters.push(cluster)
    }

    // Create catalog entry per cluster
    for (const cluster of clusters) {
      // Pick canonical = longest description (most detail)
      const canonical = cluster.sort((a, b) =>
        (b.descripcion || '').length - (a.descripcion || '').length
      )[0]

      const prices = cluster
        .map(p => p.valor_unitario)
        .filter(v => v && v > 0)

      const chapter = canonical.fraccion ? canonical.fraccion.substring(0, 2) : null
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null
      const stdDev = prices.length > 1
        ? Math.sqrt(prices.reduce((s, p) => s + (p - avgPrice) ** 2, 0) / prices.length)
        : 0

      catalogEntries.push({
        canonical_description: canonical.descripcion?.substring(0, 500) || 'SIN DESCRIPCION',
        fraccion: canonical.fraccion,
        fraccion_source: 'globalpc',
        fraccion_confidence: canonical.fraccion ? 80 : 0,
        cve_proveedor: canonical.cve_proveedor,
        company_id: canonical.company_id || 'evco',
        chapter: chapter ? parseInt(chapter) : null,
        chapter_description: CHAPTER_DESC[chapter] || null,
        tmec_eligible: null,
        nom_required: chapter ? NOM_CHAPTERS.has(chapter) : null,
        typical_unit_price_usd: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
        price_min_usd: prices.length > 0 ? Math.min(...prices) : null,
        price_max_usd: prices.length > 0 ? Math.max(...prices) : null,
        price_std_dev: Math.round(stdDev * 100) / 100,
        total_imports: cluster.length,
        total_value_usd: cluster.reduce((s, p) => s + (p.valor_unitario || 0) * (p.cantidad || 1), 0),
        duplicate_ids: cluster.map(p => p.producto_id),
      })
    }
  }

  console.log(`  ${totalDuplicates.toLocaleString()} duplicates found`)
  console.log(`  ${catalogEntries.length.toLocaleString()} canonical products`)

  // Step 3: Enrich with T-MEC eligibility from supplier network
  console.log('\n🌎 Enriching T-MEC eligibility...')
  const { data: suppliers } = await supabase
    .from('supplier_network')
    .select('supplier_name, country, tmec_eligible')
    .limit(500)

  const supplierMap = {}
  for (const s of (suppliers || [])) {
    if (s.supplier_name) supplierMap[s.supplier_name.toUpperCase()] = s
  }

  let tmecEnriched = 0
  for (const entry of catalogEntries) {
    // Try to match supplier
    if (entry.cve_proveedor) {
      const match = supplierMap[entry.cve_proveedor.toUpperCase()]
      if (match) {
        entry.tmec_eligible = match.tmec_eligible || false
        entry.proveedor_nombre = match.supplier_name
        tmecEnriched++
      }
    }
  }
  console.log(`  ${tmecEnriched} products enriched with T-MEC data`)

  // Step 4: Save to product_catalog
  console.log('\n💾 Saving to product_catalog...')

  // Clear existing catalog
  await supabase.from('product_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Insert in batches of 500
  let inserted = 0
  for (let i = 0; i < catalogEntries.length; i += 500) {
    const batch = catalogEntries.slice(i, i + 500)
    const { error } = await supabase.from('product_catalog').insert(batch)
    if (error) {
      console.log(`  ⚠️  Batch ${i}: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const dupPct = allProducts.length > 0
    ? Math.round((totalDuplicates / allProducts.length) * 100)
    : 0

  console.log('\n' + '═'.repeat(55))
  console.log('PRODUCT DEDUP SUMMARY')
  console.log('═'.repeat(55))
  console.log(`Total products scanned: ${allProducts.length.toLocaleString()}`)
  console.log(`Duplicates found: ${totalDuplicates.toLocaleString()} (${dupPct}%)`)
  console.log(`Canonical catalog size: ${catalogEntries.length.toLocaleString()}`)
  console.log(`T-MEC enriched: ${tmecEnriched}`)
  console.log(`Saved to DB: ${inserted.toLocaleString()}`)
  console.log(`Time: ${elapsed}s`)

  // Chapter distribution
  const chapterDist = {}
  for (const e of catalogEntries) {
    const ch = e.chapter || 'Unknown'
    chapterDist[ch] = (chapterDist[ch] || 0) + 1
  }
  const topChapters = Object.entries(chapterDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  console.log('\nTop chapters:')
  for (const [ch, count] of topChapters) {
    console.log(`  Ch ${ch}: ${count} products — ${CHAPTER_DESC[String(ch)] || ''}`)
  }

  // ── Telegram ───────────────────────────────────────
  const report = `🏭 <b>PRODUCT DEDUP COMPLETE</b>
━━━━━━━━━━━━━━━━━━━━━
Products scanned: ${allProducts.length.toLocaleString()}
Duplicates found: ${totalDuplicates.toLocaleString()} (${dupPct}%)
Catalog size: ${catalogEntries.length.toLocaleString()}
T-MEC enriched: ${tmecEnriched}

Top chapters:
${topChapters.map(([ch, n]) => `• Ch ${ch}: ${n} products`).join('\n')}

Time: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  await sendTG(report)
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
