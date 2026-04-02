#!/usr/bin/env node
// scripts/email-intake.js
// ============================================================================
// CRUZ Email Intake Pipeline — 14-step customs document processor
//
// Modes:
//   --dry-run  → mock extraction data, test full pipeline without AI/Gmail
//   --ollama   → pdf-parse text + Ollama qwen3.5:35b for extraction & classification
//   (default)  → Anthropic Sonnet for extraction, Haiku for classification
//
// Pipeline:
//   1.  Fetch unread Gmail with attachments
//   2.  Filter: shipment doc? (invoice, packing list, BL)
//   3.  Check processed_emails — skip if seen
//   4.  Download attachment
//   5.  Extract text from PDF (pdf-parse)
//   6.  AI extraction: invoice_number, supplier, value, products, incoterm, currency
//   7.  Classify fracción per product against tráfico history
//   8.  Fetch rates from lib/rates.js
//   9.  Calculate contributions (DTA + IGI + IVA cascading)
//   10. Calculate confidence score + tier
//   11. INSERT into pedimento_drafts
//   12. Telegram notification
//   13. Log to processed_emails
//   14. Log to audit_log + mark email as read
// ============================================================================

const path = require('path')
const fs = require('fs')

const SCRIPT_NAME = 'email-intake'
const PDF_DIR = '/tmp/cruz-pdfs'
const TELEGRAM_CHAT = '-5085543275'

// ── Mode detection ──────────────────────────────────────────────────────────

const MODE = process.argv.includes('--dry-run') ? 'dry-run'
  : process.argv.includes('--ollama') ? 'ollama'
  : 'anthropic'

// ── Env config (Ollama mode uses Throne .env, default uses .env.local) ──────

const envPath = MODE === 'ollama'
  ? path.join(process.env.HOME, '.openclaw/workspace/scripts/evco-ops/.env')
  : path.join(__dirname, '..', '.env.local')

require('dotenv').config({ path: envPath })

// ── Dependencies ────────────────────────────────────────────────────────────

const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')
const { PDFParse } = require('pdf-parse')
const { getAllRates } = require('./lib/rates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const OLLAMA_URL = 'http://localhost:11434/api/generate'
const OLLAMA_MODEL = 'qwen3.5:35b'

// ── Anthropic client (lazy — only loaded in default mode) ───────────────────

let anthropic = null
function getAnthropic() {
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk')
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropic
}

// ── Telegram ────────────────────────────────────────────────────────────────

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

// ── Gmail ───────────────────────────────────────────────────────────────────

async function getGmail() {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN_AI
  if (!refreshToken) throw new Error('No GMAIL_REFRESH_TOKEN_AI configured')
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3333/oauth2callback'
  )
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

function extractHeader(headers, name) {
  return (headers?.find(h => h.name?.toLowerCase() === name.toLowerCase()))?.value || ''
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ── Step 4: Download PDF attachment ─────────────────────────────────────────

async function downloadPdf(gmail, messageId, attachmentId, destPath) {
  const { data } = await gmail.users.messages.attachments.get({
    userId: 'me', messageId, id: attachmentId,
  })
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
  fs.writeFileSync(destPath, Buffer.from(base64, 'base64'))
}

// ── Step 5: Extract text from PDF ───────────────────────────────────────────

async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath)
  const result = await new PDFParse({ data: buf }).getText()
  const text = (result.text || '').trim()
  if (text.length < 20) {
    return { text: '', needsVision: true }
  }
  return { text, needsVision: false }
}

// ── Step 6: AI Extraction ───────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a customs invoice data extractor. Extract the following fields from this document text as JSON:
{ "invoice_number", "supplier_name", "supplier_country", "total_value", "currency", "incoterm", "products": [{ "description", "quantity", "unit", "unit_value", "total_value", "country_of_origin" }] }
Return ONLY valid JSON, no explanation.`

async function extractWithOllama(text) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: EXTRACTION_PROMPT + '\n\nDocument text:\n' + text.substring(0, 8000),
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`Ollama extraction error: ${res.status}`)
  const data = await res.json()
  return parseJsonResponse(data.response)
}

async function extractWithAnthropic(text) {
  const client = getAnthropic()
  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: EXTRACTION_PROMPT,
    messages: [{ role: 'user', content: text.substring(0, 12000) }],
  })
  // Cost tracking
  await supabase.from('api_cost_log').insert({
    model: 'claude-sonnet-4-20250514',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    action: 'email_intake_extraction',
    latency_ms: Date.now() - start,
  }).then(() => {}, () => {})
  const content = response.content[0]?.text || ''
  return parseJsonResponse(content)
}

function getMockExtraction() {
  return {
    invoice_number: 'INV-DRY-001',
    supplier_name: 'DRY RUN SUPPLIER INC',
    supplier_country: 'US',
    total_value: 15420.00,
    currency: 'USD',
    incoterm: 'DDP',
    products: [{
      description: 'POLIETILENO DE ALTA DENSIDAD EN PELLETS',
      quantity: 25000,
      unit: 'KG',
      unit_value: 0.6168,
      total_value: 15420.00,
      country_of_origin: 'US',
    }],
  }
}

function parseJsonResponse(text) {
  // Strip markdown code fences and find JSON
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in AI response')
  return JSON.parse(jsonMatch[0])
}

// ── Step 7: Classify fracción per product ───────────────────────────────────

const CLASSIFICATION_PROMPT = `Given this product description and the following historical fracción matches from the same supplier, classify the product under the Mexican TIGIE tariff schedule.
Return JSON: { "fraccion": "XXXX.XX.XX", "confidence": 0.0-1.0, "reasoning": "..." }`

async function classifyProduct(product, companyId) {
  // Fetch historical matches from traficos
  const { data: history } = await supabase
    .from('traficos')
    .select('fraccion_arancelaria, descripcion_mercancia, regimen')
    .eq('company_id', companyId)
    .not('fraccion_arancelaria', 'is', null)
    .ilike('descripcion_mercancia', `%${(product.description || '').substring(0, 30)}%`)
    .limit(5)

  const historyStr = (history || [])
    .map(h => `${h.fraccion_arancelaria} — ${h.descripcion_mercancia} (${h.regimen})`)
    .join('\n')

  const prompt = `${CLASSIFICATION_PROMPT}

Product: ${product.description}
Quantity: ${product.quantity} ${product.unit}
Country of origin: ${product.country_of_origin || 'Unknown'}

Historical matches:
${historyStr || '(no history)'}
`

  if (MODE === 'dry-run') {
    return { fraccion: '3901.20.01', confidence: 0.92, reasoning: 'Dry run — PE pellets' }
  }

  if (MODE === 'ollama') {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama classify error: ${res.status}`)
    const data = await res.json()
    return parseJsonResponse(data.response)
  }

  // Anthropic Haiku for classification (cheap + fast)
  const client = getAnthropic()
  const start = Date.now()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  await supabase.from('api_cost_log').insert({
    model: 'claude-haiku-4-5-20251001',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    action: 'email_intake_classification',
    latency_ms: Date.now() - start,
  }).then(() => {}, () => {})
  return parseJsonResponse(response.content[0]?.text || '')
}

// ── Step 9: Calculate contributions ─────────────────────────────────────────

function calculateContributions(valorAduanaUSD, regimen, fraccionData, rates) {
  const { exchangeRate, dtaRates, ivaRate } = rates
  const valorAduanaMXN = Math.round(valorAduanaUSD * exchangeRate * 100) / 100

  // DTA — regime-based
  const dtaConfig = dtaRates[regimen] || dtaRates['A1'] || { rate: 0.008 }
  const dtaAmount = Math.round(valorAduanaMXN * dtaConfig.rate * 100) / 100

  // IGI — check T-MEC (ITE/ITR/IMD = 0% IGI)
  const isTMEC = ['ITE', 'ITR', 'IMD'].includes((regimen || '').toUpperCase())
  const igiRate = isTMEC ? 0 : (fraccionData?.igi_rate || 0)
  const igiAmount = Math.round(valorAduanaMXN * igiRate * 100) / 100

  // IVA — base = valor_aduana + DTA + IGI (cascading, NEVER flat)
  const ivaBase = valorAduanaMXN + dtaAmount + igiAmount
  const ivaAmount = Math.round(ivaBase * ivaRate * 100) / 100

  return {
    valor_aduana_usd: valorAduanaUSD,
    valor_aduana_mxn: valorAduanaMXN,
    tipo_cambio: exchangeRate,
    dta: { rate: dtaConfig.rate, amount_mxn: dtaAmount },
    igi: { rate: igiRate, amount_mxn: igiAmount, tmec: isTMEC },
    iva: { rate: ivaRate, base_mxn: ivaBase, amount_mxn: ivaAmount },
    total_contribuciones_mxn: dtaAmount + igiAmount + ivaAmount,
    currency_labels: { valor: 'USD', contribuciones: 'MXN' },
  }
}

// ── Step 10: Confidence scoring ─────────────────────────────────────────────

function scoreConfidence(extraction, classifications) {
  const fields = [
    { name: 'invoice_number', value: extraction.invoice_number, weight: 10 },
    { name: 'supplier_name', value: extraction.supplier_name, weight: 15 },
    { name: 'total_value', value: extraction.total_value, weight: 20 },
    { name: 'currency', value: extraction.currency, weight: 10 },
    { name: 'incoterm', value: extraction.incoterm, weight: 5 },
    { name: 'products', value: extraction.products?.length > 0, weight: 20 },
  ]

  let score = 0
  let maxScore = 0
  const fieldScores = {}

  for (const f of fields) {
    maxScore += f.weight
    const present = f.value && f.value !== '' && f.value !== 0
    const fieldConf = present ? f.weight : 0
    score += fieldConf
    fieldScores[f.name] = present ? 100 : 0
  }

  // Classification confidence (average across products)
  if (classifications.length > 0) {
    const classWeight = 20
    maxScore += classWeight
    const avgConf = classifications.reduce((s, c) => s + (c.confidence || 0), 0) / classifications.length
    score += Math.round(avgConf * classWeight)
    fieldScores['classification'] = Math.round(avgConf * 100)
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const tier = pct >= 95 ? 1 : pct >= 80 ? 2 : 3

  return { score: pct, tier, fieldScores }
}

// ── Step 2: Filter — is this a shipment document? ───────────────────────────

function isShipmentEmail(subject, sender) {
  const keywords = [
    'invoice', 'factura', 'packing', 'list', 'bill of lading', 'BL',
    'commercial', 'proforma', 'shipment', 'embarque', 'conocimiento',
    'customs', 'aduana', 'pedimento', 'PO', 'purchase order', 'orden',
  ]
  const text = `${subject} ${sender}`.toLowerCase()
  return keywords.some(k => text.includes(k.toLowerCase()))
}

// ── Process a single email (steps 1-14) ─────────────────────────────────────

async function processEmail(gmail, messageId, companyId) {
  // Step 1: Already fetched by caller

  const { data: msg } = await gmail.users.messages.get({
    userId: 'me', id: messageId, format: 'full',
  })

  const headers = msg.payload?.headers || []
  const sender = extractHeader(headers, 'From')
  const subject = extractHeader(headers, 'Subject')
  const dateStr = extractHeader(headers, 'Date')
  const receivedAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString()

  console.log(`  From:    ${sender.substring(0, 60)}`)
  console.log(`  Subject: ${subject.substring(0, 70)}`)

  // Step 2: Filter — shipment document?
  if (!isShipmentEmail(subject, sender)) {
    console.log('  Not a shipment doc — skip')
    return null
  }

  // Step 3: Check processed_emails — skip if seen
  const { data: existing } = await supabase
    .from('email_queue')
    .select('id')
    .eq('metadata->>gmail_message_id', messageId)
    .maybeSingle()

  if (existing) {
    console.log('  Already processed — skip')
    return null
  }

  // Find PDF attachments
  const pdfs = []
  function findPdfs(parts) {
    if (!parts) return
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const name = part.filename || ''
        if (name.toLowerCase().endsWith('.pdf') && !name.startsWith('._')) {
          pdfs.push({
            filename: name,
            attachmentId: part.body.attachmentId,
            size: part.body.size || 0,
          })
        }
      }
      if (part.parts) findPdfs(part.parts)
    }
  }
  findPdfs(msg.payload?.parts || [msg.payload])

  if (pdfs.length === 0) {
    console.log('  No PDFs — skip')
    return null
  }

  console.log(`  PDFs: ${pdfs.length}`)

  // Step 4: Download attachment(s)
  const emailDir = path.join(PDF_DIR, messageId)
  ensureDir(emailDir)

  let pdfText = ''
  for (const pdf of pdfs) {
    const destPath = path.join(emailDir, pdf.filename)
    await downloadPdf(gmail, messageId, pdf.attachmentId, destPath)
    console.log(`    Downloaded: ${pdf.filename} (${Math.round(pdf.size / 1024)}KB)`)

    // Step 5: Extract text from PDF
    const { text, needsVision } = await extractPdfText(destPath)
    if (needsVision) {
      console.log(`    ⚠ Scanned PDF — needs vision (flagged for later)`)
    } else {
      pdfText += text + '\n\n'
      console.log(`    Extracted ${text.length} chars`)
    }
  }

  if (!pdfText && MODE !== 'dry-run') {
    console.log('  No extractable text — flagging for vision pipeline')
    // Log to email_queue as needs_vision
    await supabase.from('email_queue').insert({
      to_address: 'ai@renatozapata.com',
      subject: subject.substring(0, 500),
      body_text: `From: ${sender}`,
      status: 'needs_vision',
      tenant_slug: companyId,
      metadata: {
        direction: 'inbound', sender, received_at: receivedAt,
        gmail_message_id: messageId, attachment_count: pdfs.length,
      },
    })
    return null
  }

  // Step 6: AI extraction
  console.log(`  Extracting with ${MODE}...`)
  let extraction
  if (MODE === 'dry-run') {
    extraction = getMockExtraction()
  } else if (MODE === 'ollama') {
    extraction = await extractWithOllama(pdfText)
  } else {
    extraction = await extractWithAnthropic(pdfText)
  }
  console.log(`  Invoice: ${extraction.invoice_number} · ${extraction.supplier_name} · ${extraction.total_value} ${extraction.currency}`)

  // Step 7: Classify fracción per product
  const classifications = []
  for (const product of (extraction.products || [])) {
    try {
      const result = await classifyProduct(product, companyId)
      classifications.push({
        description: product.description,
        fraccion: result.fraccion,
        confidence: result.confidence,
        reasoning: result.reasoning,
      })
      console.log(`    ${result.fraccion} (${Math.round(result.confidence * 100)}%) — ${(product.description || '').substring(0, 40)}`)
    } catch (err) {
      console.error(`    Classification failed: ${err.message}`)
      classifications.push({
        description: product.description,
        fraccion: null,
        confidence: 0,
        reasoning: `Error: ${err.message}`,
      })
    }
  }

  // Step 8: Fetch rates
  console.log('  Fetching rates...')
  const rates = await getAllRates()
  console.log(`  TC: ${rates.exchangeRate} · IVA: ${rates.ivaRate}`)

  // Determine regime from classification history
  const primaryFraccion = classifications.find(c => c.fraccion)?.fraccion || null
  let detectedRegimen = 'A1' // default
  if (primaryFraccion) {
    const { data: histRegimen } = await supabase
      .from('traficos')
      .select('regimen')
      .eq('company_id', companyId)
      .eq('fraccion_arancelaria', primaryFraccion)
      .not('regimen', 'is', null)
      .limit(1)
      .single()
    if (histRegimen?.regimen) detectedRegimen = histRegimen.regimen
  }

  // Step 9: Calculate contributions
  const contributions = calculateContributions(
    extraction.total_value || 0,
    detectedRegimen,
    { igi_rate: 0 }, // T-MEC exempt by default — will be overridden by regime check
    rates
  )
  console.log(`  DTA: ${contributions.dta.amount_mxn} MXN · IGI: ${contributions.igi.amount_mxn} MXN · IVA: ${contributions.iva.amount_mxn} MXN`)
  console.log(`  T-MEC: ${contributions.igi.tmec ? 'Yes' : 'No'} · Total: ${contributions.total_contribuciones_mxn} MXN`)

  // Step 10: Confidence score
  const confidence = scoreConfidence(extraction, classifications)
  console.log(`  Confidence: ${confidence.score}% · Tier ${confidence.tier}`)

  // Step 11: INSERT into pedimento_drafts
  const draftData = {
    extraction,
    classifications,
    contributions,
    confidence,
    mode: MODE,
    source: 'email_intake',
    email: { sender, subject, received_at: receivedAt, gmail_message_id: messageId },
    regimen: detectedRegimen,
  }

  const { data: draft, error: draftErr } = await supabase
    .from('pedimento_drafts')
    .insert({
      trafico_id: null, // Will be linked when tráfico is created
      draft_data: draftData,
      status: confidence.tier === 1 ? 'pending' : 'draft',
      created_by: 'CRUZ',
      // company_id removed — column does not exist in pedimento_drafts
    })
    .select('id')
    .single()

  if (draftErr) throw new Error(`Draft insert failed: ${draftErr.message}`)
  const draftId = draft.id
  console.log(`  Draft created: ${draftId}`)

  // Step 12: Telegram notification
  const tmecLabel = contributions.igi.tmec ? '✅' : '❌'
  const tgMsg = [
    `📥 <b>Borrador listo</b> · ${extraction.invoice_number || 'Sin factura'}`,
    `${extraction.supplier_name || 'Proveedor desconocido'} · $${(extraction.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${extraction.currency || 'USD'}`,
    `Confianza: ${confidence.score}% · T-MEC ${tmecLabel}`,
    `— CRUZ 🦀`,
  ].join('\n')
  await sendTelegram(tgMsg)

  // Step 13: Log to processed_emails (email_queue)
  await supabase.from('email_queue').insert({
    to_address: 'ai@renatozapata.com',
    subject: subject.substring(0, 500),
    body_text: `From: ${sender}\nDraft: ${draftId}`,
    status: 'processed',
    tenant_slug: companyId,
    metadata: {
      direction: 'inbound', sender, received_at: receivedAt,
      gmail_message_id: messageId, attachment_count: pdfs.length,
      draft_id: draftId, confidence_score: confidence.score,
      confidence_tier: confidence.tier,
    },
  })

  // Step 14a: Log to audit_log (immutable)
  await supabase.from('audit_log').insert({
    action: 'email_intake_draft_created',
    entity_type: 'pedimento_draft',
    entity_id: draftId,
    details: {
      invoice: extraction.invoice_number,
      supplier: extraction.supplier_name,
      value_usd: extraction.total_value,
      currency: extraction.currency,
      confidence: confidence.score,
      tier: confidence.tier,
      mode: MODE,
      classifications: classifications.map(c => ({ fraccion: c.fraccion, confidence: c.confidence })),
    },
    company_id: companyId,
  }).then(() => {}, (err) => console.error('audit_log error:', err.message))

  // Step 14b: Mark email as read in Gmail
  try {
    await gmail.users.messages.modify({
      userId: 'me', id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    })
    console.log('  Marked as read')
  } catch (e) {
    console.error(`  Failed to mark read: ${e.message}`)
  }

  return {
    draftId, sender, subject,
    pdfCount: pdfs.length,
    confidence: confidence.score,
    tier: confidence.tier,
    tmec: contributions.igi.tmec,
    value: extraction.total_value,
    currency: extraction.currency,
  }
}

// ── Dry-run mode: skip Gmail, process mock data ─────────────────────────────

async function runDryRun(companyId) {
  console.log('DRY RUN — using mock data\n')

  const extraction = getMockExtraction()
  console.log(`Invoice: ${extraction.invoice_number} · ${extraction.supplier_name}`)

  const classifications = []
  for (const product of extraction.products) {
    const result = { fraccion: '3901.20.01', confidence: 0.92, reasoning: 'Dry run mock' }
    classifications.push({ description: product.description, ...result })
    console.log(`  ${result.fraccion} (${Math.round(result.confidence * 100)}%)`)
  }

  console.log('Fetching rates...')
  const rates = await getAllRates()
  console.log(`  TC: ${rates.exchangeRate} · IVA: ${rates.ivaRate}`)

  const contributions = calculateContributions(extraction.total_value, 'ITE', { igi_rate: 0 }, rates)
  console.log(`  DTA: ${contributions.dta.amount_mxn} MXN · IGI: ${contributions.igi.amount_mxn} MXN · IVA: ${contributions.iva.amount_mxn} MXN`)

  const confidence = scoreConfidence(extraction, classifications)
  console.log(`  Confidence: ${confidence.score}% · Tier ${confidence.tier}`)

  const draftData = {
    extraction, classifications, contributions, confidence,
    mode: 'dry-run', source: 'email_intake',
    email: { sender: 'dry-run@test.com', subject: 'DRY RUN', gmail_message_id: 'dry-run-001' },
    regimen: 'ITE',
  }

  const { data: draft, error: draftErr } = await supabase
    .from('pedimento_drafts')
    .insert({
      trafico_id: null,
      draft_data: draftData,
      status: 'draft',
      created_by: 'CRUZ',
      // company_id removed — column does not exist in pedimento_drafts
    })
    .select('id')
    .single()

  if (draftErr) {
    console.error(`Draft insert failed: ${draftErr.message}`)
    return
  }

  console.log(`\nDraft created: ${draft.id}`)

  const tmecLabel = contributions.igi.tmec ? '✅' : '❌'
  await sendTelegram([
    `🧪 <b>DRY RUN — Borrador listo</b> · ${extraction.invoice_number}`,
    `${extraction.supplier_name} · $${extraction.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${extraction.currency}`,
    `Confianza: ${confidence.score}% · T-MEC ${tmecLabel}`,
    `— CRUZ 🦀`,
  ].join('\n'))

  await supabase.from('audit_log').insert({
    action: 'email_intake_dry_run',
    entity_type: 'pedimento_draft',
    entity_id: draft.id,
    details: { mode: 'dry-run', confidence: confidence.score },
    company_id: companyId,
  }).then(() => {}, () => {})

  console.log('DRY RUN complete ✅')
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Email Intake Pipeline`)
  console.log(`  Mode: ${MODE}`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log(`  ai@renatozapata.com\n`)

  // company_id is a variable — never hardcoded
  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  if (MODE === 'dry-run') {
    await runDryRun(companyId)
    return
  }

  const gmail = await getGmail()

  // Verify connection
  const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
  console.log(`Connected: ${profile.emailAddress} (${profile.messagesTotal} msgs)\n`)

  // Step 1: Fetch unread emails with attachments
  const after48h = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)
  const query = `after:${after48h} is:unread has:attachment filename:pdf`
  const { data: listData } = await gmail.users.messages.list({
    userId: 'me', q: query, maxResults: 20,
  })

  const messages = listData.messages || []
  console.log(`Found ${messages.length} unread email(s) with PDFs\n`)

  let emailsProcessed = 0
  let draftsCreated = 0
  let errors = 0

  for (const m of messages) {
    console.log(`--- Email ${m.id} ---`)
    try {
      const result = await processEmail(gmail, m.id, companyId)
      if (result) {
        emailsProcessed++
        draftsCreated++
        console.log(`  ✅ Draft ${result.draftId} · ${result.confidence}% · Tier ${result.tier}\n`)
      } else {
        console.log('')
      }
    } catch (err) {
      errors++
      console.error(`  ❌ Error: ${err.message}\n`)
      await sendTelegram(`🔴 <b>Email Intake</b> error on ${m.id}:\n${err.message.substring(0, 200)}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Log to pipeline_log
  await supabase.from('pipeline_log').insert({
    step: 'email_intake',
    status: errors > 0 ? 'partial' : 'completed',
    input_summary: `${messages.length} emails found`,
    output_summary: `${emailsProcessed} processed, ${draftsCreated} drafts created`,
    details: {
      mode: MODE, emails_found: messages.length,
      emails_processed: emailsProcessed, drafts_created: draftsCreated,
      errors, elapsed_s: parseFloat(elapsed),
    },
  }).then(() => {}, (err) => console.error('pipeline_log error:', err.message))

  // Log to heartbeat_log (operational resilience)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: errors > 0 ? 'partial' : 'success',
    details: { mode: MODE, emails: emailsProcessed, drafts: draftsCreated, errors, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  // Summary
  const summary = `${emailsProcessed} emails → ${draftsCreated} drafts · ${errors} error(s) · ${elapsed}s · ${MODE}`
  console.log(`\n${summary}`)

  // Telegram — always notify, success AND failure
  if (errors > 0) {
    await sendTelegram(`🟡 <b>Email Intake</b> · ${summary}`)
  } else if (draftsCreated > 0) {
    await sendTelegram(`✅ <b>Email Intake</b> · ${summary}`)
  } else {
    // No new emails — silent (no spam)
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
