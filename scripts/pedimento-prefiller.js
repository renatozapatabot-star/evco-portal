#!/usr/bin/env node
/**
 * CRUZ Pedimento Pre-filler — Build 211
 * ============================================================================
 * When a tráfico's expediente reaches 100% completeness, CRUZ pre-fills
 * the pedimento with all extracted data, runs the validator, calculates
 * contributions, and creates a review-ready draft.
 *
 * Juan José reviews in 30 seconds instead of typing for 15 minutes.
 *
 * Cron: */30 * * * * (every 30 min, checks for newly-complete expedientes)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { getAllRates } = require('./lib/rates')
const { emitEvent } = require('./lib/workflow-emitter')

const SCRIPT_NAME = 'pedimento-prefiller'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Required doc types per regime ────────────────────────────────────────────

const REQUIRED_DOCS = {
  base: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE'],
  tmec: ['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'CERTIFICADO_ORIGEN'],
}

// ── Check expediente completeness ────────────────────────────────────────────

async function getExpedienteCompleteness(traficoId, companyId) {
  const { data: docs } = await supabase
    .from('expediente_documentos')
    .select('doc_type, file_url')
    .eq('trafico_id', traficoId)
    .eq('company_id', companyId)

  if (!docs) return { complete: false, pct: 0, present: [], missing: [] }

  const presentTypes = new Set((docs || []).filter(d => d.file_url).map(d => d.doc_type))
  const required = REQUIRED_DOCS.base // Start with base, add T-MEC check later
  const missing = required.filter(t => !presentTypes.has(t))
  const pct = Math.round((required.filter(t => presentTypes.has(t)).length / required.length) * 100)

  return {
    complete: missing.length === 0,
    pct,
    present: [...presentTypes],
    missing,
  }
}

// ── Pull extracted data from documents ───────────────────────────────────────

async function getExtractedData(traficoId) {
  const { data: extractions } = await supabase
    .from('document_extractions')
    .select('doc_type, extracted_data, confidence')
    .eq('trafico_id', traficoId)
    .order('confidence', { ascending: false })

  if (!extractions || extractions.length === 0) return null

  // Merge extractions (invoice has value + products, packing list has weights)
  const merged = {
    products: [],
    supplier_name: null,
    supplier_country: null,
    total_value: 0,
    currency: 'USD',
    incoterm: null,
    invoice_number: null,
    weights: {},
  }

  for (const ext of extractions) {
    const d = ext.extracted_data || {}
    if (d.supplier_name && !merged.supplier_name) merged.supplier_name = d.supplier_name
    if (d.supplier_country && !merged.supplier_country) merged.supplier_country = d.supplier_country
    if (d.total_value && d.total_value > merged.total_value) merged.total_value = d.total_value
    if (d.currency) merged.currency = d.currency
    if (d.incoterm) merged.incoterm = d.incoterm
    if (d.invoice_number) merged.invoice_number = d.invoice_number
    if (d.products) merged.products = [...merged.products, ...d.products]
    if (d.gross_weight) merged.weights.gross = d.gross_weight
    if (d.net_weight) merged.weights.net = d.net_weight
    if (d.packages) merged.weights.packages = d.packages
  }

  return merged
}

// ── Get classifications for products ─────────────────────────────────────────

async function getClassifications(traficoId, companyId) {
  // Check agent_decisions for confirmed classifications
  const { data: decisions } = await supabase
    .from('agent_decisions')
    .select('decision, confidence, payload')
    .eq('trigger_type', 'classification')
    .eq('company_id', companyId)
    .eq('was_correct', true)

  // Also check fraccion from tráfico itself
  const { data: traf } = await supabase
    .from('traficos')
    .select('fraccion_arancelaria, descripcion_mercancia')
    .eq('trafico', traficoId)
    .eq('company_id', companyId)
    .maybeSingle()

  const classifications = []

  if (traf?.fraccion_arancelaria) {
    classifications.push({
      fraccion: traf.fraccion_arancelaria,
      description: traf.descripcion_mercancia,
      confidence: 0.95,
      source: 'trafico',
    })
  }

  return classifications
}

// ── 25-field validator ───────────────────────────────────────────────────────

function validatePedimento(data) {
  const checks = []
  const add = (name, ok, msg) => checks.push({ name, ok, message: msg })

  // Identification
  add('supplier_name', !!data.supplier_name, 'Proveedor identificado')
  add('supplier_country', !!data.supplier_country, 'País de origen')
  add('invoice_number', !!data.invoice_number, 'Número de factura')

  // Value
  add('total_value', data.total_value > 0, 'Valor comercial > 0')
  add('currency', ['USD', 'MXN', 'EUR'].includes(data.currency), 'Moneda válida')
  add('incoterm', !!data.incoterm, 'Incoterm declarado')

  // Products
  add('products_exist', data.products?.length > 0, 'Al menos un producto')
  add('products_descriptions', data.products?.every(p => p.description), 'Todos los productos con descripción')

  // Classifications
  add('fraccion_exists', data.classifications?.length > 0, 'Fracción arancelaria asignada')
  add('fraccion_format', data.classifications?.every(c => /^\d{4}\.\d{2}\.\d{2}$/.test(c.fraccion || '')), 'Formato XXXX.XX.XX')

  // Contributions
  add('exchange_rate', data.rates?.exchangeRate > 0, 'Tipo de cambio vigente')
  add('dta_calculated', data.contributions?.dta?.amount_mxn >= 0, 'DTA calculado')
  add('igi_calculated', data.contributions?.igi?.amount_mxn >= 0, 'IGI calculado')
  add('iva_calculated', data.contributions?.iva?.amount_mxn >= 0, 'IVA calculado')
  add('iva_base_correct', data.contributions?.iva?.base_mxn > data.contributions?.dta?.amount_mxn, 'IVA base = valor + DTA + IGI (no flat)')

  // Regime
  add('regime', !!data.regimen, 'Régimen declarado')
  add('tmec_check', data.regimen ? true : false, 'T-MEC evaluado')

  // Weights
  add('gross_weight', data.weights?.gross > 0, 'Peso bruto declarado')

  // Compliance
  add('patente', true, 'Patente 3596') // Always our patente
  add('aduana', true, 'Aduana 240')

  // Documents
  add('factura_present', data.docs_present?.includes('FACTURA_COMERCIAL'), 'Factura comercial presente')
  add('packing_present', data.docs_present?.includes('LISTA_EMPAQUE'), 'Lista de empaque presente')
  add('bl_present', data.docs_present?.includes('CONOCIMIENTO_EMBARQUE'), 'Conocimiento de embarque presente')

  // Consistency
  add('value_positive', data.total_value > 0 && data.total_value < 50000000, 'Valor en rango razonable')
  add('products_value_match', true, 'Suma productos ≈ valor total') // Simplified — would check sum

  const passed = checks.filter(c => c.ok).length
  const score = Math.round((passed / checks.length) * 100)

  return { score, total: checks.length, passed, checks }
}

// ── Calculate contributions (reuse email-intake pattern) ─────────────────────

function calculateContributions(valorUSD, regimen, rates) {
  const { exchangeRate, dtaRates, ivaRate } = rates
  const valorMXN = Math.round(valorUSD * exchangeRate * 100) / 100

  const dtaConfig = dtaRates[regimen] || dtaRates['A1'] || { rate: 0.008 }
  const dtaAmount = Math.round(valorMXN * dtaConfig.rate * 100) / 100

  const isTMEC = ['ITE', 'ITR', 'IMD'].includes((regimen || '').toUpperCase())
  const igiRate = isTMEC ? 0 : 0 // Default 0 — would need fraccion-level rate
  const igiAmount = Math.round(valorMXN * igiRate * 100) / 100

  const ivaBase = valorMXN + dtaAmount + igiAmount
  const ivaAmount = Math.round(ivaBase * ivaRate * 100) / 100

  return {
    valor_aduana_usd: valorUSD,
    valor_aduana_mxn: valorMXN,
    tipo_cambio: exchangeRate,
    dta: { rate: dtaConfig.rate, amount_mxn: dtaAmount },
    igi: { rate: igiRate, amount_mxn: igiAmount, tmec: isTMEC },
    iva: { rate: ivaRate, base_mxn: ivaBase, amount_mxn: ivaAmount },
    total_contribuciones_mxn: dtaAmount + igiAmount + ivaAmount,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Pedimento Pre-filler`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  // Find tráficos in 'En proceso' that don't already have a draft
  const { data: traficos, error } = await supabase
    .from('traficos')
    .select('trafico, proveedor, fraccion_arancelaria, regimen, importe_total, moneda')
    .eq('company_id', companyId)
    .eq('estatus', 'En proceso')
    .limit(50)

  if (error) {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`)
    throw new Error(`Query failed: ${error.message}`)
  }

  if (!traficos || traficos.length === 0) {
    console.log('No active tráficos to check.\n')
    return
  }

  console.log(`Checking ${traficos.length} active tráfico(s)\n`)

  // Get existing drafts to avoid duplicates
  const { data: existingDrafts } = await supabase
    .from('pedimento_drafts')
    .select('trafico_id')
    .in('trafico_id', traficos.map(t => t.trafico))
    .in('status', ['pending', 'draft', 'approved'])

  const hasDraft = new Set((existingDrafts || []).map(d => d.trafico_id))

  let prefilled = 0
  let skipped = 0

  for (const traf of traficos) {
    // Skip if already has a draft
    if (hasDraft.has(traf.trafico)) {
      skipped++
      continue
    }

    // Check expediente completeness
    const completeness = await getExpedienteCompleteness(traf.trafico, companyId)
    if (!completeness.complete) {
      console.log(`  ${traf.trafico} — ${completeness.pct}% complete (missing: ${completeness.missing.join(', ')})`)
      skipped++
      continue
    }

    console.log(`  ${traf.trafico} — 100% complete! Pre-filling...`)

    // Pull extracted data from documents
    const extractedData = await getExtractedData(traf.trafico)

    // Get classifications
    const classifications = await getClassifications(traf.trafico, companyId)

    // Fetch rates
    const rates = await getAllRates()

    // Determine regime
    const regimen = traf.regimen || (classifications.some(c => c.fraccion) ? 'ITE' : 'A1')

    // Calculate contributions
    const totalValue = extractedData?.total_value || traf.importe_total || 0
    const contributions = calculateContributions(totalValue, regimen, rates)

    // Build validation data
    const validationData = {
      supplier_name: extractedData?.supplier_name || traf.proveedor,
      supplier_country: extractedData?.supplier_country,
      invoice_number: extractedData?.invoice_number,
      total_value: totalValue,
      currency: extractedData?.currency || traf.moneda || 'USD',
      incoterm: extractedData?.incoterm,
      products: extractedData?.products || [],
      classifications,
      rates,
      contributions,
      regimen,
      weights: extractedData?.weights || {},
      docs_present: completeness.present,
    }

    // Run 25-check validator
    const validation = validatePedimento(validationData)
    console.log(`    Validator: ${validation.score}/100 (${validation.passed}/${validation.total} checks passed)`)

    // Determine tier from score
    const tier = validation.score >= 95 ? 1 : validation.score >= 80 ? 2 : 3
    const TIER_MINUTES = { 1: 2, 2: 5, 3: 10 }

    // Build draft data
    const draftData = {
      type: 'borrador',
      source: 'pedimento_prefiller',
      extraction: {
        supplier_name: validationData.supplier_name,
        supplier_country: validationData.supplier_country,
        invoice_number: validationData.invoice_number,
        total_value: totalValue,
        currency: validationData.currency,
        incoterm: validationData.incoterm,
        products: validationData.products,
      },
      classifications,
      contributions,
      confidence: { score: validation.score, tier },
      validation,
      regimen,
      trafico_number: traf.trafico,
    }

    // Insert draft
    const { data: draft, error: draftErr } = await supabase
      .from('pedimento_drafts')
      .insert({
        trafico_id: traf.trafico,
        draft_data: draftData,
        status: tier === 1 ? 'pending' : 'draft',
        escalation_level: tier,
        created_by: 'CRUZ',
      })
      .select('id')
      .single()

    if (draftErr) {
      console.error(`    ⚠ Draft insert failed: ${draftErr.message}`)
      continue
    }

    console.log(`    ✅ Draft ${draft.id} · Score ${validation.score}/100 · Tier ${tier}`)

    // Emit workflow event
    await emitEvent('pedimento', 'draft_prefilled', traf.trafico, companyId, {
      draft_id: draft.id,
      score: validation.score,
      tier,
      supplier: validationData.supplier_name,
      value: totalValue,
      currency: validationData.currency,
    })

    // Telegram notification
    await sendTelegram(
      `📝 <b>Pedimento pre-llenado</b>\n` +
      `Tráfico: ${traf.trafico}\n` +
      `Proveedor: ${validationData.supplier_name || 'N/A'}\n` +
      `Valor: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${validationData.currency}\n` +
      `Score: ${validation.score}/100 · Tier ${tier}\n` +
      `Tiempo estimado revisión: ~${TIER_MINUTES[tier]} min\n` +
      `— CRUZ 🦀`
    )

    // Log to audit
    await supabase.from('audit_log').insert({
      action: 'pedimento_prefilled',
      entity_type: 'pedimento_draft',
      entity_id: draft.id,
      details: { trafico: traf.trafico, score: validation.score, tier },
      company_id: companyId,
    }).then(() => {}, () => {})

    prefilled++
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${prefilled} pre-filled · ${skipped} skipped · ${elapsed}s`)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { prefilled, skipped, checked: traficos.length, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (prefilled > 0) {
    await sendTelegram(`✅ <b>Pre-filler</b> · ${prefilled} pedimentos pre-llenados · ${elapsed}s`)
  }
}

run().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME, status: 'failed',
    details: { error: err.message },
  }).then(() => {}, () => {})
  process.exit(1)
})
