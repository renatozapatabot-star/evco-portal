#!/usr/bin/env node
// scripts/email-study.js
// ============================================================================
// CRUZ Email Study Pipeline
// Polls study-mode inboxes (eloisa@, claudia@) for historical emails.
// Extracts supplier/fraccion/valor patterns → inserts to email_intelligence.
// NO drafts created. Learning only.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'email-study'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

// OAuth2 refresh tokens per inbox
const TOKEN_MAP = {
  'claudia@renatozapata.com': process.env.GMAIL_REFRESH_TOKEN_CLAUDIA,
  'eloisarangel@renatozapata.com': process.env.GMAIL_REFRESH_TOKEN_ELOISA,
  'ai@renatozapata.com': process.env.GMAIL_REFRESH_TOKEN_AI,
}

// Study-mode inboxes — extract patterns only, no draft creation
const STUDY_INBOXES = [
  { email: 'eloisarangel@renatozapata.com', mode: 'study' },
  { email: 'claudia@renatozapata.com', mode: 'study' },
]

// Full pipeline inbox (also feeds email_intelligence)
const FULL_INBOX = { email: 'ai@renatozapata.com', mode: 'full' }

// ── Notifications ─────────────────────────────────────────────────────────

async function sendTelegram(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('Telegram error:', e.message) }
}

// ── Gmail client via OAuth2 refresh tokens ───────────────────────────────

async function getGmailForUser(userEmail) {
  const refreshToken = TOKEN_MAP[userEmail]
  if (!refreshToken) {
    throw new Error(`No refresh token configured for ${userEmail}`)
  }
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3333/oauth2callback'
  )
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

// ── Anthropic call ────────────────────────────────────────────────────────

async function callAnthropic(model, system, userContent, maxTokens = 4096) {
  const start = Date.now()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] }),
  })
  const data = await res.json()
  const latency = Date.now() - start

  if (data.error) throw new Error(`Anthropic ${model}: ${data.error.message}`)

  // Cost tracking (Operational Resilience Rule #4)
  const usage = data.usage || {}
  await supabase.from('api_cost_log').insert({
    model,
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    action: SCRIPT_NAME,
    client_code: 'system',
    latency_ms: latency,
  }).then(() => {}, () => {})

  return data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || ''
}

// ── Extract invoice intelligence from PDF ─────────────────────────────────

async function extractIntelligence(base64Data, filename, emailSubject) {
  const system = `You are a customs data extractor for a Mexican customs broker (Patente 3596).
Extract supplier information and product classifications from this document.
Return ONLY valid JSON — no markdown, no explanation.

JSON schema:
{
  "supplier": "string — company name",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "currency": "USD or MXN",
  "products": [
    {
      "description": "string",
      "fraccion": "XXXX.XX.XX — Mexican tariff fraction if visible on document, otherwise null",
      "valor_usd": number or null
    }
  ],
  "valor_total_usd": number or null
}`

  const userContent = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
    },
    {
      type: 'text',
      text: `Filename: ${filename}\nEmail subject: ${emailSubject}\n\nExtract supplier, products, and any tariff fractions visible. Return ONLY valid JSON.`,
    },
  ]

  // Use Sonnet for extraction accuracy
  const text = await callAnthropic('claude-sonnet-4-6', system, userContent)

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    console.error('  ⚠️  Extraction returned non-JSON:', text.substring(0, 200))
    return null
  }
}

function extractHeader(headers, name) {
  return (headers?.find(h => h.name?.toLowerCase() === name.toLowerCase()))?.value || ''
}

// ── Process a single email for intelligence ───────────────────────────────

async function processEmailForIntelligence(gmail, messageId, sourceInbox) {
  const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  const headers = msg.payload?.headers || []
  const subject = extractHeader(headers, 'Subject')
  const date = extractHeader(headers, 'Date')

  // Find PDF attachments
  const allAttachments = []
  function findParts(parts) {
    if (!parts) return
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        allAttachments.push({ filename: part.filename, attachmentId: part.body.attachmentId, mimeType: part.mimeType, size: part.body.size || 0 })
      }
      if (part.parts) findParts(part.parts)
    }
  }
  findParts(msg.payload?.parts || [msg.payload])

  const pdfs = allAttachments.filter(a => {
    const name = a.filename || ''
    return name.toLowerCase().endsWith('.pdf') && !name.startsWith('._')
  })
  if (pdfs.length === 0) return 0

  let inserted = 0
  for (const att of pdfs.slice(0, 3)) {
    try {
      const { data: attData } = await gmail.users.messages.attachments.get({
        userId: 'me', messageId, id: att.attachmentId,
      })
      const base64Data = attData.data.replace(/-/g, '+').replace(/_/g, '/')

      const intelligence = await extractIntelligence(base64Data, att.filename, subject)
      if (!intelligence?.supplier) continue

      // Insert each product as a separate intelligence row
      const products = intelligence.products || []
      for (const product of products) {
        await supabase.from('email_intelligence').insert({
          supplier: intelligence.supplier,
          fraccion: product.fraccion || null,
          valor_usd: product.valor_usd || intelligence.valor_total_usd || null,
          invoice_number: intelligence.invoice_number || null,
          email_date: date ? new Date(date).toISOString() : null,
          source_inbox: sourceInbox,
          raw_data: {
            filename: att.filename,
            subject,
            description: product.description,
            currency: intelligence.currency,
          },
        })
        inserted++
      }

      // If no products but supplier found, insert supplier-level row
      if (products.length === 0) {
        await supabase.from('email_intelligence').insert({
          supplier: intelligence.supplier,
          fraccion: null,
          valor_usd: intelligence.valor_total_usd || null,
          invoice_number: intelligence.invoice_number || null,
          email_date: date ? new Date(date).toISOString() : null,
          source_inbox: sourceInbox,
          raw_data: { filename: att.filename, subject },
        })
        inserted++
      }
    } catch (err) {
      console.error(`     ❌ Error processing ${att.filename}: ${err.message}`)
    }
  }

  return inserted
}

// ── Main ──────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\n🎓 CRUZ Email Study Pipeline`)
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log(`   Patente 3596 · Aduana 240\n`)

  let totalInserted = 0
  let totalErrors = 0

  for (const inbox of STUDY_INBOXES) {
    console.log(`📧 Processing: ${inbox.email} (${inbox.mode} mode)`)

    try {
      const gmail = await getGmailForUser(inbox.email)

      // Look for emails with PDF attachments in last 7 days
      const after = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
      const { data: listData } = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${after} has:attachment filename:pdf`,
        maxResults: 20,
      })

      const messages = listData.messages || []
      console.log(`   Found ${messages.length} email(s) with PDFs`)

      for (const msg of messages) {
        try {
          const count = await processEmailForIntelligence(gmail, msg.id, inbox.email)
          totalInserted += count
          if (count > 0) console.log(`   ✅ +${count} intelligence rows`)
        } catch (err) {
          totalErrors++
          console.error(`   ❌ Error: ${err.message}`)
        }
      }
    } catch (err) {
      totalErrors++
      console.error(`   ❌ Failed to access ${inbox.email}: ${err.message}`)
    }

    console.log('')
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const summary = `🎓 Email Study: ${totalInserted} patrones extraídos, ${totalErrors} error(es) · ${elapsed}s`
  console.log(`\n${summary}`)

  // Log to Supabase (Operational Resilience Rule #1)
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: totalErrors > 0 ? 'partial' : 'success',
    details: { inserted: totalInserted, errors: totalErrors, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  if (totalErrors > 0) {
    await sendTelegram(`🟡 <b>Email Study</b> · ${totalInserted} patrones · ${totalErrors} error(es) · ${elapsed}s`)
  } else if (totalInserted > 0) {
    await sendTelegram(`✅ <b>Email Study</b> · ${totalInserted} patrones extraídos · ${elapsed}s`)
  } else {
    await sendTelegram(`✅ <b>Email Study</b> · Sin correos nuevos · ${elapsed}s`)
  }
}

run().catch(async err => {
  console.error('❌ Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}`)
  process.exit(1)
})
