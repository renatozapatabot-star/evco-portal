#!/usr/bin/env node
// scripts/oca-intelligence.js — TIGIE/OCA Classification Intelligence
// Phase A: Seed oca_database from globalpc_productos (real fraccion data)
// Phase B: Classify unclassified products using Qwen 3:32b via Ollama

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const QWEN_MODEL = 'qwen3:32b'
const BATCH_SIZE = 10
const CLASSIFY_LIMIT = 100

async function tg(msg) {
  // Telegram notifications removed — log only
  console.log('[OCA]', msg.replace(/<[^>]*>/g, ''))
}

function normalize(desc) {
  return (desc || '').toLowerCase().trim().replace(/[^a-z0-9\sáéíóúñü]/g, '').replace(/\s+/g, ' ').substring(0, 200)
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function isOllamaRunning() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch { return false }
}

async function askQwen(prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: QWEN_MODEL, prompt, stream: false, options: { temperature: 0.1 } }),
    signal: AbortSignal.timeout(120000),
  })
  const data = await res.json()
  return data.response || ''
}

async function main() {
  console.log('🧠 OCA Intelligence — TIGIE Classification')
  const start = Date.now()

  // ═══ PHASE A: Seed from globalpc_productos with real fracciones ═══
  console.log('\n📦 Phase A: Seeding from globalpc_productos...')

  // Fetch ALL products with fraccion (paginate)
  let allProducts = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('globalpc_productos')
      .select('descripcion, fraccion')
      .not('fraccion', 'is', null)
      .not('descripcion', 'is', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    allProducts = allProducts.concat(data)
    offset += 1000
    if (data.length < 1000) break
  }
  console.log(`  ${allProducts.length} products with fraccion found`)

  // Build frequency map
  const classMap = {} // normalized_desc -> { [fraccion]: count }
  allProducts.forEach(p => {
    const desc = normalize(p.descripcion)
    const frac = p.fraccion
    if (!desc || !frac || frac.length < 6) return
    if (!classMap[desc]) classMap[desc] = {}
    classMap[desc][frac] = (classMap[desc][frac] || 0) + 1
  })

  // Convert to OCA entries
  const entries = []
  Object.entries(classMap).forEach(([desc, fracciones]) => {
    const total = Object.values(fracciones).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(fracciones).sort((a, b) => b[1] - a[1])
    const topFraccion = sorted[0][0]
    const topCount = sorted[0][1]
    const confidence = Math.min(0.99, topCount / total * (total >= 5 ? 1 : 0.7 + total * 0.06))

    entries.push({
      product_description: desc,
      description: desc,
      fraccion: topFraccion,
      confidence: Math.round(confidence * 100) / 100,
      use_count: total,
      alternative_fracciones: sorted.slice(1, 4).map(([f, c]) => ({ fraccion: f, count: c })),
      source: 'globalpc_seed',
      company_id: 'evco',
      updated_at: new Date().toISOString(),
    })
  })

  // Clear old seeds and insert
  await supabase.from('oca_database').delete().eq('source', 'globalpc_seed')
  let inserted = 0
  for (const batch of chunk(entries, 200)) {
    const { error } = await supabase.from('oca_database').insert(batch)
    if (error) console.log('  Insert error:', error.message)
    else inserted += batch.length
  }

  const uniqueFracciones = new Set(entries.map(e => e.fraccion)).size
  const highConf = entries.filter(e => e.confidence >= 0.85).length
  console.log(`  ✅ ${inserted} entries seeded · ${uniqueFracciones} unique fracciones · ${highConf} high confidence`)

  // ═══ PHASE B: Classify unclassified products with Qwen ═══
  console.log('\n🤖 Phase B: Qwen classification of unclassified products...')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) {
    console.log('  ⚠️ Ollama not running — skipping Qwen classification')
    printSummary(entries, start)
    return
  }

  // Get products without fraccion
  const { data: unclassified } = await supabase.from('globalpc_productos')
    .select('id, descripcion')
    .is('fraccion', null)
    .not('descripcion', 'is', null)
    .limit(CLASSIFY_LIMIT)

  if (!unclassified || unclassified.length === 0) {
    console.log('  ✅ No products need classification')
    printSummary(entries, start)
    await tg(`✅ <b>TIGIE:</b> Base de datos completa — ${inserted} fracciones en oca_database`)
    return
  }

  console.log(`  ${unclassified.length} products to classify with ${QWEN_MODEL}`)
  let classified = 0
  let errors = 0

  for (const batch of chunk(unclassified, BATCH_SIZE)) {
    const productList = batch.map((p, i) => `${i + 1}. ${p.descripcion}`).join('\n')

    const prompt = `/no_think
Classify these Mexican import products under the TIGIE (Tarifa de la Ley de los Impuestos Generales de Importación y de Exportación) tariff schedule.

Return ONLY a JSON array. Each element: {"index": number, "fraccion": "XXXXXXXXXX", "confidence": 0.0-1.0}
Fraccion must be 10 digits. No explanation.

Products:
${productList}

JSON:`

    try {
      const response = await askQwen(prompt)
      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (!jsonMatch) { errors += batch.length; continue }

      const results = JSON.parse(jsonMatch[0])
      for (const r of results) {
        const product = batch[r.index - 1]
        if (!product || !r.fraccion || r.fraccion.length < 8) continue

        // Update globalpc_productos
        await supabase.from('globalpc_productos')
          .update({ fraccion: r.fraccion })
          .eq('id', product.id)

        // Also add to oca_database if confidence > 0.6
        if (r.confidence > 0.6) {
          await supabase.from('oca_database').insert({
            product_description: normalize(product.descripcion),
            description: normalize(product.descripcion),
            fraccion: r.fraccion,
            confidence: r.confidence,
            source: 'qwen3_32b',
            company_id: 'evco',
            use_count: 1,
          }).then(() => {}) // ignore duplicates
        }
        classified++
      }
    } catch (e) {
      console.log(`  ❌ Batch error: ${e.message}`)
      errors += batch.length
    }

    if (classified > 0 && classified % 50 === 0) {
      console.log(`  ... ${classified}/${unclassified.length} classified`)
    }
  }

  console.log(`  ✅ ${classified} classified, ${errors} errors`)

  if (classified > 0) {
    await tg(`🏭 <b>TIGIE Classification:</b> ${classified}/${unclassified.length} classified with Qwen\n${inserted} entries in oca_database`)
  }

  printSummary(entries, start)
}

function printSummary(entries, start) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const highConf = entries.filter(e => e.confidence >= 0.85).length
  const medConf = entries.filter(e => e.confidence >= 0.6 && e.confidence < 0.85).length
  const lowConf = entries.filter(e => e.confidence < 0.6).length
  const uniqueFracciones = new Set(entries.map(e => e.fraccion)).size
  console.log(`\n═══ OCA Database Summary ═══`)
  console.log(`  ${entries.length} entries · ${uniqueFracciones} unique fracciones`)
  console.log(`  High confidence (≥0.85): ${highConf}`)
  console.log(`  Medium (0.6–0.85): ${medConf}`)
  console.log(`  Low (<0.6): ${lowConf}`)
  console.log(`  ${elapsed}s`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
