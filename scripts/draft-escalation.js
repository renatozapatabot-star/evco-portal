#!/usr/bin/env node
/**
 * CRUZ Draft Escalation Monitor
 * Runs every 15 minutes via cron
 *
 * Monitors pedimento_drafts table for unapproved drafts:
 *   - 30 min unapproved  → WhatsApp reminder to Tito
 *   - 2 hours unapproved → Telegram escalation to Renato IV
 *   - 4 hours unapproved → Flag as needs_manual_intervention
 *
 * Escalation levels:
 *   0 = new/no escalation
 *   1 = WhatsApp sent to Tito (30 min)
 *   2 = Telegram sent to Renato IV (2 hours)
 *   3 = Flagged needs_manual_intervention (4 hours)
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER
const TITO_PHONE = process.env.TITO_PHONE
const SCRIPT_NAME = 'draft-escalation.js'

// Escalation thresholds in minutes
const WHATSAPP_THRESHOLD = 30    // Level 1
const TELEGRAM_THRESHOLD = 120   // Level 2
const FLAG_THRESHOLD = 240       // Level 3

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

async function sendWhatsApp(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    console.log('[WA skip — missing Twilio credentials]', body)
    return false
  }
  if (!to) {
    console.log('[WA skip — no phone number]', body)
    return false
  }
  try {
    const params = new URLSearchParams({
      From: `whatsapp:${TWILIO_FROM}`,
      To: `whatsapp:${to}`,
      Body: body,
    })
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        },
        body: params.toString(),
      }
    )
    const data = await resp.json()
    if (data.error_code) {
      console.error('WhatsApp error:', data.message)
      return false
    }
    console.log('  \uD83D\uDCF1 WhatsApp sent to', to)
    return true
  } catch (e) {
    console.error('WhatsApp send error:', e.message)
    return false
  }
}

function ageMinutes(createdAt) {
  return (Date.now() - new Date(createdAt).getTime()) / 60000
}

async function runEscalation() {
  const timestamp = nowCST()
  console.log(`\uD83D\uDCDD CRUZ Draft Escalation \u2014 ${timestamp}`)

  // Fetch all unapproved drafts (status = 'draft' or 'pending_review')
  const { data: drafts, error } = await supabase
    .from('pedimento_drafts')
    .select('id, trafico_id, draft_data, status, created_at, escalation_level, needs_manual_intervention')
    .in('status', ['draft', 'pending_review'])
    .eq('needs_manual_intervention', false)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to query pedimento_drafts: ${error.message}`)
  }

  if (!drafts || drafts.length === 0) {
    console.log('  No pending drafts \u2014 nothing to escalate')
    return
  }

  console.log(`  Found ${drafts.length} pending draft(s)`)

  let escalated = 0

  for (const draft of drafts) {
    const age = ageMinutes(draft.created_at)
    const currentLevel = draft.escalation_level || 0
    const traficoId = draft.trafico_id || 'unknown'

    console.log(`  Draft ${draft.id.substring(0, 8)}... (${traficoId}) \u2014 age: ${Math.round(age)}min, level: ${currentLevel}`)

    // Level 3: Flag as needs_manual_intervention (4 hours)
    if (age >= FLAG_THRESHOLD && currentLevel < 3) {
      console.log(`    \u2192 LEVEL 3: Flagging needs_manual_intervention`)

      await supabase.from('pedimento_drafts').update({
        escalation_level: 3,
        needs_manual_intervention: true,
        last_escalation_at: new Date().toISOString()
      }).eq('id', draft.id)

      await sendTelegram([
        `\uD83D\uDD34 <b>DRAFT REQUIERE INTERVENCI\u00D3N MANUAL</b>`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `Tr\u00E1fico: <b>${traficoId}</b>`,
        `Sin aprobar por ${Math.round(age / 60)} horas`,
        `Marcado como <b>needs_manual_intervention</b>`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `\u2014 CRUZ \uD83E\uDD80`
      ].join('\n'))

      escalated++
      continue
    }

    // Level 2: Telegram escalation to Renato IV (2 hours)
    if (age >= TELEGRAM_THRESHOLD && currentLevel < 2) {
      console.log(`    \u2192 LEVEL 2: Telegram escalation to Renato IV`)

      await supabase.from('pedimento_drafts').update({
        escalation_level: 2,
        last_escalation_at: new Date().toISOString()
      }).eq('id', draft.id)

      await sendTelegram([
        `\u26A0\uFE0F <b>DRAFT SIN APROBAR \u2014 ESCALACI\u00D3N</b>`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `Tr\u00E1fico: <b>${traficoId}</b>`,
        `Sin aprobar por ${Math.round(age)} min`,
        `WhatsApp enviado a Tito hace ${Math.round(age - WHATSAPP_THRESHOLD)} min`,
        ``,
        `Revisar en: evco-portal.vercel.app/dashboard/drafts`,
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
        `\u2014 CRUZ \uD83E\uDD80`
      ].join('\n'))

      escalated++
      continue
    }

    // Level 1: WhatsApp reminder to Tito (30 minutes)
    if (age >= WHATSAPP_THRESHOLD && currentLevel < 1) {
      console.log(`    \u2192 LEVEL 1: WhatsApp reminder to Tito`)

      const waMessage = [
        `\uD83E\uDD80 CRUZ \u2014 Draft pendiente`,
        ``,
        `Tr\u00E1fico: ${traficoId}`,
        `Esperando aprobaci\u00F3n desde hace ${Math.round(age)} min`,
        ``,
        `Revisar en: evco-portal.vercel.app/dashboard/drafts`
      ].join('\n')

      const sent = await sendWhatsApp(TITO_PHONE, waMessage)

      // If WhatsApp fails, send via Telegram as fallback
      if (!sent) {
        await sendTelegram([
          `\uD83D\uDCDD <b>DRAFT PENDIENTE \u2014 Recordatorio</b>`,
          `(WhatsApp no disponible \u2014 enviado por Telegram)`,
          `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
          `Tr\u00E1fico: <b>${traficoId}</b>`,
          `Sin aprobar por ${Math.round(age)} min`,
          `Revisar: evco-portal.vercel.app/dashboard/drafts`,
          `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
          `\u2014 CRUZ \uD83E\uDD80`
        ].join('\n'))
      }

      await supabase.from('pedimento_drafts').update({
        escalation_level: 1,
        last_escalation_at: new Date().toISOString()
      }).eq('id', draft.id)

      escalated++
      continue
    }
  }

  if (escalated > 0) {
    console.log(`\n  \u26A0\uFE0F  Escalated ${escalated} draft(s)`)
  } else {
    console.log(`\n  \u2705 No new escalations needed`)
  }

  // 48h documento solicitudes escalation
  console.log('\n\uD83D\uDCCB Checking documento solicitudes...')

  const { data: vencidas } = await supabase
    .from('documento_solicitudes')
    .select('*')
    .eq('status', 'solicitado')
    .lt('deadline', new Date().toISOString())

  if (vencidas && vencidas.length > 0) {
    console.log(`  \u26A0\uFE0F ${vencidas.length} solicitudes vencidas`)

    for (const s of vencidas) {
      // Update status to vencida
      await supabase.from('documento_solicitudes')
        .update({ status: 'vencida', escalated_at: new Date().toISOString() })
        .eq('id', s.id)

      // Create notification
      await supabase.from('notifications').insert({
        company_id: s.company_id,
        type: 'solicitud_vencida',
        severity: 'critical',
        title: `Solicitud vencida \u2014 ${s.trafico_id}`,
        description: `Sin respuesta de ${s.recipient_name} despu\u00E9s de ${Math.round((Date.now() - new Date(s.solicitado_at).getTime()) / 3600000)}h`,
        trafico_id: s.trafico_id,
        action_url: `/traficos/${s.trafico_id}`,
      })

      // Telegram alert
      await sendTelegram(
        `\uD83D\uDD34 Solicitud vencida: ${s.trafico_id}\n` +
        `Docs: ${(s.doc_types || []).join(', ')}\n` +
        `Enviado a: ${s.recipient_name}\n` +
        `Acci\u00F3n requerida: re-enviar o escalar`
      )

      console.log(`  \u2192 Escalated: ${s.trafico_id} (${(s.doc_types || []).length} docs)`)
    }
  } else {
    console.log('  \u2705 Sin solicitudes vencidas')
  }
}

runEscalation().catch(async (err) => {
  console.error('Fatal draft escalation error:', err)
  try {
    await sendTelegram(`\uD83D\uDD34 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n\u2014 CRUZ \uD83E\uDD80`)
  } catch (_) { /* best effort */ }
  process.exit(1)
})
