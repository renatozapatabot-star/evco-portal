#!/usr/bin/env node
// scripts/document-autolink.js — FEATURE 6
// Auto-link email attachments to tráficos
// Called by email-intelligence.js when attachments detected

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.2.215:11434'

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function extractFieldsWithQwen(text) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b', stream: false,
        prompt: `Extract from this document text. Return JSON only:
{"invoice_number":"...","supplier_name":"...","trafico_reference":"...","doc_type":"factura|packing_list|bill_of_lading|cove|other","value":"...","currency":"USD|MXN"}

Document text:
${text.substring(0, 3000)}`
      })
    })
    const data = await res.json()
    const match = (data.response || '').match(/\{[\s\S]*?\}/)
    return match ? JSON.parse(match[0]) : null
  } catch { return null }
}

async function findMatchingTrafico(fields) {
  if (!fields) return null
  const matches = []

  // Match by invoice number
  if (fields.invoice_number) {
    const { data } = await supabase.from('globalpc_facturas')
      .select('cve_trafico').ilike('numero', `%${fields.invoice_number}%`).limit(3)
    if (data?.length) matches.push(...data.map(d => ({ trafico: d.cve_trafico, confidence: 0.9, method: 'invoice_number' })))
  }

  // Match by trafico reference
  if (fields.trafico_reference) {
    const ref = fields.trafico_reference.replace(/[^0-9A-Za-z-]/g, '')
    const { data } = await supabase.from('traficos')
      .select('trafico').ilike('trafico', `%${ref}%`).eq('company_id', 'evco').limit(3)
    if (data?.length) matches.push(...data.map(d => ({ trafico: d.trafico, confidence: 0.95, method: 'trafico_reference' })))
  }

  // Match by supplier name
  if (fields.supplier_name && !matches.length) {
    const { data } = await supabase.from('globalpc_facturas')
      .select('cve_trafico').ilike('cve_proveedor', `%${fields.supplier_name.substring(0, 20)}%`)
      .order('fecha_facturacion', { ascending: false }).limit(5)
    if (data?.length) matches.push(...data.map(d => ({ trafico: d.cve_trafico, confidence: 0.6, method: 'supplier_name' })))
  }

  // Return best match
  matches.sort((a, b) => b.confidence - a.confidence)
  return matches[0] || null
}

// Main export for use by email-intelligence.js
async function autoLinkDocument({ filename, fileBuffer, senderEmail, subject }) {
  console.log(`📎 Auto-linking: ${filename}`)

  let extractedText = ''
  const ext = path.extname(filename).toLowerCase()

  // Extract text from PDF
  if (ext === '.pdf' && fileBuffer) {
    try {
      const pdfParse = require('pdf-parse')
      const pdfData = await pdfParse(fileBuffer)
      extractedText = pdfData.text || ''
    } catch (e) { console.log('PDF parse error:', e.message) }
  }

  // Also check filename for clues
  extractedText += `\nFilename: ${filename}\nFrom: ${senderEmail}\nSubject: ${subject}`

  // Extract fields using Qwen
  const fields = await extractFieldsWithQwen(extractedText)
  console.log('Extracted fields:', JSON.stringify(fields))

  // Find matching tráfico
  const match = await findMatchingTrafico(fields)

  if (match && match.confidence >= 0.8) {
    // Upload to Supabase Storage
    const storagePath = `expedientes/${match.trafico}/EMAIL/${filename}`
    if (fileBuffer) {
      await supabase.storage.from('expedientes').upload(storagePath, fileBuffer, {
        contentType: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream', upsert: true
      })
    }

    // Create document record
    const { data: urlData } = supabase.storage.from('expedientes').getPublicUrl(storagePath)
    await supabase.from('documents').insert({
      document_type: fields?.doc_type || 'email_attachment',
      file_path: urlData?.publicUrl || storagePath,
      metadata: {
        trafico: match.trafico,
        source: 'email_autolink',
        sender: senderEmail,
        subject,
        matched_by: match.method,
        confidence: match.confidence,
        extracted_fields: fields,
      },
      created_at: new Date().toISOString(),
    })

    await sendTG(`📎 <b>DOC AUTO-LINKED</b>\n${filename}\n→ ${match.trafico}\nConfianza: ${Math.round(match.confidence * 100)}% (${match.method})\nDe: ${senderEmail}\n— CRUZ 🦀`)
    return { success: true, trafico: match.trafico, confidence: match.confidence }

  } else {
    await sendTG(`📎 <b>DOC SIN VINCULAR</b>\n${filename}\nDe: ${senderEmail}\nAsunto: ${subject}\n\n${fields ? `Datos: ${fields.supplier_name || '?'}, inv ${fields.invoice_number || '?'}` : 'No se pudieron extraer datos'}\n\nResponde con /link_doc TRAFICO para vincular manualmente\n— CRUZ 🦀`)
    return { success: false, fields }
  }
}

// CLI mode — process a single file
if (require.main === module) {
  const file = process.argv[2]
  if (!file) { console.log('Usage: node document-autolink.js <file.pdf>'); process.exit(0) }
  const fs = require('fs')
  const buf = fs.readFileSync(file)
  autoLinkDocument({ filename: path.basename(file), fileBuffer: buf, senderEmail: 'manual', subject: 'CLI upload' })
    .then(r => console.log('Result:', r))
    .catch(e => console.error(e))
}

module.exports = { autoLinkDocument }
