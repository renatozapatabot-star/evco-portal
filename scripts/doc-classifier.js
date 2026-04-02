#!/usr/bin/env node
/**
 * CRUZ Document Classifier
 * Uses Ollama qwen3:8b (free, local) + pdf-parse to classify Mexican customs PDFs.
 *
 * Usage: node scripts/doc-classifier.js /path/to/file1.pdf [/path/to/file2.pdf ...]
 *
 * Confidence thresholds:
 *   > 0.85  → auto-classify
 *   0.60–0.85 → classify + flag (needs_review: true)
 *   < 0.60  → type = 'OTRO', flag for manual review
 *
 * Logs every action to pipeline_log.
 * Inserts results into document_classifications.
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { PDFParse } = require('pdf-parse')

const SCRIPT_NAME = 'doc-classifier'
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const MODEL = 'qwen3:8b'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const VALID_TYPES = [
  'FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE',
  'CERTIFICADO_ORIGEN', 'CARTA_PORTE', 'MANIFESTACION_VALOR',
  'PEDIMENTO', 'NOM', 'COA', 'ORDEN_COMPRA', 'ENTRADA_BODEGA',
  'GUIA_EMBARQUE', 'PERMISO', 'PROFORMA', 'DODA_PREVIO', 'OTRO'
]

// ─── Helpers ────────────────────────────────────────────────

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function logPipeline(step, status, details, durationMs) {
  const entry = {
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(durationMs != null && { duration_ms: durationMs }),
    ...(status === 'error' && {
      error_message: typeof details === 'object' ? (details.error || JSON.stringify(details)) : details
    })
  }
  await supabase.from('pipeline_log').insert(entry).then(({ error }) => {
    if (error) console.error('pipeline_log insert error:', error.message)
  })
}

// ─── PDF Extraction ─────────────────────────────────────────

async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath)
  
  const result = await pdfParse(buffer)
  
  return result.text || ''
}

// ─── Ollama Classification ──────────────────────────────────

async function classifyWithOllama(text, filename) {
  // Truncate to first 500 chars — keeps prompt small enough for qwen3:8b
  const preview = text.substring(0, 800)

  const prompt = `Classify this Mexican customs/trade document. Reply with ONLY a JSON object, nothing else.

Types and what they are:
- FACTURA_COMERCIAL: commercial invoice (any invoice, proforma invoice with values, "INV", "invoice", "factura")
- LISTA_EMPAQUE: packing list (weights, pieces, boxes, "packing list", "lista de empaque")
- CONOCIMIENTO_EMBARQUE: bill of lading, airway bill, tracking doc ("BL", "AWB", "BOL", "guia de embarque")
- CERTIFICADO_ORIGEN: certificate of origin, USMCA, T-MEC ("certificate of origin", "certificado")
- CARTA_PORTE: Mexican transport document ("carta porte", "CFDI traslado")
- MANIFESTACION_VALOR: customs value declaration ("manifestacion de valor", "MV_", "MVE")
- PEDIMENTO: Mexican customs filing ("pedimento", 15-digit number with spaces)
- NOM: Mexican standards compliance ("NOM-", "norma oficial")
- COA: certificate of analysis (lab results, chemical composition, "certificate of analysis")
- ORDEN_COMPRA: purchase order ("PO", "purchase order", "orden de compra", "PO #")
- ENTRADA_BODEGA: warehouse receipt, receiving doc ("entrada de bodega", "warehouse receipt", "recibo de almacen")
- GUIA_EMBARQUE: shipping guide, carrier tracking ("guia", "tracking", "carrier receipt")
- PERMISO: import/export permit, health permit ("permiso", "COFEPRIS", "permiso de salud")
- PROFORMA: proforma invoice without final values ("proforma", "pro forma", "PI-")
- DODA_PREVIO: pre-clearance document ("DODA", "despacho previo")
- OTRO: use ONLY if the document truly does not match any type above

Reply format:
{"type": "TYPE_HERE", "supplier": "company name or null", "confidence": 0.0}

Document text:
${preview}`

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 200 },
      think: false
    }),
    signal: AbortSignal.timeout(120000)
  })

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)

  const data = await res.json()
  const raw = data.response || ''

  // Debug: log raw Ollama response before parsing
  console.log(`   [DEBUG] Raw Ollama response:\n   ${raw.substring(0, 500)}`)

  // Strip markdown fences (```json ... ``` or ``` ... ```) before extracting JSON
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')

  // Extract JSON from cleaned response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`No JSON found in Ollama response: ${raw.substring(0, 200)}`)

  const parsed = JSON.parse(jsonMatch[0])

  // Validate type
  if (!VALID_TYPES.includes(parsed.type)) {
    parsed.type = 'OTRO'
    parsed.confidence = Math.min(parsed.confidence || 0, 0.5)
  }

  // Clamp confidence
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0))

  return parsed
}

// ─── Process Single File ────────────────────────────────────

async function processFile(filePath) {
  const filename = path.basename(filePath)
  const startTime = Date.now()

  console.log(`\n📄 Processing: ${filename}`)

  // Step 1: Extract text
  let text
  try {
    text = await extractPdfText(filePath)
    console.log(`   Text extracted: ${text.length} chars`)
  } catch (err) {
    console.error(`   ❌ PDF extraction failed: ${err.message}`)
    await logPipeline('extract_pdf', 'error', { file: filename, error: err.message })
    return null
  }

  if (!text || text.trim().length < 10) {
    console.log('   ⚠️  No meaningful text extracted — classifying as OTRO')
    const result = {
      file_path: filePath,
      filename,
      type: 'OTRO',
      supplier: null,
      invoice_number: null,
      value_usd: null,
      confidence: 0,
      needs_review: true,
      model: MODEL,
      processing_ms: Date.now() - startTime,
      created_at: new Date().toISOString()
    }
    await insertClassification(result)
    await logPipeline('classify', 'success', { file: filename, type: 'OTRO', confidence: 0, reason: 'no_text' })
    return result
  }

  // Step 2: Classify with Ollama
  let classification
  try {
    classification = await classifyWithOllama(text, filename)
    console.log(`   🤖 Ollama: ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`)
  } catch (err) {
    console.error(`   ❌ Ollama classification failed: ${err.message}`)
    await logPipeline('classify_ollama', 'error', { file: filename, error: err.message })
    // Fallback to OTRO
    classification = { type: 'OTRO', supplier: null, invoice_number: null, value_usd: null, confidence: 0 }
  }

  // Step 3: Apply confidence thresholds
  let needsReview = false
  if (classification.confidence < 0.60) {
    classification.type = 'OTRO'
    needsReview = true
    console.log('   🔴 Low confidence — flagged as OTRO for manual review')
  } else if (classification.confidence < 0.85) {
    needsReview = true
    console.log('   🟡 Medium confidence — classified but flagged for review')
  } else {
    console.log('   🟢 High confidence — auto-classified')
  }

  const result = {
    file_path: filePath,
    filename,
    type: classification.type,
    supplier: classification.supplier || null,
    invoice_number: classification.invoice_number || null,
    value_usd: classification.value_usd || null,
    confidence: classification.confidence,
    needs_review: needsReview,
    model: MODEL,
    processing_ms: Date.now() - startTime,
    created_at: new Date().toISOString()
  }

  // Step 4: Insert into document_classifications
  await insertClassification(result)

  // Step 5: Log to pipeline_log
  await logPipeline('classify', 'success', {
    file: filename,
    type: result.type,
    confidence: result.confidence,
    needs_review: needsReview,
    supplier: result.supplier,
    ms: result.processing_ms
  })

  return result
}

async function insertClassification(result) {
  const { error } = await supabase.from('document_classifications').insert({
    filename: result.filename,
    doc_type: result.type,
    supplier: result.supplier,
    invoice_number: result.invoice_number,
    value_usd: result.value_usd,
    confidence: result.confidence
  })
  if (error) {
    console.error(`   ⚠️  DB insert error: ${error.message}`)
    await logPipeline('db_insert', 'error', { file: result.filename, error: error.message })
  }
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  const files = process.argv.slice(2)

  if (files.length === 0) {
    console.log('Usage: node scripts/doc-classifier.js /path/to/file1.pdf [file2.pdf ...]')
    process.exit(1)
  }

  console.log(`\n🤖 CRUZ Document Classifier`)
  console.log(`   Model: ${MODEL} via ${OLLAMA_URL}`)
  console.log(`   Files: ${files.length}`)
  console.log('═'.repeat(50))

  // Verify Ollama is reachable
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const hasModel = data.models?.some(m => m.name.includes('qwen3'))
    if (!hasModel) {
      console.error(`❌ Model ${MODEL} not found in Ollama. Run: ollama pull ${MODEL}`)
      await logPipeline('startup', 'error', { error: `Model ${MODEL} not available` })
      process.exit(1)
    }
    console.log(`✅ Ollama connected, ${MODEL} available`)
  } catch (err) {
    console.error(`❌ Ollama not reachable at ${OLLAMA_URL}: ${err.message}`)
    await logPipeline('startup', 'error', { error: `Ollama unreachable: ${err.message}` })
    await tg(`🔴 <b>${SCRIPT_NAME}</b> — Ollama not reachable: ${err.message}\n— CRUZ 🦀`)
    process.exit(1)
  }

  await logPipeline('startup', 'success', { files: files.length, model: MODEL })

  const results = []
  let errors = 0

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`\n❌ File not found: ${filePath}`)
      await logPipeline('file_check', 'error', { file: filePath, error: 'not found' })
      errors++
      continue
    }
    const result = await processFile(filePath)
    if (result) {
      results.push(result)
    } else {
      errors++
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50))
  console.log('📊 SUMMARY')
  console.log(`   Processed: ${results.length}/${files.length}`)
  console.log(`   Errors: ${errors}`)

  const autoClassified = results.filter(r => !r.needs_review).length
  const flagged = results.filter(r => r.needs_review).length
  console.log(`   Auto-classified: ${autoClassified}`)
  console.log(`   Flagged for review: ${flagged}`)

  const byType = {}
  for (const r of results) {
    byType[r.type] = (byType[r.type] || 0) + 1
  }
  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type}: ${count}`)
  }

  await logPipeline('complete', errors > 0 ? 'partial' : 'success', {
    total: files.length,
    classified: results.length,
    errors,
    auto_classified: autoClassified,
    flagged,
    by_type: byType
  })

  if (errors > 0) {
    await tg(`🟡 <b>${SCRIPT_NAME}</b> — ${results.length}/${files.length} classified, ${errors} errors\n— CRUZ 🦀`)
  }
}

// Export for direct require() from other scripts (e.g. email-intake.js)
module.exports = { classifyDocument: processFile }

// CLI entrypoint — only runs when invoked directly
if (require.main === module) {
  run().catch(async (err) => {
    console.error('Fatal error:', err)
    await logPipeline('fatal', 'error', { error: err.message })
    await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— CRUZ 🦀`)
    process.exit(1)
  })
}
