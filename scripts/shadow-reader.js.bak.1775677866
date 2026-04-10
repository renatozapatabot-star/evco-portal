#!/usr/bin/env node

// ============================================================
// CRUZ Shadow Reader — Sonnet-powered observe-only intelligence
// Reads ai@renatozapata.com inbox, classifies with Anthropic Sonnet
// Stores in shadow_classifications — NEVER responds or modifies
// Run: node scripts/shadow-reader.js [--dry-run]
// Cron: */30 6-22 * * 1-6
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { google } = require('googleapis')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const MAX_EMAILS = 50
const LOOKBACK_HOURS = 2 // Only look back 2 hours per run (runs every 30 min)
const SCRIPT_NAME = 'shadow-reader'

// ── Gmail Auth ──────────────────────────────────
function getGmail() {
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

// ── Fetch Recent Emails ─────────────────────────
async function fetchEmails(gmail) {
  const afterDate = new Date(Date.now() - LOOKBACK_HOURS * 3600000)
  const query = `after:${Math.floor(afterDate.getTime() / 1000)}`
  const messages = []
  let pageToken = null

  do {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: MAX_EMAILS,
      pageToken,
    })
    if (data.messages) messages.push(...data.messages)
    pageToken = data.nextPageToken
  } while (pageToken && messages.length < MAX_EMAILS)

  return messages.slice(0, MAX_EMAILS)
}

// ── Parse Email Headers ─────────────────────────
function parseHeaders(headers) {
  const get = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return {
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
  }
}

// ── Get Attachment Info ─────────────────────────
function getAttachmentInfo(payload) {
  const attachments = []
  const walk = (part) => {
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        name: part.filename,
        mimeType: part.mimeType || 'unknown',
        size: part.body?.size || 0,
      })
    }
    if (part.parts) part.parts.forEach(walk)
  }
  walk(payload)
  return attachments
}

// ── Classify with Anthropic Sonnet ──────────────
async function classifyEmail(sender, subject, snippet, attachments) {
  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const attachmentList = attachments.length > 0
    ? attachments.map(a => `${a.name} (${a.mimeType})`).join(', ')
    : 'ninguno'

  const start = Date.now()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Eres un sistema de clasificación de emails para una agencia aduanal en Laredo, Texas (Patente 3596).

Clasifica este email. Responde SOLO con JSON válido, sin explicación.

De: ${sender}
Asunto: ${subject}
Fragmento: ${snippet}
Adjuntos: ${attachmentList}

Responde con este formato exacto:
{
  "document_type": "factura_comercial|packing_list|bill_of_lading|pedimento|cove|mve|certificado_origen|carta_porte|entrada_bodega|orden_compra|guia_embarque|permiso|proforma|doda_previo|nom|coa|solicitud_documentos|status_update|billing|general_correspondence|spam|other",
  "shipment_intent": "import|export|transit|warehouse|compliance|billing|inquiry|none",
  "urgency": "critical|high|normal|low",
  "trafico_ref": "string or null — extract tráfico/referencia number if present",
  "confidence": 0.0-1.0,
  "summary": "one-line summary in Spanish"
}`
    }],
  })

  const latency = Date.now() - start

  // Cost tracking — non-blocking
  supabase.from('api_cost_log').insert({
    model: 'claude-sonnet-4-20250514',
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: (response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) / 1000,
    action: 'shadow_classification',
    client_code: 'internal',
    latency_ms: latency,
  }).then(() => {}, () => {})

  const text = response.content[0]?.text || ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { classification: 'parse_error', confidence: 0, raw: text }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate trafico ref — must contain 4+ digits
    let ref = parsed.trafico_ref || null
    if (ref && !/\d{4,}/.test(ref)) ref = null

    return {
      classification: parsed.document_type || 'other',
      shipment_intent: parsed.shipment_intent || 'none',
      urgency: parsed.urgency || 'normal',
      trafico_ref: ref,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      summary: parsed.summary || '',
      raw: {
        response: text,
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        latency_ms: latency,
      },
    }
  } catch (err) {
    return { classification: 'parse_error', confidence: 0, raw: { response: text, error: err.message } }
  }
}

// ── Telegram Alert ──────────────────────────────
async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-5085543275',
        text: msg,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Main ────────────────────────────────────────
async function main() {
  const ts = new Date().toISOString()
  console.log(`🔍 CRUZ Shadow Reader — ${ts}`)
  console.log(`  Model: claude-sonnet-4 · Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  let gmail
  try {
    gmail = getGmail()
  } catch (err) {
    console.error(`❌ Gmail auth failed: ${err.message}`)
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: Gmail auth — ${err.message}`)
    process.exit(1)
  }

  const messages = await fetchEmails(gmail)
  console.log(`  Found ${messages.length} emails (last ${LOOKBACK_HOURS}h)`)

  if (messages.length === 0) {
    console.log('  No new emails. Done.')
    process.exit(0)
  }

  let processed = 0, skipped = 0, errors = 0
  const classificationCounts = {}

  for (const { id: messageId } of messages) {
    // Skip if already classified
    const { data: existing } = await supabase
      .from('shadow_classifications')
      .select('id')
      .eq('email_id', messageId)
      .maybeSingle()

    if (existing) { skipped++; continue }

    try {
      // Fetch email metadata (read-only — no modifications)
      const { data: msg } = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      const headers = parseHeaders(msg.payload?.headers || [])
      const attachments = getAttachmentInfo(msg.payload || {})

      if (DRY_RUN) {
        console.log(`  [DRY] ${headers.from?.slice(0, 30)} · ${headers.subject?.slice(0, 50)}`)
        console.log(`         Attachments: ${attachments.map(a => a.name).join(', ') || 'none'}`)
        processed++
        continue
      }

      // Classify with Sonnet
      const result = await classifyEmail(
        headers.from,
        headers.subject,
        msg.snippet || '',
        attachments
      )

      // Store classification
      const { error: insertErr } = await supabase.from('shadow_classifications').insert({
        email_id: messageId,
        from_address: headers.from,
        subject: headers.subject,
        classification: result.classification,
        confidence: result.confidence,
        sonnet_response: result.raw,
      })

      if (insertErr) {
        console.error(`  ❌ ${headers.subject?.slice(0, 50)}: ${insertErr.message}`)
        errors++
      } else {
        const tag = result.classification || 'unknown'
        classificationCounts[tag] = (classificationCounts[tag] || 0) + 1
        console.log(`  ✅ ${tag.padEnd(25)} (${(result.confidence * 100).toFixed(0)}%) ${headers.subject?.slice(0, 50)}`)
        processed++
      }
    } catch (err) {
      console.error(`  ❌ ${messageId}: ${err.message}`)
      errors++
    }
  }

  // Summary
  console.log(`\n✅ Shadow Reader complete`)
  console.log(`  Processed: ${processed} · Skipped: ${skipped} · Errors: ${errors}`)

  if (Object.keys(classificationCounts).length > 0) {
    console.log('\n📊 Classification Distribution:')
    for (const [type, count] of Object.entries(classificationCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type.padEnd(30)} ${count}`)
    }
  }

  // Log run status to Supabase
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: errors > 0 ? 'partial' : 'success',
    details: { processed, skipped, errors, classifications: classificationCounts },
  }).then(() => {}, () => {})

  // Alert on errors
  if (errors > 0) {
    await sendTelegram(`🟡 ${SCRIPT_NAME}: ${processed} classified, ${errors} errors`)
  }

  process.exit(0)
}

main().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
