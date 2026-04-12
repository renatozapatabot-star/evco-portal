#!/usr/bin/env node
/**
 * CRUZ SOLICIT Pipeline — Step 4
 * 
 * Finds pending documento_solicitudes that haven't been emailed yet,
 * groups by tráfico, generates magic upload links, sends professional
 * Spanish email via Resend, sets escalation timer (4h).
 *
 * Runs after completeness-checker (cron: 15 6 * * *)
 * Also safe to run manually: node scripts/solicitud-email.js
 *
 * Requires: upload_tokens table, Resend API key, documento_solicitudes table
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const SCRIPT_NAME = 'solicitud-email'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const RESEND_API_KEY = process.env.RESEND_API_KEY
const PORTAL_URL = 'https://evco-portal.vercel.app'
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Client contacts (expand as clients are added) ──
const CLIENT_CONTACTS = {
  evco: {
    name: 'Ursula Banda',
    email: 'ursula.banda@evco.com.mx',
    company: 'EVCO Plastics de México'
  }
  // mafesa: { name: '...', email: '...', company: 'MAFESA' }
}

// ── Helpers ──

async function tg(msg) {
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function logPipeline(step, status, details) {
  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(status === 'error' && { error_message: details?.error || JSON.stringify(details) })
  }).catch(() => {})
}

function docTypeLabel(type) {
  const labels = {
    FACTURA_COMERCIAL: 'Factura Comercial',
    LISTA_EMPAQUE: 'Lista de Empaque / Packing List',
    CONOCIMIENTO_EMBARQUE: 'Conocimiento de Embarque / Bill of Lading',
    CERTIFICADO_ORIGEN: 'Certificado de Origen',
    CARTA_PORTE: 'Carta Porte',
    MANIFESTACION_VALOR: 'Manifestación de Valor',
    PEDIMENTO: 'Pedimento',
    NOM: 'Certificado NOM',
    COA: 'Certificado de Análisis',
    ORDEN_COMPRA: 'Orden de Compra',
    ENTRADA_BODEGA: 'Entrada de Bodega',
    PERMISO: 'Permiso de Importación'
  }
  return labels[type] || type
}

// ── Email template ──

function buildEmailHtml(contact, traficoId, missingDocs, uploadUrl) {
  const docList = missingDocs.map(d => 
    `<li style="margin-bottom:6px;font-size:15px;">${docTypeLabel(d)}</li>`
  ).join('\n')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="border-bottom:3px solid #C9A84C;padding-bottom:12px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:18px;color:#1A1A1A;">Renato Zapata & Company</h2>
    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;">Patente 3596 · Aduana 240 · Nuevo Laredo</p>
  </div>

  <p style="font-size:15px;">Estimada <strong>${contact.name}</strong>,</p>

  <p style="font-size:15px;">
    Para continuar con el despacho del tráfico <strong style="color:#C9A84C;">${traficoId}</strong>,
    requerimos los siguientes documentos:
  </p>

  <ul style="background:#FAFAF8;border:1px solid #E8E5E0;border-radius:8px;padding:16px 16px 16px 32px;margin:16px 0;">
    ${docList}
  </ul>

  <div style="text-align:center;margin:28px 0;">
    <a href="${uploadUrl}" 
       style="background:#C9A84C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
      Subir Documentos
    </a>
  </div>

  <p style="font-size:13px;color:#6B6B6B;margin-top:8px;text-align:center;">
    Este enlace es válido por 7 días. Puede subir múltiples archivos (PDF, JPG, PNG, XLSX).
  </p>

  <hr style="border:none;border-top:1px solid #E8E5E0;margin:24px 0;">

  <p style="font-size:13px;color:#6B6B6B;">
    Este mensaje fue generado automáticamente por el sistema CRUZ.<br>
    Para consultas: <a href="mailto:ai@renatozapata.com">ai@renatozapata.com</a>
  </p>

</body>
</html>`
}

// ── Send email via Resend ──

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log('   ⚠️  RESEND_API_KEY not set — skipping email')
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.id // Resend email ID
}

// ── Main ──

async function run() {
  const startTime = Date.now()
  console.log(`\n📧 CRUZ SOLICIT Pipeline`)
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log(`   Patente 3596 · Aduana 240`)
  console.log('═'.repeat(50))

  // 1. Find unsent solicitudes (solicitado_a IS NULL = email not sent)
  const { data: pending, error } = await supabase
    .from('documento_solicitudes')
    .select('*')
    .eq('status', 'solicitado')
    .is('email_sent_at', null)
    .order('solicitado_at', { ascending: true })

  if (error) {
    console.error('❌ Query error:', error.message)
    await logPipeline('query', 'error', { error: error.message })
    await tg(`🔴 <b>${SCRIPT_NAME}</b> query failed: ${error.message}`)
    process.exit(1)
  }

  if (!pending?.length) {
    console.log('   ✅ No pending solicitudes to email')
    process.exit(0)
  }

  console.log(`   Found ${pending.length} unsent solicitudes`)

  // 2. Group by tráfico_id + company_id
  const grouped = {}
  for (const s of pending) {
    const key = `${s.company_id}:${s.trafico_id}`
    if (!grouped[key]) {
      grouped[key] = { company_id: s.company_id, trafico_id: s.trafico_id, docs: [], ids: [] }
    }
    grouped[key].docs.push(s.doc_type)
    grouped[key].ids.push(s.id)
  }

  const traficos = Object.values(grouped)
  console.log(`   Grouped into ${traficos.length} tráficos`)

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const group of traficos) {
    const contact = CLIENT_CONTACTS[group.company_id]
    if (!contact) {
      console.log(`   ⚠️  No contact for company ${group.company_id} — skipping ${group.trafico_id}`)
      skipped += group.ids.length
      continue
    }

    try {
      // 3. Generate upload token
      const token = crypto.randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

      const { error: tokenErr } = await supabase.from('upload_tokens').insert({
        token,
        trafico_id: group.trafico_id,
        company_id: group.company_id,
        required_docs: group.docs,
        contact_email: contact.email,
        contact_name: contact.name,
        solicitud_ids: group.ids,
        expires_at: expiresAt
      })

      if (tokenErr) {
        console.error(`   ❌ Token creation failed for ${group.trafico_id}: ${tokenErr.message}`)
        errors++
        continue
      }

      const uploadUrl = `${PORTAL_URL}/upload/${token}`

      // 4. Send email
      const subject = `Documentos requeridos — Tráfico ${group.trafico_id}`
      const html = buildEmailHtml(contact, group.trafico_id, group.docs, uploadUrl)
      const emailId = await sendEmail(contact.email, subject, html)

      if (!emailId) {
        skipped += group.ids.length
        continue
      }

      // 5. Update solicitudes — mark as emailed, set escalation timer (4h)
      const escalateAfter = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

      for (const id of group.ids) {
        await supabase.from('documento_solicitudes').update({
          solicitado_a: contact.email,
          email_sent_at: new Date().toISOString(),
          escalate_after: escalateAfter,
          upload_token_id: null // could link if needed
        }).eq('id', id)
      }

      sent += group.ids.length
      console.log(`   ✅ ${group.trafico_id} → ${contact.email} (${group.docs.length} docs, token: ${token.substring(0, 8)}...)`)

      await logPipeline('email_sent', 'success', {
        trafico: group.trafico_id,
        to: contact.email,
        docs: group.docs,
        resend_id: emailId
      })

    } catch (err) {
      console.error(`   ❌ Failed for ${group.trafico_id}: ${err.message}`)
      errors++
      await logPipeline('email_send', 'error', { trafico: group.trafico_id, error: err.message })
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(50))
  console.log('📊 SOLICIT SUMMARY')
  console.log(`   Solicitudes emailed: ${sent}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
  console.log(`   Duration: ${duration}s`)

  await logPipeline('complete', errors > 0 ? 'partial' : 'success', {
    sent, skipped, errors, duration
  })

  if (sent > 0) {
    await tg(
      `📧 <b>SOLICIT</b> — ${sent} docs solicitados\n` +
      traficos.filter(t => CLIENT_CONTACTS[t.company_id]).map(t =>
        `  ${t.trafico_id}: ${t.docs.join(', ')}`
      ).join('\n') +
      `\n— CRUZ 🦀`
    )
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await tg(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}`)
  process.exit(1)
})
