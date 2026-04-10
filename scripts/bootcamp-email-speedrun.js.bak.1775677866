#!/usr/bin/env node
// ============================================================================
// CRUZ Intelligence Bootcamp 1 — Email History Speed-Run
//
// Classifies ALL historical emails from Eloisa, Claudia, and AI inboxes
// using Haiku (~$0.001/email). Goes back to the beginning of time.
// Stores in email_classification_history + aggregates to learned_patterns.
//
// Usage:
//   node scripts/bootcamp-email-speedrun.js --dry-run --limit=10  # test
//   node scripts/bootcamp-email-speedrun.js --limit=100           # small batch
//   node scripts/bootcamp-email-speedrun.js --cost-cap=50         # full run with cap
//   node scripts/bootcamp-email-speedrun.js --offset=5000         # resume from offset
//
// Cost: ~$50 for 50K emails at Haiku rates. Fully resumable via checkpoint.
// Cron: One-time batch only. New emails handled by shadow-reader.js.
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')
const {
  initBootcamp, upsertChunked, saveCheckpoint, loadCheckpoint,
  logCost, fatalHandler,
} = require('./lib/bootcamp')

const SCRIPT_NAME = 'bootcamp-email-speedrun'
const CLASSIFY_BATCH = 10 // emails per Haiku batch
const GMAIL_DELAY_MS = 500 // delay between Gmail API calls (rate limit)

// ── Inbox config ────────────────────────────────────────────────────────────

const INBOXES = [
  { name: 'eloisa', email: 'eloisarangel@renatozapata.com', tokenEnv: 'GMAIL_REFRESH_TOKEN_ELOISA' },
  { name: 'claudia', email: 'claudia@renatozapata.com', tokenEnv: 'GMAIL_REFRESH_TOKEN_CLAUDIA' },
  { name: 'ai', email: 'ai@renatozapata.com', tokenEnv: 'GMAIL_REFRESH_TOKEN_AI' },
]

// ── Gmail helpers ───────────────────────────────────────────────────────────

function getGmail(tokenEnvKey) {
  const refreshToken = process.env[tokenEnvKey]
  if (!refreshToken) return null
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3333/oauth2callback'
  )
  auth.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth })
}

function parseHeaders(headers) {
  const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return { from: get('From'), to: get('To'), subject: get('Subject'), date: get('Date') }
}

function getAttachmentInfo(payload) {
  const attachments = []
  const walk = (part) => {
    if (part.filename && part.filename.length > 0) {
      attachments.push({ name: part.filename, mimeType: part.mimeType || 'unknown', size: part.body?.size || 0 })
    }
    if (part.parts) part.parts.forEach(walk)
  }
  if (payload) walk(payload)
  return attachments
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Classification prompt (Haiku — cheap + fast) ────────────────────────────

const CLASSIFICATION_PROMPT = `Eres un sistema de clasificación de emails para una agencia aduanal en Laredo, Texas (Patente 3596).

Clasifica este email. Responde SOLO con JSON válido, sin explicación.

Responde con este formato exacto:
{
  "document_type": "factura_comercial|packing_list|bill_of_lading|pedimento|cove|mve|certificado_origen|carta_porte|entrada_bodega|orden_compra|guia_embarque|permiso|proforma|doda_previo|nom|coa|solicitud_documentos|status_update|billing|general_correspondence|spam|other",
  "client_ref": "string or null — extract client name or code if visible",
  "supplier_ref": "string or null — extract supplier/proveedor name if visible",
  "urgency": "critical|high|normal|low",
  "confidence": 0.0-1.0,
  "summary": "one-line summary in Spanish, max 80 chars"
}`

// ── Haiku classification ────────────────────────────────────────────────────

let anthropic = null
function getAnthropic() {
  if (!anthropic) {
    const Anthropic = require('@anthropic-ai/sdk')
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropic
}

async function classifyWithHaiku(supabase, emails) {
  const client = getAnthropic()
  const results = []

  for (const email of emails) {
    const attachmentList = email.attachments.length > 0
      ? email.attachments.map(a => a.name).join(', ')
      : 'ninguno'

    const start = Date.now()

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `${CLASSIFICATION_PROMPT}\n\nDe: ${email.from}\nPara: ${email.to}\nAsunto: ${email.subject}\nFragmento: ${email.snippet}\nAdjuntos: ${attachmentList}`,
        }],
      })

      const latencyMs = Date.now() - start

      // Cost tracking
      await logCost(supabase, 'claude-haiku-4-5-20251001', {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        latency_ms: latencyMs,
      }, 'bootcamp_email_classification')

      // Parse response
      const text = response.content[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        results.push({ email_id: email.id, error: 'no_json', raw: text })
        continue
      }

      const parsed = JSON.parse(jsonMatch[0])
      results.push({
        email_id: email.id,
        account: email.account,
        from_address: email.from,
        to_address: email.to,
        subject: (email.subject || '').substring(0, 500),
        received_at: email.date,
        document_type: parsed.document_type || 'other',
        client_ref: parsed.client_ref || null,
        supplier_ref: parsed.supplier_ref || null,
        urgency: parsed.urgency || 'normal',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
        summary: (parsed.summary || '').substring(0, 200),
        model: 'haiku',
        batch_id: email.batchId,
      })
    } catch (err) {
      results.push({ email_id: email.id, error: err.message })
    }
  }

  return results
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const { supabase, sendTelegram, logHeartbeat, args } = initBootcamp(SCRIPT_NAME)
  const start = Date.now()

  console.log(`\n🎓 BOOTCAMP 1: Email History Speed-Run`)
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN' : 'PRODUCTION'}`)
  console.log(`   Limit: ${args.limit || 'unlimited'}`)
  console.log(`   Cost cap: $${args.costCap || 'none'}`)

  // Load checkpoint
  const checkpoint = loadCheckpoint(SCRIPT_NAME) || { processed: {}, totalClassified: 0, totalCost: 0 }
  let grandTotal = checkpoint.totalClassified || 0
  let totalErrors = 0
  const batchId = `batch-${Date.now()}`

  for (const inbox of INBOXES) {
    const gmail = getGmail(inbox.tokenEnv)
    if (!gmail) {
      console.log(`\n⚠️ No token for ${inbox.name} (${inbox.tokenEnv}), skipping`)
      continue
    }

    console.log(`\n📧 Processing inbox: ${inbox.name} (${inbox.email})`)

    // Fetch existing email_ids to skip duplicates
    const { data: existingIds } = await supabase
      .from('email_classification_history')
      .select('email_id')
      .eq('account', inbox.name)

    const seenIds = new Set((existingIds || []).map(r => r.email_id))
    console.log(`  Already classified: ${seenIds.size.toLocaleString()}`)

    // Paginate through ALL messages
    let pageToken = null
    let inboxCount = 0
    let inboxClassified = 0
    let emailBuffer = []

    do {
      // Fetch message list
      const listParams = { userId: 'me', maxResults: 100 }
      if (pageToken) listParams.pageToken = pageToken

      const { data: listData } = await gmail.users.messages.list(listParams)
      if (!listData.messages || listData.messages.length === 0) break

      pageToken = listData.nextPageToken

      for (const msg of listData.messages) {
        // Check limits
        if (args.limit && grandTotal >= args.limit) break

        // Check cost cap
        if (args.costCap) {
          const { data: costData } = await supabase
            .from('api_cost_log')
            .select('input_tokens, output_tokens')
            .eq('action', 'bootcamp_email_classification')

          if (costData) {
            // Haiku: $1/M input, $5/M output
            const totalCost = costData.reduce((sum, r) =>
              sum + (r.input_tokens * 1 + r.output_tokens * 5) / 1000000, 0)
            if (totalCost >= args.costCap) {
              console.log(`\n💰 Cost cap reached: $${totalCost.toFixed(2)} >= $${args.costCap}`)
              break
            }
          }
        }

        // Skip already classified
        if (seenIds.has(msg.id)) {
          inboxCount++
          continue
        }

        // Fetch email metadata
        await delay(GMAIL_DELAY_MS)
        try {
          const { data: emailData } = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          })

          const headers = parseHeaders(emailData.payload?.headers || [])
          const attachments = getAttachmentInfo(emailData.payload)

          emailBuffer.push({
            id: msg.id,
            account: inbox.name,
            from: headers.from,
            to: headers.to,
            subject: headers.subject,
            date: headers.date ? new Date(headers.date).toISOString() : null,
            snippet: (emailData.snippet || '').substring(0, 300),
            attachments,
            batchId,
          })
        } catch (err) {
          totalErrors++
          if (totalErrors <= 5) console.error(`  Error fetching ${msg.id}: ${err.message}`)
          continue
        }

        inboxCount++

        // Classify in batches
        if (emailBuffer.length >= CLASSIFY_BATCH) {
          if (args.dryRun) {
            console.log(`  [DRY RUN] Would classify ${emailBuffer.length} emails`)
            emailBuffer = []
            continue
          }

          const results = await classifyWithHaiku(supabase, emailBuffer)
          const validResults = results.filter(r => !r.error)

          if (validResults.length > 0) {
            await upsertChunked(supabase, 'email_classification_history', validResults, 'email_id')
            inboxClassified += validResults.length
            grandTotal += validResults.length
          }

          totalErrors += results.filter(r => r.error).length
          emailBuffer = []

          // Progress
          process.stdout.write(`\r  ${inbox.name}: ${inboxCount.toLocaleString()} scanned, ${inboxClassified.toLocaleString()} classified`)

          // Checkpoint every 500
          if (grandTotal % 500 === 0 && grandTotal > 0) {
            saveCheckpoint(SCRIPT_NAME, {
              processed: { ...checkpoint.processed, [inbox.name]: inboxCount },
              totalClassified: grandTotal,
              lastBatchId: batchId,
            })
          }
        }
      }

      // Check if we hit limits
      if (args.limit && grandTotal >= args.limit) break

    } while (pageToken)

    // Process remaining buffer
    if (emailBuffer.length > 0 && !args.dryRun) {
      const results = await classifyWithHaiku(supabase, emailBuffer)
      const validResults = results.filter(r => !r.error)
      if (validResults.length > 0) {
        await upsertChunked(supabase, 'email_classification_history', validResults, 'email_id')
        inboxClassified += validResults.length
        grandTotal += validResults.length
      }
    }

    console.log(`\n  ${inbox.name}: ${inboxCount.toLocaleString()} scanned, ${inboxClassified.toLocaleString()} classified ✓`)
  }

  // ── Aggregation pass ──────────────────────────────────────────────────
  if (!args.dryRun && grandTotal > 0) {
    console.log('\n🧠 Aggregation pass...')

    // Sender → document_type frequency
    const { data: typeCounts } = await supabase
      .from('email_classification_history')
      .select('account, document_type')

    if (typeCounts && typeCounts.length > 0) {
      const accountTypes = {}
      for (const row of typeCounts) {
        if (!accountTypes[row.account]) accountTypes[row.account] = {}
        accountTypes[row.account][row.document_type] = (accountTypes[row.account][row.document_type] || 0) + 1
      }

      const patterns = Object.entries(accountTypes).map(([account, types]) => ({
        pattern_type: 'email_workflow',
        pattern_key: `email:account_types:${account}`,
        pattern_value: {
          account,
          type_distribution: types,
          total_emails: Object.values(types).reduce((a, b) => a + b, 0),
          primary_types: Object.entries(types)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => ({ type, count })),
        },
        confidence: 0.9,
        source: 'bootcamp_email_speedrun',
        sample_size: Object.values(types).reduce((a, b) => a + b, 0),
        first_detected: new Date().toISOString(),
        last_confirmed: new Date().toISOString(),
        active: true,
      }))

      await upsertChunked(supabase, 'learned_patterns', patterns, 'pattern_type,pattern_key')
      console.log(`  Wrote ${patterns.length} email workflow patterns`)
    }

    // Supplier frequency from email classifications
    const { data: supplierEmails } = await supabase
      .from('email_classification_history')
      .select('supplier_ref, document_type')
      .not('supplier_ref', 'is', null)

    if (supplierEmails && supplierEmails.length > 0) {
      const supplierTypes = {}
      for (const row of supplierEmails) {
        const s = row.supplier_ref.trim()
        if (!supplierTypes[s]) supplierTypes[s] = {}
        supplierTypes[s][row.document_type] = (supplierTypes[s][row.document_type] || 0) + 1
      }

      const supplierPatterns = Object.entries(supplierTypes)
        .sort((a, b) => {
          const aTotal = Object.values(a[1]).reduce((s, v) => s + v, 0)
          const bTotal = Object.values(b[1]).reduce((s, v) => s + v, 0)
          return bTotal - aTotal
        })
        .slice(0, 30) // top 30 suppliers
        .map(([supplier, types]) => ({
          pattern_type: 'email_workflow',
          pattern_key: `email:supplier:${supplier.substring(0, 50)}`,
          pattern_value: {
            supplier,
            email_count: Object.values(types).reduce((a, b) => a + b, 0),
            doc_types: types,
          },
          confidence: 0.8,
          source: 'bootcamp_email_speedrun',
          sample_size: Object.values(types).reduce((a, b) => a + b, 0),
          first_detected: new Date().toISOString(),
          last_confirmed: new Date().toISOString(),
          active: true,
        }))

      await upsertChunked(supabase, 'learned_patterns', supplierPatterns, 'pattern_type,pattern_key')
      console.log(`  Wrote ${supplierPatterns.length} supplier email patterns`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - start) / 1000)
  const summary = {
    total_classified: grandTotal,
    errors: totalErrors,
    elapsed_s: elapsed,
    mode: args.dryRun ? 'dry-run' : 'production',
    cost_estimate: `~$${(grandTotal * 0.001).toFixed(2)}`,
  }

  console.log(`\n✅ Bootcamp 1 complete in ${elapsed}s`)
  console.log(`   ${grandTotal.toLocaleString()} emails classified`)
  console.log(`   Errors: ${totalErrors}`)
  console.log(`   Estimated cost: ${summary.cost_estimate}`)

  if (!args.dryRun) {
    await logHeartbeat('success', summary)
    saveCheckpoint(SCRIPT_NAME, {
      totalClassified: grandTotal,
      lastBatchId: batchId,
      completedAt: new Date().toISOString(),
    })
    await sendTelegram(
      `🎓 <b>Bootcamp 1: Email Speed-Run</b>\n` +
      `${grandTotal.toLocaleString()} correos clasificados\n` +
      `Errores: ${totalErrors} · Costo: ${summary.cost_estimate}\n` +
      `${elapsed}s · — CRUZ 🦀`
    )
  }
}

run().catch(async err => {
  const { supabase, sendTelegram, logHeartbeat } = initBootcamp(SCRIPT_NAME)
  await fatalHandler(SCRIPT_NAME, sendTelegram, logHeartbeat, err)
})
