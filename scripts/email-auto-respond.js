#!/usr/bin/env node

// ============================================================
// CRUZ Email Auto-Respond — drafts responses to incoming emails
// Runs after email-intake classifies a new email.
// Drafts pending Tito approval — NEVER sends automatically.
//
// Run: node scripts/email-auto-respond.js [--dry-run]
// Triggered by: email-intake.js post-classification hook
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { buildAcuseRecibo, buildEstadoTrafico, buildSolicitationEmail, buildSubject, docLabel } = require('./lib/email-templates')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'email-auto-respond'

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

async function main() {
  console.log(`📧 CRUZ Auto-Respond — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  // Find recent shadow_classifications without a response draft
  const cutoff = new Date(Date.now() - 4 * 3600000).toISOString() // last 4 hours
  const { data: classifications } = await supabase
    .from('shadow_classifications')
    .select('id, email_id, from_address, subject, classification, confidence, created_at')
    .gte('created_at', cutoff)
    .is('staff_action', null) // not yet acted on
    .order('created_at', { ascending: false })
    .limit(20)

  if (!classifications || classifications.length === 0) {
    console.log('  No new emails to respond to.')
    process.exit(0)
  }

  console.log(`  Found ${classifications.length} unprocessed emails`)

  let drafted = 0

  for (const email of classifications) {
    const type = email.classification || 'other'
    const sender = email.from_address || ''
    const contactName = sender.split('<')[0].trim().replace(/"/g, '') || sender
    const subject = email.subject || ''

    // Determine response type
    let response = null

    if (['factura_comercial', 'packing_list', 'bill_of_lading', 'certificado_origen', 'cove', 'mve', 'carta_porte', 'entrada_bodega'].includes(type)) {
      // Document received → acuse de recibo
      response = buildAcuseRecibo({
        contacto: contactName,
        documentos: [docLabel(type)],
        trafico: null,
      })
      response.type = 'acuse_recibo'
    } else if (type === 'solicitud_documentos' || type === 'status_update') {
      // Status inquiry → we'd need to look up the tráfico, but for now draft a generic response
      response = buildEstadoTrafico({
        contacto: contactName,
        trafico: null,
        estatus: 'En proceso',
        pedimento: null,
        fechaLlegada: null,
      })
      response.type = 'estado_trafico'
    }
    // Skip spam, general_correspondence, other — no auto-response

    if (!response) continue

    console.log(`  ${type.padEnd(25)} → ${response.type} for ${contactName.substring(0, 30)}`)

    if (DRY_RUN) {
      drafted++
      continue
    }

    // Save draft to pedimento_drafts (reusing the drafts table for approval flow)
    const { error: draftErr } = await supabase.from('pedimento_drafts').insert({
      trafico_id: null,
      draft_data: {
        type: 'email_response',
        response_type: response.type,
        to: sender,
        subject: response.subject,
        body: response.body,
        source_email_id: email.email_id,
        source_classification: type,
        confidence: email.confidence,
      },
      status: 'pending_approval',
      created_by: 'CRUZ',
    })

    if (draftErr) {
      console.error(`  ❌ Draft save failed: ${draftErr.message}`)
      continue
    }

    // Mark classification as acted on
    await supabase.from('shadow_classifications')
      .update({ staff_action: 'auto_draft' })
      .eq('id', email.id)
      .then(() => {}, () => {})

    drafted++
  }

  if (drafted > 0) {
    await sendTelegram([
      `✉️ <b>${drafted} respuesta(s) lista(s)</b>`,
      ``,
      `${drafted} email(s) con borrador de respuesta.`,
      `Revisa y aprueba: <b>/aprobar</b>`,
      ``,
      `— CRUZ 🦀`,
    ].join('\n'))
  }

  // Log
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { processed: classifications.length, drafted, dry_run: DRY_RUN },
  }).then(() => {}, () => {})

  console.log(`\n✅ ${drafted} drafts created`)
  process.exit(0)
}

main().catch(async err => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`)
  process.exit(1)
})
