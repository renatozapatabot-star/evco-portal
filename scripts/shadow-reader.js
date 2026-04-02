#!/usr/bin/env node

// ============================================================
// CRUZ Shadow Reader — reads Claudia + Eloisa inboxes
// Classifies each email by workflow stage using Ollama qwen3:8b
// Stores in shadow_emails for workflow state machine analysis
// Run: node scripts/shadow-reader.js
// Cron: 0 */2 6-22 * * 1-6
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { google } = require('googleapis')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const OLLAMA_URL = 'http://127.0.0.1:11434'
const OLLAMA_MODEL = 'qwen3:8b'
const MAX_EMAILS = 50
const LOOKBACK_DAYS = 7

const ACCOUNTS = [
  { name: 'claudia', token: process.env.GMAIL_REFRESH_TOKEN_CLAUDIA },
  { name: 'eloisa', token: process.env.GMAIL_REFRESH_TOKEN_ELOISA },
]

// ── Gmail Auth ──────────────────────────────────
function getGmail(refreshToken) {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3333/oauth2callback'
  )
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

// ── Fetch Recent Emails ─────────────────────────
async function fetchEmails(gmail, afterDate) {
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

// ── Get Attachment Names ────────────────────────
function getAttachmentNames(payload) {
  const names = []
  const walk = (part) => {
    if (part.filename && part.filename.length > 0) names.push(part.filename)
    if (part.parts) part.parts.forEach(walk)
  }
  walk(payload)
  return names
}

// ── Classify with Ollama ────────────────────────
async function classifyEmail(sender, subject, snippet, attachments) {
  const prompt = `Classify this customs brokerage email as JSON only. No explanation.

HINT: "Manifestacion de Valor" or "MVE" = pre_filing. "Pedimento" or "PED." = filing. "Entrada de Bodega" = intake. "Rectificación" = filing. "COVE" = pre_filing. "Importación" or "IMPO" = intake. "Anexo 24" = compliance. "Factura" = document_received. Empty/spam subjects = other.

From: ${sender}
Subject: ${subject}
Snippet: ${snippet}
Attachments: ${attachments.join(', ') || 'none'}

Respond with ONLY this JSON format:
{"stage":"...","action":"...","trafico":"...or null","confidence":0.0-1.0}

Valid stages: intake, document_request, document_received, classification, pre_filing, filing, crossing, delivery, billing, status_update, other
Valid actions: request, response, notification, confirmation, escalation, internal`

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        think: false,
        options: { temperature: 0.1, num_predict: 300 },
      }),
    })

    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`)

    const { response } = await resp.json()

    // Extract JSON from response
    // Strip qwen3 think tags before parsing
            const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) return { stage: 'other', action: 'other', trafico: null, confidence: 0 }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      stage: parsed.stage || 'other',
      action: parsed.action || 'other',
      // Validate trafico ref — must contain digits, reject generic words
      let ref = parsed.trafico || null;
      if (ref && !/\d{4,}/.test(ref)) ref = null;
      trafico: ref,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      raw: response,
    }
  } catch (err) {
    console.error(`  Ollama error: ${err.message}`)
    return { stage: 'error', action: 'error', trafico: null, confidence: 0, raw: err.message }
  }
}

// ── Process One Account ─────────────────────────
async function processAccount(account) {
  const { name, token } = account
  if (!token) {
    console.log(`⚠️  ${name}: no refresh token, skipping`)
    return { processed: 0, skipped: 0, errors: 0 }
  }

  console.log(`\n📧 Reading ${name}'s inbox...`)
  const gmail = getGmail(token)
  const afterDate = new Date(Date.now() - LOOKBACK_DAYS * 86400000)
  const messages = await fetchEmails(gmail, afterDate)
  console.log(`  Found ${messages.length} emails (last ${LOOKBACK_DAYS} days)`)

  let processed = 0, skipped = 0, errors = 0

  for (const { id: messageId } of messages) {
    // Skip if already processed
    const { data: existing } = await supabase
      .from('shadow_emails')
      .select('id')
      .eq('account', name)
      .eq('gmail_message_id', messageId)
      .maybeSingle()

    if (existing) { skipped++; continue }

    try {
      // Fetch full email
      const { data: msg } = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      const headers = parseHeaders(msg.payload?.headers || [])
      const attachments = getAttachmentNames(msg.payload || {})

      // Classify with Ollama
      const classification = await classifyEmail(
        headers.from,
        headers.subject,
        msg.snippet || '',
        attachments
      )

      // Store
      const { error: insertErr } = await supabase.from('shadow_emails').insert({
        account: name,
        gmail_message_id: messageId,
        sender: headers.from,
        recipient: headers.to,
        subject: headers.subject,
        received_at: headers.date ? new Date(headers.date).toISOString() : null,
        snippet: (msg.snippet || '').slice(0, 500),
        attachment_names: attachments.length > 0 ? attachments : null,
        workflow_stage: classification.stage,
        action_type: classification.action,
        trafico_ref: classification.trafico,
        confidence: classification.confidence,
        ollama_raw: classification.raw ? { response: classification.raw } : null,
      })

      if (insertErr) {
        console.error(`  ❌ ${headers.subject?.slice(0, 50)}: ${insertErr.message}`)
        errors++
      } else {
        const tag = `${classification.stage}/${classification.action}`
        console.log(`  ✅ ${tag.padEnd(30)} ${headers.subject?.slice(0, 50)}`)
        processed++
      }
    } catch (err) {
      console.error(`  ❌ ${messageId}: ${err.message}`)
      errors++
    }
  }

  return { processed, skipped, errors }
}

// ── Summary Stats ───────────────────────────────
async function printSummary() {
  const { data } = await supabase
    .from('shadow_emails')
    .select('workflow_stage, account')

  if (!data?.length) return

  const stages = {}
  for (const { workflow_stage, account } of data) {
    const key = `${account}/${workflow_stage}`
    stages[key] = (stages[key] || 0) + 1
  }

  console.log('\n📊 Workflow Distribution:')
  for (const [key, count] of Object.entries(stages).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(35)} ${count}`)
  }
}

// ── Main ────────────────────────────────────────
async function main() {
  const ts = new Date().toISOString()
  console.log(`🔍 CRUZ Shadow Reader — ${ts}`)
  console.log(`  Ollama: ${OLLAMA_MODEL} · Lookback: ${LOOKBACK_DAYS}d`)

  const totals = { processed: 0, skipped: 0, errors: 0 }

  for (const account of ACCOUNTS) {
    try {
      const result = await processAccount(account)
      totals.processed += result.processed
      totals.skipped += result.skipped
      totals.errors += result.errors
    } catch (err) {
      console.error(`❌ ${account.name} failed: ${err.message}`)
      totals.errors++
    }
  }

  console.log(`\n✅ Shadow Reader complete`)
  console.log(`  Processed: ${totals.processed} · Skipped: ${totals.skipped} · Errors: ${totals.errors}`)

  if (totals.processed > 0) await printSummary()

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
