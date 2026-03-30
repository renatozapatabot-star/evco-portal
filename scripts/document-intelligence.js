const { createClient } = require('@supabase/supabase-js')
const { extractWithQwen, isOllamaRunning } = require('./qwen-extract')
const pdfParse = require('pdf-parse')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const BATCH = 100

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

const EXTRACTION_PROMPT = `Extract key fields from this customs document.
Return ONLY valid JSON with these fields:
{
  "supplier_name": "string or null",
  "invoice_number": "string or null",
  "total_value": number or null,
  "currency": "USD or MXN or null",
  "doc_date": "YYYY-MM-DD or null",
  "doc_type": "FACTURA or PEDIMENTO or COVE or PACKING_LIST or OTHER",
  "trafico_reference": "9254-YXXXX or null"
}
Return JSON only. No explanation.`

async function run() {
  console.log('🧠 Document Intelligence — Qwen3:32b')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) {
    console.log('⚠️ Ollama not running — skipping')
    return
  }

  // Get documents without extraction
  const { data: docs } = await supabase
    .from('documents')
    .select('id, file_url, doc_type, trafico_id')
    .is('extracted_data', null)
    .not('file_url', 'is', null)
    .limit(BATCH)

  console.log(`Processing ${docs?.length || 0} documents`)

  let processed = 0
  let succeeded = 0

  for (const doc of (docs || [])) {
    try {
      // Download PDF
      const res = await fetch(doc.file_url)
      if (!res.ok) continue

      const buffer = Buffer.from(await res.arrayBuffer())
      const pdf = await pdfParse(buffer)
      const text = pdf.text.substring(0, 3000)

      if (!text.trim()) continue

      // Extract with Qwen
      const extracted = await extractWithQwen(text, EXTRACTION_PROMPT)
      if (!extracted) continue

      // Save extraction
      await supabase.from('documents').update({
        extracted_data: extracted,
        extraction_source: 'qwen3:32b',
        extracted_at: new Date().toISOString()
      }).eq('id', doc.id)

      // Save to document_metadata
      await supabase.from('document_metadata').insert({
        document_id: doc.id,
        trafico_id: doc.trafico_id || extracted.trafico_reference,
        doc_type: extracted.doc_type,
        supplier_name: extracted.supplier_name,
        invoice_number: extracted.invoice_number,
        total_value: extracted.total_value,
        currency: extracted.currency,
        doc_date: extracted.doc_date,
        raw_extraction: extracted,
      }).onConflict('document_id').ignore()

      succeeded++
      process.stdout.write(`\r  ${succeeded}/${++processed} extracted`)
    } catch (e) {
      processed++
    }
  }

  console.log(`\n✅ Document intelligence: ${succeeded}/${processed} extracted`)

  if (succeeded > 0) {
    await tg([
      `🧠 <b>DOCUMENT INTELLIGENCE</b>`,
      `${succeeded} documentos procesados por Qwen`,
      `Datos estructurados guardados en Supabase`,
      `— CRUZ 🦀`
    ].join('\n'))
  }
}

module.exports = { run }
run().catch(console.error)
