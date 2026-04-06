#!/usr/bin/env node

// ============================================================
// CRUZ Auto-Classifier — AI fracción suggestion with history
// Connected to Operational Brain via decision-logger
// Cross-references new products against 80 years of RZ
// classification history stored in globalpc_productos.
// Cron: triggered by shadow-reader or on-demand
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const DESC_ARG = process.argv.find(a => a.startsWith('--desc='))?.split('=').slice(1).join('=')

async function findHistoricalMatches(description) {
  if (!description || description.length < 5) return []

  // Search globalpc_productos for similar descriptions
  const searchTerms = description.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3)
  if (searchTerms.length === 0) return []

  const { data } = await supabase
    .from('globalpc_productos')
    .select('fraccion, descripcion, company_id')
    .not('fraccion', 'is', null)
    .ilike('descripcion', `%${searchTerms[0]}%`)
    .limit(100)

  if (!data || data.length === 0) return []

  // Score matches by keyword overlap
  const scored = data.map(row => {
    const rowDesc = (row.descripcion || '').toLowerCase()
    const matches = searchTerms.filter(t => rowDesc.includes(t)).length
    return { ...row, matchScore: matches / searchTerms.length }
  }).filter(r => r.matchScore > 0.3).sort((a, b) => b.matchScore - a.matchScore)

  // Group by fracción
  const byFraccion = {}
  for (const row of scored) {
    const f = row.fraccion
    if (!byFraccion[f]) byFraccion[f] = { fraccion: f, count: 0, descriptions: [], companies: new Set() }
    byFraccion[f].count++
    if (byFraccion[f].descriptions.length < 3) byFraccion[f].descriptions.push(row.descripcion?.substring(0, 40))
    byFraccion[f].companies.add(row.company_id)
  }

  return Object.values(byFraccion)
    .map(g => ({ ...g, companies: g.companies.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

async function classifyWithSonnet(description, historicalMatches) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return null

  const historyContext = historicalMatches.length > 0
    ? `\n\nHISTORIAL DE CLASIFICACIONES SIMILARES (Patente 3596):\n${historicalMatches.map(m => `- ${m.fraccion}: ${m.count} clasificaciones previas (${m.descriptions.join('; ')})`).join('\n')}`
    : ''

  const prompt = `Eres un experto en clasificación arancelaria mexicana (TIGIE).
Clasifica este producto. Sugiere las 3 mejores fracciones arancelarias.

PRODUCTO: ${description}
${historyContext}

Responde SOLO con JSON:
{
  "suggestions": [
    {
      "fraccion": "XXXX.XX.XX",
      "description_tigie": "descripción oficial",
      "confidence": 0.0-1.0,
      "reasoning": "por qué esta fracción",
      "igi_rate": "X%",
      "tmec_eligible": true/false
    }
  ],
  "consistency_warning": null or "string si hay inconsistencia con historial"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    if (data.error) return null
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    // Cost tracking
    supabase.from('api_cost_log').insert({
      model: 'claude-haiku-4-5-20251001',
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cost_usd: ((data.usage?.input_tokens || 0) * 0.001 + (data.usage?.output_tokens || 0) * 0.005) / 1000,
      action: 'auto_classification',
    }).then(() => {}, () => {})

    return JSON.parse(match[0])
  } catch { return null }
}

async function main() {
  const description = DESC_ARG
  if (!description) {
    console.log('Usage: node scripts/auto-classifier.js --desc="polipropileno virgen en pellets"')
    process.exit(0)
  }

  console.log(`⚖️ CRUZ Auto-Classifier`)
  console.log(`  Producto: ${description}\n`)

  // 1. Historical matches
  console.log('1. Buscando historial...')
  const history = await findHistoricalMatches(description)
  if (history.length > 0) {
    console.log(`  ${history.length} fracciones históricas encontradas:`)
    history.forEach(h => console.log(`    ${h.fraccion}: ${h.count} precedentes (${h.companies} clientes)`))
  } else {
    console.log('  Sin historial — producto nuevo')
  }

  // 2. AI classification
  console.log('\n2. Clasificación AI...')
  const result = await classifyWithSonnet(description, history)
  if (result?.suggestions) {
    for (const s of result.suggestions) {
      console.log(`  ${s.confidence >= 0.9 ? '🟢' : s.confidence >= 0.7 ? '🟡' : '🔴'} ${s.fraccion} (${Math.round(s.confidence * 100)}%)`)
      console.log(`    ${s.description_tigie}`)
      console.log(`    ${s.reasoning}`)
      console.log(`    IGI: ${s.igi_rate} · T-MEC: ${s.tmec_eligible ? 'Sí' : 'No'}`)
    }
    if (result.consistency_warning) {
      console.log(`\n  ⚠️ ${result.consistency_warning}`)
    }
  } else {
    console.log('  ⚠️ API no disponible — usando solo historial')
    if (history.length > 0) {
      console.log(`  Recomendación basada en historial: ${history[0].fraccion} (${history[0].count} precedentes)`)
    }
  }

  // 3. Save classification
  if (!DRY_RUN && result?.suggestions?.[0]) {
    const top = result.suggestions[0]
    await supabase.from('oca_database').insert({
      product_description: description,
      fraccion: top.fraccion,
      confidence: top.confidence,
      analysis: result,
      created_by: 'auto_classifier',
    }).then(() => {}, () => {})
  }

  // Log to Operational Brain
  try {
    const { logDecision } = require('./decision-logger')
    // Log last classification as sample (actual loop would log each)
    if (top) await logDecision({ decision_type: 'classification', decision: `Fracción ${top.fraccion} sugerida`, reasoning: `${top.confidence}% confianza, ${top.precedentes} precedentes`, alternatives: result?.alternatives })
  } catch {}

  console.log('\n✅ Clasificación completa')
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
