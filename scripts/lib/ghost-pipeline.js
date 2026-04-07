// scripts/lib/ghost-pipeline.js
// ============================================================================
// CRUZ Ghost Pedimento Pipeline — shared core module
// Used by: run-ghost.js (CLI) and clearance-sandbox.js (batch runner)
//
// Simulates pedimento creation: classification, duty calculation, validation.
// Compares ghost output against historically filed pedimentos.
//
// ARCHITECTURE (2026-04-07):
//   aduanet_facturas is the source of truth for financial data.
//   traficos and aduanet_facturas do NOT share a direct join key
//   (traficos.trafico uses "XXXX-YNNNN" format, aduanet_facturas.referencia
//   uses a different format). Query aduanet_facturas directly.
//
//   aduanet_facturas columns: referencia, company_id, clave_cliente,
//     pedimento, patente, aduana, fecha_pago, cve_documento, tipo_cambio,
//     valor_total, valor_usd, dta, igi, iva, ieps, num_factura,
//     moneda, proveedor, incoterm
//
//   Fraccion comes from globalpc_productos (linked by cve_cliente).
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const { getAllRates } = require('./rates')

// ── Field weights for scoring (from sandbox-config.json defaults) ──────────

const FIELD_WEIGHTS = {
  fraccion: 40,    // Most critical — wrong fraccion = SAT audit risk
  total: 30,       // Financial accuracy
  tmec: 20,        // Savings accuracy — false negative = client overpaid
  extraction: 10,  // Completeness
}

const DEFAULT_TOLERANCES = {
  fraccion: 'exact',
  valor_pct: 0.01,
  igi_pct: 0.05,
  dta_pct: 0.05,
  iva_pct: 0.05,
  total_pct: 0.05,
  tipo_cambio_pct: 0.02,
}

// ── Historical fraccion lookup (zero-cost) ─────────────────────────────────

async function findHistoricalMatches(description, supabase) {
  if (!description || description.length < 5) return []

  const searchTerms = description.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3)
  if (searchTerms.length === 0) return []

  const { data } = await supabase
    .from('globalpc_productos')
    .select('fraccion, descripcion, company_id')
    .not('fraccion', 'is', null)
    .ilike('descripcion', `%${searchTerms[0]}%`)
    .limit(100)

  if (!data || data.length === 0) return []

  const scored = data.map(row => {
    const rowDesc = (row.descripcion || '').toLowerCase()
    const matches = searchTerms.filter(t => rowDesc.includes(t)).length
    return { ...row, matchScore: matches / searchTerms.length }
  }).filter(r => r.matchScore > 0.3).sort((a, b) => b.matchScore - a.matchScore)

  const byFraccion = {}
  for (const row of scored) {
    const f = row.fraccion
    if (!byFraccion[f]) byFraccion[f] = { fraccion: f, count: 0, descriptions: [], companies: new Set() }
    byFraccion[f].count++
    if (byFraccion[f].descriptions.length < 3) byFraccion[f].descriptions.push((row.descripcion || '').substring(0, 40))
    byFraccion[f].companies.add(row.company_id)
  }

  return Object.values(byFraccion)
    .map(g => ({ ...g, companies: g.companies.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

// ── AI classification via Haiku (cost-tracked) ─────────────────────────────

async function classifyWithHaiku(description, historicalMatches, supabase) {
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
      "tmec_eligible": true
    }
  ],
  "consistency_warning": null
}`

  const start = Date.now()
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

    const inputTokens = data.usage?.input_tokens || 0
    const outputTokens = data.usage?.output_tokens || 0
    const costUsd = (inputTokens * 0.001 + outputTokens * 0.005) / 1000

    // Cost tracking — fire and forget
    supabase.from('api_cost_log').insert({
      model: 'claude-haiku-4-5-20251001',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      action: 'ghost_classification',
      latency_ms: Date.now() - start,
    }).then(() => {}, () => {})

    const parsed = JSON.parse(match[0])
    return {
      ...parsed,
      tokens: { input: inputTokens, output: outputTokens },
      cost_usd: costUsd,
    }
  } catch { return null }
}

// ── Look up tariff rate from tariff_rates table ────────────────────────────
//
// Returns { igi_rate, tmec_eligible } or null if fraccion not found.
// T-MEC eligibility: igi_rate === 0 means the fraccion is T-MEC eligible.
// If table is empty or query fails: returns null → caller must default conservatively.

async function lookupTariffRate(fraccion, supabase) {
  if (!fraccion) return null

  try {
    const { data, error } = await supabase
      .from('tariff_rates')
      .select('igi_rate')
      .eq('fraccion', fraccion)
      .maybeSingle()

    if (error || !data) return null

    const rate = parseFloat(data.igi_rate) || 0
    return { igi_rate: rate, tmec_eligible: rate === 0 }
  } catch {
    // Table doesn't exist or query fails — conservative default handled by caller
    return null
  }
}

// ── Calculate contributions (cascading IVA — NEVER flat) ────────────────────
//
// DTA in Mexico is a FIXED FEE per pedimento, NOT a percentage of valor.
// Current rates (SAT 2024-2026):
//   - A1/IN standard: 462 MXN per pedimento
//   - IT/ITE/ITR fixed: 408 MXN per pedimento
// Higher observed values (924, 1386, 1848) are multiples for multi-partida.
//
// IGI is a percentage of valor_aduana, varies by fracción arancelaria.
// T-MEC (IGI=0) requires BOTH: origin USA/Canada AND fracción confirmed eligible.

function calculateContributions(valorUSD, regimen, igiRate, rates, options = {}) {
  const { exchangeRate, dtaRates, ivaRate } = rates
  const valorMXN = Math.round(valorUSD * exchangeRate * 100) / 100

  // DTA: ALWAYS a fixed fee per pedimento in Mexican customs (SAT 2024-2026).
  // Standard A1/IN: 462 MXN. IT/ITE/ITR (IMMEX temporal): 408 MXN.
  // Never calculate as percentage of valor — that is fundamentally wrong.
  const dtaConfig = dtaRates[regimen] || dtaRates['A1'] || {}
  const dtaAmount = dtaConfig.amount || 462 // MXN fixed fee — NEVER percentage

  // IGI: percentage of valor_aduana. T-MEC eligibility handled upstream.
  const igiAmount = Math.round(valorMXN * (igiRate || 0) * 100) / 100

  // IVA base = valor_aduana + DTA + IGI (cascading — NEVER flat value × 0.16)
  const ivaBase = valorMXN + dtaAmount + igiAmount
  const ivaAmount = Math.round(ivaBase * ivaRate * 100) / 100

  return {
    valor_aduana_usd: valorUSD,
    valor_aduana_mxn: valorMXN,
    tipo_cambio: exchangeRate,
    dta: { type: 'fixed', amount_mxn: dtaAmount },
    igi: { rate: igiRate || 0, amount_mxn: igiAmount, tmec: options.tmec || false },
    iva: { rate: ivaRate, base_mxn: ivaBase, amount_mxn: ivaAmount },
    total_contribuciones_mxn: dtaAmount + igiAmount + ivaAmount,
  }
}

// ── 25-field validator ──────────────────────────────────────────────────────

function validateGhostPedimento(data) {
  const checks = []
  const add = (name, ok, msg) => checks.push({ name, ok, message: msg })

  add('supplier_name', !!data.supplier_name, 'Proveedor identificado')
  add('supplier_country', !!data.supplier_country, 'País de origen')
  add('invoice_number', !!data.invoice_number, 'Número de factura')
  add('total_value', data.total_value > 0, 'Valor comercial > 0')
  add('currency', ['USD', 'MXN', 'EUR'].includes(data.currency), 'Moneda válida')
  add('fraccion_exists', !!data.fraccion, 'Fracción arancelaria asignada')
  add('fraccion_format', /^\d{4}\.\d{2}\.\d{2}$/.test(data.fraccion || ''), 'Formato XXXX.XX.XX')
  add('exchange_rate', data.contributions?.tipo_cambio > 0, 'Tipo de cambio vigente')
  add('dta_calculated', data.contributions?.dta?.amount_mxn >= 0, 'DTA calculado')
  add('igi_calculated', data.contributions?.igi?.amount_mxn >= 0, 'IGI calculado')
  add('iva_calculated', data.contributions?.iva?.amount_mxn >= 0, 'IVA calculado')
  add('iva_base_correct', (data.contributions?.iva?.base_mxn || 0) > (data.contributions?.dta?.amount_mxn || 0), 'IVA base = valor + DTA + IGI')
  add('regime', !!data.regimen, 'Régimen declarado')
  add('tmec_check', typeof data.tmec === 'boolean', 'T-MEC evaluado')
  add('value_positive', data.total_value > 0 && data.total_value < 50000000, 'Valor en rango razonable')
  add('patente', true, 'Patente 3596')
  add('aduana', true, 'Aduana 240')

  const passed = checks.filter(c => c.ok).length
  const score = Math.round((passed / checks.length) * 100)

  return { score, total: checks.length, passed, checks }
}

// ── Run ghost pipeline on a factura row ─────────────────────────────────────

async function runGhostForFactura(factura, supabase, options = {}) {
  const startTime = Date.now()
  let totalTokens = 0
  let totalCostUsd = 0
  const flags = []

  // 1. Find product descriptions for this client from globalpc_productos
  const { data: products } = await supabase
    .from('globalpc_productos')
    .select('fraccion, descripcion, cve_proveedor')
    .eq('cve_cliente', factura.clave_cliente)
    .not('fraccion', 'is', null)
    .not('descripcion', 'eq', '')
    .limit(50)

  // Use first available product description for classification
  const description = products?.[0]?.descripcion || null

  // 2. Classify fraccion
  let fraccion = null
  let classificationSource = null
  let classificationConfidence = 0

  if (description) {
    const history = await findHistoricalMatches(description, supabase)
    if (history.length > 0 && history[0].count >= 3) {
      fraccion = history[0].fraccion
      classificationSource = 'historical'
      classificationConfidence = Math.min(0.95, 0.5 + (history[0].count / 100))
    }

    if (classificationConfidence < 0.9) {
      const aiResult = await classifyWithHaiku(description, history, supabase)
      if (aiResult?.suggestions?.[0]) {
        const top = aiResult.suggestions[0]
        if (top.confidence > classificationConfidence) {
          fraccion = top.fraccion
          classificationSource = 'haiku'
          classificationConfidence = top.confidence
        }
        totalTokens += (aiResult.tokens?.input || 0) + (aiResult.tokens?.output || 0)
        totalCostUsd += aiResult.cost_usd || 0
      }
    }
  }

  if (!fraccion) flags.push('NO_FRACCION')

  // 3. Look up tariff rate — T-MEC eligibility comes from tariff_rates, NOT origin country
  const tariffLookup = await lookupTariffRate(fraccion, supabase)
  let igiRate = null
  let tmecConfirmed = false

  if (tariffLookup) {
    // tariff_rates has this fraccion — use its rate
    igiRate = tariffLookup.igi_rate
    tmecConfirmed = tariffLookup.tmec_eligible // true only if igi_rate === 0
  } else if (fraccion) {
    // Fracción not in tariff_rates — conservative: assume IGI applies (non-zero).
    // T-MEC NOT confirmed. Flag for human review.
    flags.push('tariff_rate_missing')
    flags.push('tmec_no_verificado')
    igiRate = 0.05 // 5% conservative fallback — better to overestimate than miss IGI
  }

  // 4. Determine regime from cve_documento (A1, IN, RT, V1, etc.)
  const regimen = (factura.cve_documento || 'A1').toUpperCase()

  // 5. Get rates — use historical tipo_cambio from factura in sandbox mode
  let rates
  if (options.useHistoricalRates && factura.tipo_cambio) {
    const currentRates = await getAllRates()
    rates = {
      exchangeRate: parseFloat(factura.tipo_cambio),
      dtaRates: currentRates.dtaRates,
      ivaRate: currentRates.ivaRate,
    }
  } else {
    rates = await getAllRates()
  }

  // 6. Get value from factura
  const valorUSD = parseFloat(factura.valor_usd) || 0
  if (valorUSD <= 0) flags.push('NO_VALUE')

  // 7. Calculate contributions
  const contributions = calculateContributions(valorUSD, regimen, igiRate, rates, { tmec: tmecConfirmed })

  // 8. Validate
  const ghostData = {
    supplier_name: factura.proveedor,
    supplier_country: null, // not in aduanet_facturas
    invoice_number: factura.num_factura,
    total_value: valorUSD,
    currency: factura.moneda || 'USD',
    fraccion,
    regimen,
    tmec: tmecConfirmed,
    contributions,
  }
  const validation = validateGhostPedimento(ghostData)

  let confianza = 'BAJA'
  if (validation.score >= 90 && classificationConfidence >= 0.9) confianza = 'ALTA'
  else if (validation.score >= 70 && classificationConfidence >= 0.7) confianza = 'MEDIA'

  return {
    referencia: factura.referencia,
    company_id: factura.company_id,
    clave_cliente: factura.clave_cliente,
    fecha_pago: factura.fecha_pago,
    pedimento: factura.pedimento,
    estatus: 'filed',

    proveedor: factura.proveedor,
    pais_origen: null,
    invoice_number: factura.num_factura,
    currency: factura.moneda || 'USD',

    fraccion,
    classification_source: classificationSource,
    classification_confidence: classificationConfidence,
    description,

    tmec: tmecConfirmed,
    regimen,

    valor_usd: valorUSD,
    tipo_cambio: contributions.tipo_cambio,
    valor_aduana_mxn: contributions.valor_aduana_mxn,
    igi_rate: igiRate,
    igi_mxn: contributions.igi.amount_mxn,
    dta_type: contributions.dta.type,
    dta_mxn: contributions.dta.amount_mxn,
    iva_rate: contributions.iva.rate,
    iva_base_mxn: contributions.iva.base_mxn,
    iva_mxn: contributions.iva.amount_mxn,
    total_contribuciones_mxn: contributions.total_contribuciones_mxn,

    confianza,
    confianza_score: validation.score,
    validation,
    flags,

    tokens_used: totalTokens,
    cost_usd: totalCostUsd,
    latency_ms: Date.now() - startTime,
  }
}

// ── Wrapper: run pipeline by referencia (queries aduanet_facturas) ──────────

async function runGhostPipeline(ref, supabase, options = {}) {
  const clientCode = options.companyId || process.env.DEFAULT_COMPANY_ID || 'evco'

  // Query aduanet_facturas directly — NOT traficos (different reference formats)
  const { data: factura, error } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('referencia', ref)
    .eq('company_id', clientCode)
    .maybeSingle()

  if (error) throw new Error(`Query aduanet_facturas failed: ${error.message}`)
  if (!factura) throw new Error(`Factura ${ref} not found for client ${clientCode}`)

  return runGhostForFactura(factura, supabase, options)
}

// ── Extract actual data from a factura row (no extra query needed) ──────────

function loadActualFromFactura(factura) {
  // igi=null means "not recorded" — NOT "T-MEC applied (IGI=0)"
  const igiRaw = factura.igi
  const igi = igiRaw !== null && igiRaw !== undefined ? parseFloat(igiRaw) : null
  const dta = parseFloat(factura.dta || 0)
  const iva = parseFloat(factura.iva || 0)

  // T-MEC: only confirmed when IGI is explicitly 0 (not null).
  // null IGI = data not available = T-MEC unknown.
  const isTMEC = igi !== null ? igi === 0 : null

  return {
    referencia: factura.referencia,
    fraccion: null, // not in aduanet_facturas — pipeline-derived
    valor_usd: parseFloat(factura.valor_usd || 0),
    igi: igi ?? 0, dta, iva,
    total: (igi ?? 0) + dta + iva,
    tmec: isTMEC,
    tipo_cambio: parseFloat(factura.tipo_cambio || 0),
  }
}

// ── Wrapper: load actual data by referencia ─────────────────────────────────

async function loadActualData(ref, clientCode, supabase) {
  const { data: factura } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('referencia', ref)
    .eq('company_id', clientCode)
    .maybeSingle()

  if (!factura) return null
  return loadActualFromFactura(factura)
}

// ── Fetch latest factura for --latest flag ──────────────────────────────────

async function fetchLatestFactura(clientCode, supabase) {
  const { data } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('company_id', clientCode)
    .not('igi', 'is', null)
    .gt('valor_usd', 0)
    .order('fecha_pago', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

// ── Compare ghost output against actual filed data ──────────────────────────

function compareWithActual(ghost, actual, tolerances = DEFAULT_TOLERANCES) {
  if (!actual) return null

  const fields = {}
  const incompleteFields = []

  function numericMatch(fieldName, ghostVal, actualVal, tolerancePct) {
    if (actualVal === null || actualVal === undefined || actualVal === 0) {
      if (ghostVal === 0 || ghostVal === null) return { match: true, score: 100 }
      incompleteFields.push(fieldName)
      return { match: null, score: null, incomplete: true }
    }
    const delta = Math.abs(ghostVal - actualVal)
    const pct = delta / Math.abs(actualVal)
    return {
      match: pct <= tolerancePct,
      score: Math.max(0, Math.round((1 - pct) * 100)),
      ghost: ghostVal,
      actual: actualVal,
      delta_pct: Math.round(pct * 10000) / 100,
    }
  }

  // Fraccion
  if (!actual.fraccion) {
    incompleteFields.push('fraccion')
    fields.fraccion = { match: null, score: null, incomplete: true }
  } else {
    const ghostFrac = (ghost.fraccion || '').trim()
    const actualFrac = (actual.fraccion || '').trim()
    const exactMatch = ghostFrac === actualFrac
    const chapterMatch = !exactMatch && ghostFrac.substring(0, 4) === actualFrac.substring(0, 4)
    fields.fraccion = {
      match: exactMatch,
      score: exactMatch ? 100 : (chapterMatch ? 50 : 0),
      ghost: ghostFrac,
      actual: actualFrac,
      chapter_match: chapterMatch,
    }
  }

  // Numeric fields
  fields.valor = numericMatch('valor', ghost.valor_usd, actual.valor_usd, tolerances.valor_pct || 0.01)
  fields.igi = numericMatch('igi', ghost.igi_mxn, actual.igi, tolerances.igi_pct || 0.05)
  fields.dta = numericMatch('dta', ghost.dta_mxn, actual.dta, tolerances.dta_pct || 0.05)
  fields.iva = numericMatch('iva', ghost.iva_mxn, actual.iva, tolerances.iva_pct || 0.05)
  fields.total = numericMatch('total', ghost.total_contribuciones_mxn, actual.total, tolerances.total_pct || 0.05)
  fields.tipo_cambio = numericMatch('tipo_cambio', ghost.tipo_cambio, actual.tipo_cambio, tolerances.tipo_cambio_pct || 0.02)

  // T-MEC
  if (actual.tmec === null || actual.tmec === undefined) {
    incompleteFields.push('tmec')
    fields.tmec = { match: null, score: null, incomplete: true }
  } else {
    const tmecMatch = ghost.tmec === actual.tmec
    fields.tmec = {
      match: tmecMatch,
      score: tmecMatch ? 100 : 0,
      ghost: ghost.tmec,
      actual: actual.tmec,
      false_negative: !ghost.tmec && actual.tmec,
    }
  }

  return { fields, incomplete_fields: incompleteFields }
}

// ── Score a comparison result ───────────────────────────────────────────────

function scoreComparison(comparison, config = {}) {
  if (!comparison) return { overall_score: 0, pass: false, field_scores: {}, failure_reasons: ['NO_ACTUAL_DATA'] }

  const weights = config.field_weights || FIELD_WEIGHTS
  const passThreshold = config.pass_threshold || 95
  const { fields, incomplete_fields } = comparison

  let totalWeight = 0
  let weightedScore = 0
  const failureReasons = []

  if (fields.fraccion && !fields.fraccion.incomplete) {
    totalWeight += weights.fraccion
    weightedScore += (fields.fraccion.score / 100) * weights.fraccion
    if (!fields.fraccion.match) failureReasons.push('fraccion_mismatch')
  }

  if (fields.total && !fields.total.incomplete) {
    totalWeight += weights.total
    weightedScore += (fields.total.score / 100) * weights.total
    if (!fields.total.match) failureReasons.push('total_delta')
  }

  if (fields.tmec && !fields.tmec.incomplete) {
    totalWeight += weights.tmec
    weightedScore += (fields.tmec.score / 100) * weights.tmec
    if (!fields.tmec.match) {
      failureReasons.push(fields.tmec.false_negative ? 'tmec_false_negative_CRITICAL' : 'tmec_mismatch')
    }
  }

  const scoreableFields = Object.values(fields).filter(f => !f.incomplete).length
  const totalFields = Object.keys(fields).length
  const extractionScore = totalFields > 0 ? (scoreableFields / totalFields) * 100 : 0
  totalWeight += weights.extraction
  weightedScore += (extractionScore / 100) * weights.extraction
  if (extractionScore < 80) failureReasons.push('extraction_incomplete')

  const overallScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100 * 100) / 100 : 0
  const pass = overallScore >= passThreshold && !failureReasons.some(r => r.includes('CRITICAL'))

  const fieldScores = {}
  for (const [key, val] of Object.entries(fields)) {
    fieldScores[key] = {
      score: val.score,
      match: val.match,
      incomplete: !!val.incomplete,
      ghost: val.ghost,
      actual: val.actual,
      delta_pct: val.delta_pct,
    }
  }

  return {
    overall_score: overallScore,
    pass,
    field_scores: fieldScores,
    failure_reasons: failureReasons,
    incomplete_fields,
  }
}

module.exports = {
  runGhostPipeline,
  runGhostForFactura,
  loadActualData,
  loadActualFromFactura,
  fetchLatestFactura,
  compareWithActual,
  scoreComparison,
  calculateContributions,
  validateGhostPedimento,
  findHistoricalMatches,
  classifyWithHaiku,
  lookupTariffRate,
  FIELD_WEIGHTS,
  DEFAULT_TOLERANCES,
}
