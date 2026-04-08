#!/usr/bin/env node

/**
 * CRUZ MCP Server — The First AI-Native Customs Broker
 *
 * Patente 3596 · Aduana 240 · Nuevo Laredo
 * Available via Model Context Protocol.
 *
 * Your AI agent finds a supplier in Mexico?
 * Call CRUZ to classify, quote, and clear it.
 *
 * Usage:
 *   node scripts/cruz-mcp-server.js
 *
 * Claude Desktop config:
 *   { "mcpServers": { "cruz": { "command": "node", "args": ["scripts/cruz-mcp-server.js"] } } }
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const { createClient } = require('@supabase/supabase-js')

// ── Environment ──
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { llmCall } = require('./lib/llm')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  process.stderr.write('CRUZ MCP: Missing SUPABASE env vars\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Constants ──
const DEFAULT_IGI_RATE = 0.05
const IVA_RATE = 0.16
const BRIDGE_FACTORS = {
  'World Trade': { time: 1.0, reco: 0.12 },
  'Colombia': { time: 0.85, reco: 0.09 },
  'Juárez-Lincoln': { time: 1.15, reco: 0.14 },
  'Gateway': { time: 1.1, reco: 0.11 },
}
const MVE_DEADLINE = '2026-03-31T23:59:59-06:00'

// ── Rate helpers ──

async function getRates() {
  const [dtaRes, ivaRes, tcRes] = await Promise.all([
    supabase.from('system_config').select('value, valid_to').eq('key', 'dta_rates').single(),
    supabase.from('system_config').select('value, valid_to').eq('key', 'iva_rate').single(),
    supabase.from('system_config').select('value').eq('key', 'banxico_exchange_rate').single(),
  ])
  const dta = dtaRes.data?.value?.A1?.rate ?? 0.008
  const iva = ivaRes.data?.value?.rate ?? IVA_RATE
  const tc = tcRes.data?.value?.rate ?? 17.5
  const tcDate = tcRes.data?.value?.date ?? null
  return { dta, iva, tc, tcDate }
}

// ── Tool implementations ──

async function classifyProduct({ description, origin_country }) {
  // Step 1: Pattern match from fraccion_patterns (fast, free)
  const descLower = (description || '').toLowerCase()
  const { data: patterns } = await supabase
    .from('fraccion_patterns')
    .select('fraccion, description_keywords, confidence, alt_fracciones')
    .limit(500)

  let bestMatch = null
  let bestScore = 0

  for (const p of (patterns || [])) {
    const keywords = p.description_keywords || []
    const matchCount = keywords.filter(kw => descLower.includes(kw.toLowerCase())).length
    if (matchCount > 0) {
      const score = matchCount / keywords.length
      if (score > bestScore) {
        bestScore = score
        bestMatch = p
      }
    }
  }

  if (bestMatch && bestScore > 0.3) {
    const isTmec = origin_country && ['US', 'USA', 'CA', 'CAN', 'MX', 'MEX'].includes(origin_country.toUpperCase())
    return {
      fraccion: bestMatch.fraccion,
      confidence: Math.round(bestScore * bestMatch.confidence),
      igi_rate: isTmec ? 0 : DEFAULT_IGI_RATE,
      tmec_eligible: !!isTmec,
      source: 'pattern_match',
      alternatives: bestMatch.alt_fracciones || [],
    }
  }

  // Step 2: Haiku classification (if pattern match fails)
  if (!ANTHROPIC_KEY) {
    return { error: 'No pattern match found and AI classification unavailable' }
  }

  const result = await llmCall({
    modelClass: 'fast',
    messages: [{ role: 'user', content: `Classify this product for Mexican customs (fracción arancelaria XXXX.XX.XX format).
Product: ${description}
Origin: ${origin_country || 'Unknown'}

Return JSON only: { "fraccion": "XXXX.XX.XX", "description_es": "...", "igi_rate": 0.05, "confidence": 85 }` }],
    maxTokens: 300,
    callerName: 'cruz-mcp-server',
  })

  // Cost tracking — operational resilience rule #4
  supabase.from('api_cost_log').insert({
    model: result.model,
    input_tokens: result.tokensIn,
    output_tokens: result.tokensOut,
    cost_usd: (result.tokensIn * 0.001 + result.tokensOut * 0.005) / 1000,
    action: 'mcp_classify_product',
    client_code: 'mcp',
    latency_ms: result.durationMs,
  }).then(() => {}, () => {})
  const text = result.text
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const isTmec = origin_country && ['US', 'USA', 'CA', 'CAN', 'MX', 'MEX'].includes(origin_country.toUpperCase())
      return {
        fraccion: parsed.fraccion,
        description_es: parsed.description_es,
        confidence: parsed.confidence || 70,
        igi_rate: isTmec ? 0 : (parsed.igi_rate || DEFAULT_IGI_RATE),
        tmec_eligible: !!isTmec,
        source: 'ai_classification',
      }
    }
  } catch {}
  return { error: 'Classification failed', raw: text }
}

async function estimateLandedCost({ value_usd, weight_kg, fraccion, origin_country, regimen }) {
  const rates = await getRates()
  const isTmec = regimen && ['ITE', 'ITR', 'IMD'].includes(regimen.toUpperCase())
  const igiRate = isTmec ? 0 : DEFAULT_IGI_RATE

  const valorMxn = value_usd * rates.tc
  const dtaMxn = Math.round(valorMxn * rates.dta)
  const igiMxn = Math.round(valorMxn * igiRate)
  const ivaBase = valorMxn + dtaMxn + igiMxn
  const ivaMxn = Math.round(ivaBase * rates.iva)
  const totalDutiesMxn = dtaMxn + igiMxn + ivaMxn
  const totalDutiesUsd = Math.round(totalDutiesMxn / rates.tc * 100) / 100
  const totalLandedUsd = value_usd + totalDutiesUsd

  return {
    merchandise_usd: value_usd,
    exchange_rate: rates.tc,
    exchange_rate_date: rates.tcDate,
    dta_mxn: dtaMxn,
    dta_usd: Math.round(dtaMxn / rates.tc * 100) / 100,
    igi_mxn: igiMxn,
    igi_usd: Math.round(igiMxn / rates.tc * 100) / 100,
    igi_rate: igiRate,
    iva_mxn: ivaMxn,
    iva_usd: Math.round(ivaMxn / rates.tc * 100) / 100,
    total_duties_mxn: totalDutiesMxn,
    total_duties_usd: totalDutiesUsd,
    total_landed_usd: totalLandedUsd,
    effective_tax_rate: Math.round(totalDutiesUsd / value_usd * 1000) / 10,
    per_kg_usd: weight_kg > 0 ? Math.round(totalLandedUsd / weight_kg * 100) / 100 : null,
    tmec_applied: !!isTmec,
    tmec_savings_usd: isTmec ? 0 : null,
    patente: '3596',
    aduana: '240 — Nuevo Laredo',
  }
}

async function predictCrossingTime({ bridge, product_category, day_of_week }) {
  const dayNum = day_of_week ?? new Date().getDay()

  // Query crossing_windows for historical average
  const { data: windows } = await supabase
    .from('crossing_windows')
    .select('day_of_week, avg_crossing_days, sample_count')
    .eq('day_of_week', dayNum)
    .limit(10)

  // Query recent bridge wait times
  const { data: bridgeTimes } = await supabase
    .from('bridge_times')
    .select('bridge, commercial_wait_minutes, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10)

  const selectedBridge = bridge || 'World Trade'
  const factor = BRIDGE_FACTORS[selectedBridge] || BRIDGE_FACTORS['World Trade']

  // Compute average crossing hours
  let avgHours = 4.5 // default if no data
  let sampleCount = 0
  if (windows && windows.length > 0) {
    const total = windows.reduce((s, w) => s + (w.avg_crossing_days || 0), 0)
    avgHours = (total / windows.length) * 24
    sampleCount = windows.reduce((s, w) => s + (w.sample_count || 0), 0)
  }

  const estimatedHours = Math.round(avgHours * factor.time * 10) / 10
  const currentWait = bridgeTimes?.find(b => (b.bridge || '').includes(selectedBridge))

  return {
    bridge: selectedBridge,
    estimated_hours: estimatedHours,
    reconocimiento_probability: factor.reco,
    confidence: sampleCount > 50 ? 85 : sampleCount > 10 ? 70 : 50,
    sample_count: sampleCount,
    current_bridge_wait_minutes: currentWait?.commercial_wait_minutes ?? null,
    bridge_recommendation: factor.time <= 0.9 ? `${selectedBridge} is optimal` : 'Consider Colombia Bridge for faster crossing',
    day_of_week: dayNum,
    days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayNum],
  }
}

async function checkCompliance({ rfc, fraccion, regimen }) {
  const alerts = []

  // Query compliance_risk_scores
  if (rfc) {
    const { data: risk } = await supabase
      .from('compliance_risk_scores')
      .select('risk_level, audit_probability, risk_factors, recommended_actions')
      .eq('company_id', rfc)
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (risk) {
      alerts.push({
        type: 'audit_risk',
        level: risk.risk_level,
        probability: risk.audit_probability,
        factors: risk.risk_factors,
        actions: risk.recommended_actions,
      })
    }
  }

  // Query regulatory_timeline for upcoming changes
  if (fraccion) {
    const { data: regs } = await supabase
      .from('regulatory_timeline')
      .select('event_date, title, description, impact_metrics')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(5)

    for (const r of (regs || [])) {
      alerts.push({
        type: 'regulatory_change',
        date: r.event_date,
        title: r.title,
        description: r.description,
        impact: r.impact_metrics,
      })
    }
  }

  // MVE status
  const now = new Date()
  const mveDate = new Date(MVE_DEADLINE)
  const daysUntilMve = Math.ceil((mveDate.getTime() - now.getTime()) / 86400000)

  return {
    fraccion: fraccion || null,
    regimen: regimen || 'A1',
    mve_status: daysUntilMve > 0 ? `${daysUntilMve} días para fecha límite MVE` : 'MVE E2 obligatorio — verificar cumplimiento',
    mve_compliant: daysUntilMve <= 0,
    regulatory_alerts: alerts,
    broker: 'Renato Zapata & Company — Patente 3596',
  }
}

async function requestQuote({ product_description, origin_country, destination_city, value_usd, weight_kg }) {
  // Classify + estimate in one call
  const classification = await classifyProduct({ description: product_description, origin_country })
  const landed = await estimateLandedCost({
    value_usd, weight_kg,
    fraccion: classification.fraccion,
    origin_country,
    regimen: classification.tmec_eligible ? 'ITE' : 'A1',
  })
  const crossing = await predictCrossingTime({ bridge: 'World Trade' })

  const quoteId = `CRUZ-Q-${Date.now()}`

  // Log to audit
  await supabase.from('audit_log').insert({
    action: 'mcp_quote_requested',
    resource: 'quote',
    resource_id: quoteId,
    diff: {
      product: product_description,
      origin: origin_country,
      destination: destination_city,
      value_usd, weight_kg,
      classification,
      landed_total: landed.total_landed_usd,
    },
    created_at: new Date().toISOString(),
  })

  return {
    quote_id: quoteId,
    status: 'pending_approval',
    classification: {
      fraccion: classification.fraccion,
      tmec_eligible: classification.tmec_eligible,
      confidence: classification.confidence,
    },
    costs: {
      merchandise_usd: value_usd,
      duties_usd: landed.total_duties_usd,
      total_landed_usd: landed.total_landed_usd,
      effective_tax_rate: landed.effective_tax_rate,
      breakdown: {
        dta_usd: landed.dta_usd,
        igi_usd: landed.igi_usd,
        iva_usd: landed.iva_usd,
      },
    },
    timeline: {
      estimated_crossing_hours: crossing.estimated_hours,
      estimated_clearance_days: 3,
      bridge: crossing.bridge,
    },
    broker: {
      name: 'Renato Zapata & Company',
      patente: '3596',
      aduana: '240 — Nuevo Laredo',
      license: 'US + Mexico dual-licensed',
    },
    note: 'This quote requires broker approval before becoming binding. A representative will confirm within 24 hours.',
  }
}

async function submitShipment({ quote_id }) {
  // Verify quote exists in audit log
  const { data: quote } = await supabase
    .from('audit_log')
    .select('diff')
    .eq('resource_id', quote_id)
    .eq('action', 'mcp_quote_requested')
    .maybeSingle()

  if (!quote) {
    return { error: `Quote ${quote_id} not found. Request a quote first.` }
  }

  return {
    status: 'pending_broker_review',
    quote_id,
    message: 'Shipment submission received. Renato Zapata & Company (Patente 3596) will review and initiate customs clearance. You will receive a tracking_id once the shipment is accepted.',
    next_steps: [
      'Broker reviews and approves the quote',
      'CRUZ assigns a tráfico number',
      'Document collection begins automatically',
      'You can track status via get_shipment_status',
    ],
  }
}

async function getShipmentStatus({ tracking_id }) {
  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, fecha_cruce, fecha_pago, pedimento, importe_total, descripcion_mercancia, semaforo')
    .eq('trafico', tracking_id)
    .maybeSingle()

  if (!trafico) {
    return { error: `Shipment ${tracking_id} not found` }
  }

  // Get recent events
  const { data: events } = await supabase
    .from('workflow_events')
    .select('workflow, event_type, status, created_at')
    .eq('trigger_id', tracking_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get pending documents
  const { data: pendingDocs } = await supabase
    .from('documento_solicitudes')
    .select('doc_type, status, solicitado_at')
    .eq('trafico_id', tracking_id)
    .eq('status', 'solicitado')

  // Derive next milestone
  const estatus = (trafico.estatus || '').toLowerCase()
  let nextMilestone = 'Document collection'
  if (estatus.includes('cruz')) nextMilestone = 'Completed — delivered'
  else if (trafico.fecha_cruce) nextMilestone = 'In transit to destination'
  else if (trafico.fecha_pago) nextMilestone = 'Awaiting customs clearance (semáforo)'
  else if (trafico.pedimento) nextMilestone = 'Pedimento payment'
  else nextMilestone = 'Document verification and pedimento preparation'

  return {
    tracking_id,
    status: trafico.estatus || 'En Proceso',
    description: trafico.descripcion_mercancia,
    value_usd: trafico.importe_total,
    dates: {
      arrived: trafico.fecha_llegada,
      paid: trafico.fecha_pago,
      crossed: trafico.fecha_cruce,
    },
    pedimento: trafico.pedimento,
    semaforo: trafico.semaforo === 0 ? 'Verde' : trafico.semaforo === 1 ? 'Rojo' : null,
    next_milestone: nextMilestone,
    recent_events: (events || []).map(e => ({
      workflow: e.workflow,
      event: e.event_type,
      status: e.status,
      at: e.created_at,
    })),
    pending_documents: (pendingDocs || []).map(d => ({
      type: d.doc_type,
      requested_at: d.solicitado_at,
    })),
  }
}

async function getSupplierScore({ supplier_name }) {
  // Try network-wide scores first (cross-client, anonymized, ranked)
  const { data: networkScores } = await supabase
    .from('supplier_network_scores')
    .select('supplier_name, clients_served, total_operations, avg_doc_turnaround_days, compliance_rate, tmec_qualification_rate, reliability_score, trend, rank_in_network, computed_at')
    .ilike('supplier_name', `%${supplier_name}%`)
    .order('rank_in_network', { ascending: true })
    .limit(5)

  if (networkScores && networkScores.length > 0) {
    return {
      results: networkScores.map(s => ({
        name: s.supplier_name,
        rank_in_network: s.rank_in_network,
        reliability_score: s.reliability_score,
        clients_served: s.clients_served,
        total_operations: s.total_operations,
        compliance_rate: s.compliance_rate,
        tmec_qualification_rate: s.tmec_qualification_rate,
        avg_doc_turnaround_days: s.avg_doc_turnaround_days,
        trend: s.trend,
        last_scored: s.computed_at,
      })),
      network: 'CRUZ Intelligence Network — Patente 3596',
      note: 'Network-wide scores aggregated across all CRUZ clients (anonymized). Rank 1 = most reliable supplier in network.',
    }
  }

  // Fallback to per-company supplier profiles
  const { data: profiles } = await supabase
    .from('supplier_profiles')
    .select('supplier_name, total_operations, total_value_usd, avg_crossing_hours, reliability_score, on_time_pct, avg_turnaround_days, primary_fracciones, primary_countries, trend, last_operation')
    .ilike('supplier_name', `%${supplier_name}%`)
    .limit(5)

  if (!profiles || profiles.length === 0) {
    return { error: `No supplier matching "${supplier_name}" found in CRUZ network` }
  }

  return {
    results: profiles.map(p => ({
      name: p.supplier_name,
      reliability_score: p.reliability_score,
      on_time_pct: p.on_time_pct,
      avg_crossing_hours: p.avg_crossing_hours,
      avg_turnaround_days: p.avg_turnaround_days,
      total_operations: p.total_operations,
      total_value_usd: p.total_value_usd,
      primary_products: p.primary_fracciones,
      countries: p.primary_countries,
      trend: p.trend,
      last_operation: p.last_operation,
    })),
    network: 'CRUZ Intelligence Network — Patente 3596',
    note: 'Scores aggregated across all CRUZ clients (anonymized). Higher reliability = fewer delays, fewer document issues.',
  }
}

// ── Tool definitions ──

const TOOLS = [
  {
    name: 'classify_product',
    description: 'Classify a product for Mexican customs. Returns fracción arancelaria (XXXX.XX.XX), IGI rate, and T-MEC eligibility. Uses 1,687 historical patterns + AI fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Product description (English or Spanish)' },
        origin_country: { type: 'string', description: 'ISO country code (US, CA, MX, CN, etc.)' },
      },
      required: ['description'],
    },
  },
  {
    name: 'estimate_landed_cost',
    description: 'Calculate total landed cost for importing goods to Mexico. Returns DTA + IGI + IVA breakdown in MXN and USD with current Banxico exchange rate.',
    inputSchema: {
      type: 'object',
      properties: {
        value_usd: { type: 'number', description: 'Commercial value in USD' },
        weight_kg: { type: 'number', description: 'Gross weight in kilograms' },
        fraccion: { type: 'string', description: 'Fracción arancelaria (XXXX.XX.XX). If omitted, uses default 5% IGI.' },
        origin_country: { type: 'string', description: 'ISO country code for T-MEC determination' },
        regimen: { type: 'string', description: 'Customs regime: A1 (definitive), ITE/ITR/IMD (T-MEC/IMMEX)' },
      },
      required: ['value_usd'],
    },
  },
  {
    name: 'predict_crossing_time',
    description: 'Predict border crossing time at Nuevo Laredo. Uses historical patterns from 16K+ crossings at Aduana 240.',
    inputSchema: {
      type: 'object',
      properties: {
        bridge: { type: 'string', description: 'Bridge name: World Trade, Colombia, Juárez-Lincoln, Gateway' },
        product_category: { type: 'string', description: 'Product category: plasticos, quimicos, metalicos, textiles, electronica, alimentos' },
        day_of_week: { type: 'number', description: '0=Sunday through 6=Saturday. Defaults to today.' },
      },
    },
  },
  {
    name: 'check_compliance',
    description: 'Check customs compliance status. Returns audit risk score, MVE status, and upcoming regulatory changes.',
    inputSchema: {
      type: 'object',
      properties: {
        rfc: { type: 'string', description: 'Mexican RFC (tax ID) of the importer' },
        fraccion: { type: 'string', description: 'Fracción arancelaria to check for regulatory alerts' },
        regimen: { type: 'string', description: 'Customs regime (A1, ITE, ITR, IMD)' },
      },
    },
  },
  {
    name: 'request_quote',
    description: 'Request a customs brokerage quote from Patente 3596. Includes classification, duties estimate, and timeline. Quote requires broker approval before becoming binding.',
    inputSchema: {
      type: 'object',
      properties: {
        product_description: { type: 'string', description: 'What is being imported' },
        origin_country: { type: 'string', description: 'Country of origin (ISO code)' },
        destination_city: { type: 'string', description: 'Destination city in Mexico' },
        value_usd: { type: 'number', description: 'Commercial value in USD' },
        weight_kg: { type: 'number', description: 'Gross weight in kilograms' },
      },
      required: ['product_description', 'value_usd'],
    },
  },
  {
    name: 'submit_shipment',
    description: 'Submit a shipment for customs clearance using an approved quote. Initiates the CRUZ workflow engine.',
    inputSchema: {
      type: 'object',
      properties: {
        quote_id: { type: 'string', description: 'Quote ID from request_quote' },
      },
      required: ['quote_id'],
    },
  },
  {
    name: 'get_shipment_status',
    description: 'Get real-time status of a shipment being cleared through Mexican customs by Patente 3596.',
    inputSchema: {
      type: 'object',
      properties: {
        tracking_id: { type: 'string', description: 'Tráfico number (e.g., 9254-Y4511)' },
      },
      required: ['tracking_id'],
    },
  },
  {
    name: 'get_supplier_score',
    description: 'Get reliability score and performance data for a Mexican supplier. Aggregated from CRUZ network intelligence across all clients (anonymized).',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_name: { type: 'string', description: 'Supplier name (partial match supported)' },
      },
      required: ['supplier_name'],
    },
  },
]

// ── Tool router ──

async function handleToolCall(name, args) {
  switch (name) {
    case 'classify_product': return classifyProduct(args)
    case 'estimate_landed_cost': return estimateLandedCost(args)
    case 'predict_crossing_time': return predictCrossingTime(args)
    case 'check_compliance': return checkCompliance(args)
    case 'request_quote': return requestQuote(args)
    case 'submit_shipment': return submitShipment(args)
    case 'get_shipment_status': return getShipmentStatus(args)
    case 'get_supplier_score': return getSupplierScore(args)
    default: return { error: `Unknown tool: ${name}` }
  }
}

// ── MCP Server ──

const server = new Server(
  { name: 'cruz', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    const result = await handleToolCall(name, args || {})

    // Log usage for billing
    supabase.from('audit_log').insert({
      action: 'mcp_tool_call',
      resource: 'mcp',
      resource_id: name,
      diff: { args: Object.keys(args || {}), success: !result.error },
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: !!result.error,
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      isError: true,
    }
  }
})

// ── Start ──

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('CRUZ MCP Server running — Patente 3596 · Aduana 240\n')
}

main().catch(err => {
  process.stderr.write(`CRUZ MCP fatal: ${err.message}\n`)
  process.exit(1)
})
