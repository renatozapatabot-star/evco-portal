#!/usr/bin/env node

// ============================================================
// CRUZ Document Extractor — structured data from any PDF
// Sonnet extracts fields by document type into document_extractions.
// Cron: 0 */4 * * * (every 4 hours)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

// Extraction schemas per document type
const SCHEMAS = {
  factura_comercial: `{
  "invoice_number": "string",
  "supplier_name": "string",
  "supplier_rfc": "string or null",
  "date": "YYYY-MM-DD",
  "currency": "USD or MXN",
  "incoterm": "EXW/FOB/CIF/etc or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "total": number}],
  "subtotal": number,
  "total": number,
  "po_number": "string or null"
}`,
  cove: `{
  "cove_number": "string",
  "valor_declarado": number,
  "currency": "USD or MXN",
  "fecha_emision": "YYYY-MM-DD",
  "proveedor": "string",
  "descripcion": "string"
}`,
  pedimento: `{
  "pedimento_number": "XX XX XXXX XXXXXXX",
  "aduana": "string",
  "patente": "string",
  "tipo_cambio": number,
  "partidas": [{"fraccion": "XXXX.XX.XX", "descripcion": "string", "valor": number}],
  "dta": number,
  "igi": number,
  "iva": number,
  "total_contribuciones": number
}`,
  carta_porte: `{
  "origin": "string",
  "destination": "string",
  "carrier_name": "string",
  "weight_kg": number,
  "dimensions": "string or null",
  "hazmat": false
}`,
  bill_of_lading: `{
  "bl_number": "string",
  "shipper": "string",
  "consignee": "string",
  "vessel": "string or null",
  "port_loading": "string",
  "port_discharge": "string",
  "containers": number,
  "weight_kg": number
}`,
}

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function extractDocument(doc) {
  const { llmCall } = require('./lib/llm')

  const docType = (doc.doc_type || '').toLowerCase().replace(/\s+/g, '_')
  const schema = SCHEMAS[docType]
  if (!schema) return null // No schema for this type

  // Need a real file URL to send to Sonnet
  const fileUrl = doc.file_url
  if (!fileUrl || fileUrl.startsWith('globalpc://')) return null

  const prompt = `Extract structured data from this customs document.
Document type: ${docType}
File URL: ${fileUrl}

Return ONLY valid JSON matching this exact schema:
${schema}

If a field cannot be determined, use null. Extract all visible data.`

  try {
    const result = await llmCall({
      modelClass: 'vision',
      maxTokens: 2000,
      callerName: 'document-extractor',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = result.text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const extracted = JSON.parse(jsonMatch[0])

    // Cost tracking
    supabase.from('api_cost_log').insert({
      model: result.model,
      input_tokens: result.tokensIn,
      output_tokens: result.tokensOut,
      cost_usd: (result.tokensIn * 0.003 + result.tokensOut * 0.015) / 1000,
      action: 'document_extraction',
      client_code: doc.company_id || 'system',
    }).then(() => {}, () => {})

    return {
      doc_id: doc.id,
      doc_type: docType,
      trafico_id: doc.pedimento_id,
      company_id: doc.company_id,
      extracted_data: extracted,
      confidence: 0.85, // Base confidence for Sonnet extraction
      extracted_at: new Date().toISOString(),
    }
  } catch (err) {
    console.log(`  ⚠️ Extraction failed: ${err.message}`)
    return null
  }
}

async function main() {
  console.log(`🔍 CRUZ Document Extractor — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Find recent documents with real URLs that haven't been extracted
  const { data: docs } = await supabase
    .from('expediente_documentos')
    .select('id, doc_type, file_url, pedimento_id, company_id, uploaded_at')
    .not('file_url', 'like', 'globalpc%')
    .not('file_url', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(20)

  const extractable = (docs || []).filter(d => {
    const type = (d.doc_type || '').toLowerCase().replace(/\s+/g, '_')
    return SCHEMAS[type]
  })

  if (extractable.length === 0) {
    console.log('  No documents to extract')
    process.exit(0)
  }

  console.log(`  ${extractable.length} documents with extractable schemas`)

  let extracted = 0
  for (const doc of extractable) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would extract: ${doc.doc_type} (${doc.file_url?.substring(0, 50)})`)
      extracted++
      continue
    }

    const result = await extractDocument(doc)
    if (result) {
      await supabase.from('document_extractions').upsert(result, {
        onConflict: 'doc_id',
      }).then(() => {}, () => {})
      extracted++
      console.log(`  ✅ ${doc.doc_type}: ${Object.keys(result.extracted_data).length} fields`)
    }
  }

  if (extracted > 0) {
    await sendTelegram(`🔍 <b>Document Extractor</b>\n${extracted} documento(s) procesado(s)\n— CRUZ 🦀`)
  }

  console.log(`\n✅ ${extracted} documents extracted`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
