#!/usr/bin/env node
/**
 * CRUZ Document Wrangler — Build 210
 * ============================================================================
 * Escalating follow-up for missing documents. Runs every 4 hours.
 *
 * Escalation ladder:
 *   Hour 0-24:   Initial request (solicitud-email.js already sent)
 *   Hour 24-48:  Soft reminder via Resend
 *   Hour 48-72:  Firm reminder via Resend + WhatsApp (if Twilio configured)
 *   Hour 72-96:  Escalation to supplier manager + Tito notified
 *   Hour 96+:    Flag for manual intervention, Telegram red alert
 *
 * Cron: 0 */4 * * * (every 4 hours)
 *
 * Patente 3596 · Aduana 240
 * ============================================================================
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'document-wrangler'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER // e.g. whatsapp:+14155238886

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Document type labels ─────────────────────────────────────────────────────

const DOC_LABELS = {
  FACTURA_COMERCIAL: 'Factura Comercial',
  LISTA_EMPAQUE: 'Lista de Empaque',
  CONOCIMIENTO_EMBARQUE: 'Conocimiento de Embarque',
  CERTIFICADO_ORIGEN: 'Certificado de Origen',
  CARTA_PORTE: 'Carta Porte',
  MANIFESTACION_VALOR: 'Manifestación de Valor',
  COA: 'Certificado de Análisis',
  NOM: 'Certificado NOM',
  ORDEN_COMPRA: 'Orden de Compra',
  PERMISO: 'Permiso de Importación',
  PROFORMA: 'Proforma',
  DODA_PREVIO: 'DODA/Previo',
  GUIA_EMBARQUE: 'Guía de Embarque',
  ENTRADA_BODEGA: 'Entrada de Bodega',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function logPipeline(step, status, details) {
  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
  }).then(() => {}, () => {})
}

function hoursSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

function getEscalationLevel(hoursSinceSolicited) {
  if (hoursSinceSolicited >= 96) return 4  // Manual intervention
  if (hoursSinceSolicited >= 72) return 3  // Supplier manager + Tito
  if (hoursSinceSolicited >= 48) return 2  // Firm reminder + WhatsApp
  if (hoursSinceSolicited >= 24) return 1  // Soft reminder
  return 0                                  // Too soon — skip
}

// ── Email templates (escalating tone) ────────────────────────────────────────

function getEmailSubject(level, docLabel, traficoNumber) {
  switch (level) {
    case 1: return `Recordatorio: ${docLabel} pendiente — ${traficoNumber}`
    case 2: return `⚠️ Urgente: ${docLabel} pendiente (2 días) — ${traficoNumber}`
    case 3: return `🔴 Escalación: ${docLabel} pendiente (3 días) — ${traficoNumber}`
    default: return `Seguimiento: ${docLabel} — ${traficoNumber}`
  }
}

function getEmailBody(level, contactName, docLabel, traficoNumber, daysWaiting) {
  const greeting = contactName ? `Hola ${contactName}` : 'Estimado proveedor'

  if (level === 1) {
    return `${greeting},

Recordatorio amistoso: el documento <b>${docLabel}</b> para la operación <b>${traficoNumber}</b> sigue pendiente.

¿Necesitan algo de nuestra parte para prepararlo?

Saludos cordiales,
Renato Zapata & Company
Patente 3596 · Aduana 240 · Nuevo Laredo`
  }

  if (level === 2) {
    return `${greeting},

El documento <b>${docLabel}</b> para la operación <b>${traficoNumber}</b> lleva <b>${daysWaiting} días</b> pendiente. Esto puede afectar el tiempo de despacho aduanal.

¿Cuándo podemos esperar recibirlo?

Atentamente,
Renato Zapata & Company
Patente 3596 · Aduana 240 · Nuevo Laredo`
  }

  if (level === 3) {
    return `Estimado responsable,

Escribimos sobre el documento <b>${docLabel}</b> pendiente para la operación <b>${traficoNumber}</b>. Ha pasado <b>${daysWaiting} días</b> sin respuesta de su equipo.

Este documento es necesario para el despacho aduanal. Sin él, la operación no puede avanzar.

Agradecemos su atención inmediata.

Renato Zapata & Company
Patente 3596 · Aduana 240 · Nuevo Laredo`
  }

  return ''
}

// ── Send email via Resend ────────────────────────────────────────────────────

async function sendEmail(to, subject, htmlBody) {
  if (!RESEND_API_KEY) {
    console.log(`  [Resend skip] ${subject}`)
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: `<div style="font-family: Geist, sans-serif; font-size: 14px; line-height: 1.6; color: #1A1A1A;">${htmlBody.replace(/\n/g, '<br>')}</div>`,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`  Resend error: ${err}`)
    return false
  }
  return true
}

// ── Send WhatsApp via Twilio ─────────────────────────────────────────────────

async function sendWhatsApp(phone, message) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WHATSAPP) {
    console.log(`  [WhatsApp skip — Twilio not configured]`)
    return false
  }

  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP,
    To: to,
    Body: message,
  })

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error(`  WhatsApp error: ${err}`)
    return false
  }
  return true
}

// ── Resolve supplier contact info ────────────────────────────────────────────

async function getSupplierContact(supplierCode, companyId) {
  if (!supplierCode) return null

  const { data } = await supabase
    .from('supplier_contacts')
    .select('supplier_name, contact_name, contact_email, contact_phone')
    .eq('proveedor', supplierCode)
    .limit(1)
    .maybeSingle()

  return data
}

// ── Main escalation loop ─────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now()
  console.log(`\nCRUZ Document Wrangler`)
  console.log(`  ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}\n`)

  const companyId = process.env.DEFAULT_COMPANY_ID || 'evco'

  // Fetch all pending solicitations that were sent (have email_sent_at)
  const { data: pending, error } = await supabase
    .from('documento_solicitudes')
    .select('id, trafico_id, doc_type, solicitado_at, solicitado_a, escalation_level, escalate_after')
    .eq('status', 'solicitado')
    .not('solicitado_at', 'is', null)
    .order('solicitado_at', { ascending: true })

  if (error) {
    await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`)
    throw new Error(`Query failed: ${error.message}`)
  }

  if (!pending || pending.length === 0) {
    console.log('No pending solicitations to escalate.\n')
    await logPipeline('check', 'completed', 'No pending solicitations')
    return
  }

  console.log(`Found ${pending.length} pending solicitation(s)\n`)

  let escalated = 0
  let emailsSent = 0
  let whatsappSent = 0
  let flagged = 0
  let skipped = 0

  for (const sol of pending) {
    const hours = hoursSince(sol.solicitado_at)
    const currentLevel = sol.escalation_level || 0
    const newLevel = getEscalationLevel(hours)

    // Skip if already at this escalation level or higher
    if (newLevel <= currentLevel) {
      skipped++
      continue
    }

    const docLabel = DOC_LABELS[sol.doc_type] || sol.doc_type
    const daysWaiting = Math.floor(hours / 24)
    console.log(`  ${sol.trafico_id} · ${docLabel} · ${Math.round(hours)}h · Level ${currentLevel} → ${newLevel}`)

    // Resolve supplier contact for email/WhatsApp
    // Try to get supplier from tráfico
    const { data: traf } = await supabase
      .from('traficos')
      .select('proveedor, cve_proveedor')
      .eq('trafico', sol.trafico_id)
      .eq('company_id', companyId)
      .maybeSingle()

    const contact = traf?.cve_proveedor
      ? await getSupplierContact(traf.cve_proveedor, companyId)
      : null

    const contactEmail = contact?.contact_email || sol.solicitado_a
    const contactName = contact?.contact_name || null
    const contactPhone = contact?.contact_phone || null

    // Level 1-3: Send escalation email
    if (newLevel >= 1 && newLevel <= 3 && contactEmail) {
      const subject = getEmailSubject(newLevel, docLabel, sol.trafico_id)
      const body = getEmailBody(newLevel, contactName, docLabel, sol.trafico_id, daysWaiting)
      const sent = await sendEmail(contactEmail, subject, body)
      if (sent) emailsSent++
    }

    // Level 2+: Also send WhatsApp if phone available
    if (newLevel >= 2 && contactPhone) {
      const whatsMsg = `Recordatorio: el documento ${docLabel} para operación ${sol.trafico_id} lleva ${daysWaiting} días pendiente. — Renato Zapata & Co.`
      const sent = await sendWhatsApp(contactPhone, whatsMsg)
      if (sent) whatsappSent++
    }

    // Level 3: Notify Tito via Telegram
    if (newLevel >= 3) {
      await sendTelegram(
        `🟠 <b>Escalación Nivel ${newLevel}</b>\n` +
        `Documento: ${docLabel}\n` +
        `Tráfico: ${sol.trafico_id}\n` +
        `Proveedor: ${traf?.proveedor || 'Desconocido'}\n` +
        `Pendiente: ${daysWaiting} días\n` +
        `Contacto: ${contactEmail || 'Sin email'}`
      )
    }

    // Level 4: Flag for manual intervention
    if (newLevel >= 4) {
      await supabase
        .from('documento_solicitudes')
        .update({ status: 'vencida' })
        .eq('id', sol.id)
      flagged++

      await sendTelegram(
        `🔴 <b>INTERVENCIÓN MANUAL</b>\n` +
        `${docLabel} para ${sol.trafico_id} lleva ${daysWaiting} días.\n` +
        `CRUZ agotó todos los canales. Requiere llamada directa.`
      )
    }

    // Update escalation_level
    await supabase
      .from('documento_solicitudes')
      .update({ escalation_level: newLevel })
      .eq('id', sol.id)

    escalated++

    // Log escalation to pipeline_log
    await logPipeline('escalate', 'completed', {
      trafico_id: sol.trafico_id,
      doc_type: sol.doc_type,
      from_level: currentLevel,
      to_level: newLevel,
      email_sent: !!contactEmail,
      whatsapp_sent: newLevel >= 2 && !!contactPhone,
    })
  }

  // Update supplier response metrics
  // Check for solicitudes that were fulfilled since last run
  const { data: fulfilled } = await supabase
    .from('documento_solicitudes')
    .select('trafico_id, doc_type, solicitado_at, recibido_at')
    .eq('status', 'recibido')
    .not('recibido_at', 'is', null)
    .not('solicitado_at', 'is', null)
    .gte('recibido_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())

  if (fulfilled && fulfilled.length > 0) {
    for (const f of fulfilled) {
      const responseHours = hoursSince(f.solicitado_at) - hoursSince(f.recibido_at)
      // Get supplier from tráfico for profile update
      const { data: t } = await supabase
        .from('traficos')
        .select('cve_proveedor')
        .eq('trafico', f.trafico_id)
        .eq('company_id', companyId)
        .maybeSingle()

      if (t?.cve_proveedor) {
        // Update supplier avg response time (moving average)
        const { data: profile } = await supabase
          .from('supplier_profiles')
          .select('avg_turnaround_days')
          .eq('supplier_code', t.cve_proveedor)
          .eq('company_id', companyId)
          .maybeSingle()

        if (profile) {
          const currentAvg = profile.avg_turnaround_days || responseHours / 24
          const newAvg = (currentAvg * 0.8) + ((responseHours / 24) * 0.2) // Exponential moving average
          await supabase
            .from('supplier_profiles')
            .update({ avg_turnaround_days: Math.round(newAvg * 100) / 100, computed_at: new Date().toISOString() })
            .eq('supplier_code', t.cve_proveedor)
            .eq('company_id', companyId)
        }
      }
    }
    console.log(`  Updated ${fulfilled.length} supplier response metric(s)`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const summary = `${escalated} escalated · ${emailsSent} emails · ${whatsappSent} WhatsApp · ${flagged} flagged · ${skipped} skipped · ${elapsed}s`
  console.log(`\n${summary}`)

  // Log to heartbeat
  await supabase.from('heartbeat_log').insert({
    script: SCRIPT_NAME,
    status: 'success',
    details: { escalated, emails_sent: emailsSent, whatsapp_sent: whatsappSent, flagged, skipped, elapsed_s: parseFloat(elapsed) },
  }).then(() => {}, () => {})

  // Telegram summary (only if something happened)
  if (escalated > 0) {
    await sendTelegram(`📋 <b>Document Wrangler</b>\n${summary}`)
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
