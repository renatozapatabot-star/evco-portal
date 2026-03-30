#!/usr/bin/env node
// scripts/supplier-comms.js — Automated supplier T-MEC certificate requests
// Queries IGI=0 facturas, checks for missing USMCA certs, drafts & queues comms

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GMAIL_TOKEN = process.env.GMAIL_REFRESH_TOKEN

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function draftEmail(supplier, traficos) {
  if (!ANTHROPIC_KEY) return fallbackDraft(supplier, traficos)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 512,
      messages: [{ role: 'user', content:
        `Draft a professional email in Spanish requesting USMCA/T-MEC certificates of origin from supplier "${supplier.name}" (${supplier.email || 'no email'}).
Traficos missing certificates: ${traficos.join(', ')}.
Tone: polite but firm. Mention compliance deadline. Keep under 200 words. Return subject line on first line prefixed "Asunto:", then body.` }]
    })
  })
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  const lines = text.split('\n')
  const subjectLine = lines.find(l => l.startsWith('Asunto:')) || lines[0]
  const subject = subjectLine.replace(/^Asunto:\s*/, '').trim()
  const body = lines.filter(l => l !== subjectLine).join('\n').trim()
  return { subject: subject || 'Solicitud de Certificado T-MEC', body: body || text }
}

function fallbackDraft(supplier, traficos) {
  return {
    subject: `Solicitud de Certificado T-MEC — ${supplier.name}`,
    body: `Estimado proveedor ${supplier.name},\n\nPor medio de la presente solicitamos el envío del Certificado de Origen T-MEC/USMCA para los siguientes tráficos: ${traficos.join(', ')}.\n\nAgradecemos su pronta respuesta.\n\nSaludos cordiales,\nRenato Zapata III — Director General\nRenato Zapata & Company`
  }
}

async function sendGmail(to, subject, body) {
  if (!GMAIL_TOKEN) return false
  try {
    const raw = Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`
    ).toString('base64url')
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${GMAIL_TOKEN}&client_id=${process.env.GMAIL_CLIENT_ID}&client_secret=${process.env.GMAIL_CLIENT_SECRET}`
    })
    const { access_token } = await tokenRes.json()
    if (!access_token) return false
    await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw })
    })
    return true
  } catch (e) { console.error('Gmail send error:', e.message); return false }
}

async function main() {
  console.log('--- Supplier T-MEC Certificate Comms ---')

  // 1. Find T-MEC eligible facturas (igi=0) with supplier info
  const { data: facturas, error } = await supabase
    .from('globalpc_facturas')
    .select('cve_trafico, cve_proveedor')
    .eq('igi', 0)
  if (error) { console.error('Query error:', error.message); process.exit(1) }
  if (!facturas?.length) { console.log('No T-MEC eligible facturas found.'); return }

  // 2. Check which traficos already have USMCA certs
  const traficoList = [...new Set(facturas.map(f => f.cve_trafico))]
  const { data: docs } = await supabase
    .from('documents')
    .select('metadata')
    .in('document_type', ['usmca_certificate', 'tmec_certificate', 'certificate_of_origin'])
  const certifiedTraficos = new Set((docs || []).map(d => d.metadata?.trafico).filter(Boolean))
  const missing = facturas.filter(f => !certifiedTraficos.has(f.cve_trafico))

  // 3. Group by supplier
  const bySupplier = {}
  for (const f of missing) {
    const key = f.cve_proveedor || 'UNKNOWN'
    if (!bySupplier[key]) bySupplier[key] = []
    bySupplier[key].push(f.cve_trafico)
  }

  // 4. Fetch supplier contacts
  const supplierKeys = Object.keys(bySupplier).filter(k => k !== 'UNKNOWN')
  const { data: suppliers } = supplierKeys.length
    ? await supabase.from('supplier_network').select('*').in('supplier_code', supplierKeys)
    : { data: [] }
  const supplierMap = Object.fromEntries((suppliers || []).map(s => [s.supplier_code, s]))

  // 5. Draft and queue communications
  let contacted = 0, queued = 0
  for (const [code, traficos] of Object.entries(bySupplier)) {
    const supplier = supplierMap[code] || { name: code, email: null, supplier_code: code }
    const uniqueTraficos = [...new Set(traficos)]
    const { subject, body } = await draftEmail(supplier, uniqueTraficos)
    const sent = supplier.email ? await sendGmail(supplier.email, subject, body) : false

    await supabase.from('communication_events').insert({
      company_id: 'evco',
      event_type: 'tmec_cert_request',
      channel: sent ? 'email' : 'pending',
      recipient: supplier.email || code,
      subject,
      body,
      status: sent ? 'sent' : 'pending',
      metadata: { supplier_code: code, traficos: uniqueTraficos, auto_generated: true },
      created_at: new Date().toISOString()
    })
    if (sent) contacted++
    queued++
  }

  // 6. Summary
  const summary = `${contacted} suppliers contacted, ${missing.length} certificates missing, ${queued} emails queued`
  console.log(summary)
  await sendTG(`<b>T-MEC Cert Comms</b>\n${contacted} proveedores contactados\n${missing.length} certificados faltantes\n${queued} correos en cola\n— CRUZ`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
