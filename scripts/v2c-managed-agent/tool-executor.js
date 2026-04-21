// scripts/v2c-managed-agent/tool-executor.js
// V2-C Managed Agent — Tool execution layer.
// Uses supabase from job-runner. Does NOT modify any existing files.

const { supabase } = require('../lib/job-runner')
const { normalizeFraccion } = require('./agent-config')

// --- Company slug resolution (copied from auto-classifier.js) ---
const _companySlugCache = new Map()
async function resolveCompanySlug(cveCliente) {
  if (!cveCliente) return null
  if (_companySlugCache.has(cveCliente)) return _companySlugCache.get(cveCliente)
  const { data } = await supabase.from('companies')
    .select('company_id')
    .or(`clave_cliente.eq.${cveCliente},globalpc_clave.eq.${cveCliente}`)
    .eq('active', true)
    .limit(1)
  const slug = data?.[0]?.company_id || null
  if (slug) _companySlugCache.set(cveCliente, slug)
  return slug
}

// --- Tool context (set per-product before tool loop) ---
let _currentProduct = null
function setCurrentProduct(product) {
  _currentProduct = product
}

// --- Tool implementations ---

async function queryClassificationHistory(input) {
  try {
    const { keywords } = input
    if (!keywords || !keywords.length) {
      return { error: 'Se requieren palabras clave', results: [] }
    }

    // Build ilike filter: all keywords must match
    let query = supabase
      .from('globalpc_productos')
      .select('fraccion, descripcion')
      .not('fraccion', 'is', null)
      .limit(200)

    for (const kw of keywords.slice(0, 5)) {
      query = query.ilike('descripcion', `%${kw}%`)
    }

    const { data, error } = await query
    if (error) return { error: error.message, results: [] }
    if (!data || !data.length) return { results: [], message: 'No se encontraron precedentes' }

    // Group by fraccion
    const groups = {}
    for (const row of data) {
      const f = row.fraccion
      if (!groups[f]) groups[f] = { fraccion: f, count: 0, samples: [] }
      groups[f].count++
      if (groups[f].samples.length < 3) groups[f].samples.push(row.descripcion?.slice(0, 80))
    }

    const results = Object.values(groups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return { results, total_matches: data.length }
  } catch (err) {
    return { error: err.message, results: [] }
  }
}

async function queryTariffRates(input) {
  try {
    const { fraccion } = input
    if (!fraccion) return { error: 'Se requiere fraccion' }

    // tariff_rates stores 10-digit fracciones, no dots
    // Agent typically sends 8-digit XXXX.XX.XX, so we pad with 00
    const digits = fraccion.replace(/\D/g, '')
    const padded10 = digits.length === 8 ? digits + '00' : digits
    const prefix8 = digits.slice(0, 8)

    // Try exact 10-digit match first, then prefix match (closest tariff line)
    let { data, error } = await supabase
      .from('tariff_rates')
      .select('fraccion, igi_rate, sample_count, source, valid_from')
      .eq('fraccion', padded10)
      .limit(1)

    if ((!data || !data.length) && prefix8.length === 8) {
      const fallback = await supabase
        .from('tariff_rates')
        .select('fraccion, igi_rate, sample_count, source, valid_from')
        .like('fraccion', prefix8 + '%')
        .limit(1)
      data = fallback.data
      error = fallback.error
    }

    if (error) return { error: error.message }
    if (!data || !data.length) return { found: false, message: `Fraccion ${fraccion} no encontrada en tariff_rates` }

    return { found: true, ...data[0] }
  } catch (err) {
    return { error: err.message }
  }
}

async function submitClassification(input) {
  try {
    const { product_id, fraccion, confidence, reasoning, precedent_count, igi_rate, alternatives } = input
    const normalized = normalizeFraccion(fraccion)

    if (!normalized) {
      return { error: `Fraccion invalida: "${fraccion}". Debe tener al menos 8 digitos.` }
    }

    const product = _currentProduct
    if (!product || String(product.id) !== String(product_id)) {
      return { error: `Product ID mismatch. Expected ${_currentProduct?.id}, got ${product_id}` }
    }

    // Resolve company slug
    const companySlug = await resolveCompanySlug(product.cve_proveedor || product.company_id)

    // Write to agent_decisions (mirrors auto-classifier pattern)
    const { error: adError } = await supabase.from('agent_decisions').insert({
      cycle_id: `v2c-${Date.now()}`,
      trigger_type: 'classification',
      trigger_id: product.id,
      company_id: companySlug,
      workflow: 'classify',
      decision: `Fraccion ${normalized} sugerida`,
      reasoning: `${Math.round(confidence * 100)}% confianza, ${precedent_count || 0} historicos`,
      confidence: confidence,
      autonomy_level: confidence >= 0.85 ? 2 : 1,
      action_taken: confidence >= 0.85 ? 'auto-aplicada a globalpc_productos' : 'pendiente revision humana',
      processing_ms: null,
      payload: {
        product_description: product.descripcion,
        suggested_fraccion: normalized,
        supplier: product.cve_proveedor || null,
        precedent_count: precedent_count || 0,
        tmec_eligible: false,
        igi_rate: igi_rate || null,
        alternatives: (alternatives || []).slice(0, 3).map(a => ({
          fraccion: normalizeFraccion(a.fraccion) || a.fraccion,
          description: a.description || '',
          confidence: a.confidence || 0,
        })),
      },
    })

    if (adError) {
      return { error: `agent_decisions insert failed: ${adError.message}` }
    }

    // Write to globalpc_productos if high confidence
    let wroteGlobalpc = false
    if (confidence >= 0.85) {
      const { error: gpError } = await supabase
        .from('globalpc_productos')
        .update({
          fraccion: normalized,
          fraccion_source: 'ai_auto_classifier',
          fraccion_classified_at: new Date().toISOString(),
        })
        .eq('id', product.id)

      if (gpError) {
        console.error(`[v2c] globalpc_productos update failed: ${gpError.message}`)
      } else {
        wroteGlobalpc = true
      }
    }

    return {
      success: true,
      fraccion: normalized,
      confidence,
      applied: wroteGlobalpc,
      action: wroteGlobalpc ? 'auto-aplicada' : 'pendiente revision humana',
    }
  } catch (err) {
    return { error: err.message }
  }
}

// --- Dispatcher ---

async function executeTool(name, input) {
  switch (name) {
    case 'query_classification_history':
      return queryClassificationHistory(input)
    case 'query_tariff_rates':
      return queryTariffRates(input)
    case 'submit_classification':
      return submitClassification(input)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

module.exports = {
  executeTool,
  setCurrentProduct,
  resolveCompanySlug,
}
