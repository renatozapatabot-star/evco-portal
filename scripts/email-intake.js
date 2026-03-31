#!/usr/bin/env node
// scripts/email-intake.js
// ============================================================================
// CRUZ Email Intake Pipeline — Multi-Inbox
//
// ai@renatozapata.com          → FULL (extract, classify, draft, notify)
// eloisarangel@renatozapata.com → STUDY (extract → email_intelligence)
// claudia@renatozapata.com      → STUDY (extract → email_intelligence)
//
// Auth: Google Workspace domain-wide delegation via service account.
// Fallback: OAuth2 refresh token for ai@ (legacy).
// ============================================================================

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')
const { getAllRates } = require('./lib/rates')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER
const TITO_PHONE = process.env.TITO_PHONE

const INTAKE_INBOX = process.env.INTAKE_INBOX || 'ai@renatozapata.com'
const STUDY_INBOXES = (process.env.STUDY_INBOXES || '').split(',').map(s => s.trim()).filter(Boolean)
const ALL_INBOXES = [{ email: INTAKE_INBOX, mode: 'full' }, ...STUDY_INBOXES.map(email => ({ email, mode: 'study' }))]

// ── Auth ──────────────────────────────────────────────────────────────────

function getServiceAccountAuth(impersonateEmail) {
  const keyPath = path.join(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'credentials/cruz-email-reader.json')
  if (!fs.existsSync(keyPath)) return null
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  return new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/gmail.readonly'], subject: impersonateEmail })
}

function getOAuthAuth() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) return null
  const o = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground')
  o.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return o
}

function getGmailForInbox(email) {
  const sa = getServiceAccountAuth(email)
  if (sa) return google.gmail({ version: 'v1', auth: sa })
  if (email === INTAKE_INBOX) { const o = getOAuthAuth(); if (o) return google.gmail({ version: 'v1', auth: o }) }
  return null
}

function hdr(headers, name) { return (headers?.find(h => h.name?.toLowerCase() === name.toLowerCase()))?.value || '' }

// ── Notifications ─────────────────────────────────────────────────────────

async function sendTG(msg, inlineKeyboard) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  const payload = { chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }
  if (inlineKeyboard) payload.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard })
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

async function sendWA(to, body) {
  if (!TWILIO_SID || !to) return
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64') },
    body: new URLSearchParams({ From: `whatsapp:${TWILIO_FROM}`, To: `whatsapp:${to}`, Body: body }).toString(),
  }).catch(() => {})
}

// ── Anthropic ─────────────────────────────────────────────────────────────

async function callAI(model, system, content, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'pdfs-2024-09-25' },
    body: JSON.stringify({ model, max_tokens: maxTokens || 4096, system, messages: [{ role: 'user', content }] }),
  })
  const d = await res.json()
  if (d.error) throw new Error(`${model}: ${d.error.message}`)
  return d.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || ''
}

function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]) } catch {} }
  return null
}

async function extractInvoice(b64, mime, filename, subject) {
  const sys = 'Extract invoice data. Return ONLY valid JSON: {supplier, country(2-letter), invoice_number, invoice_date(YYYY-MM-DD), currency(USD|MXN), products:[{description, description_en, qty, unit(KG|PZA|LT|M2|PAR), unit_price, valor_usd, hs_code_hint}], valor_total_usd, incoterm, notes}'
  const text = await callAI('claude-sonnet-4-20250514', sys, [
    { type: 'document', source: { type: 'base64', media_type: mime || 'application/pdf', data: b64 } },
    { type: 'text', text: `File: ${filename}\nSubject: ${subject}\nExtract all data. ONLY JSON.` },
  ])
  return parseJSON(text)
}

async function lookupSupplierPattern(supplier) {
  if (!supplier) return null
  try {
    const { data } = await supabase.from('email_intelligence')
      .select('fraccion').ilike('supplier', `%${supplier}%`).not('fraccion', 'is', null)
    if (!data?.length) return null
    const counts = {}
    for (const row of data) counts[row.fraccion] = (counts[row.fraccion] || 0) + 1
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? { fraccion: top[0], uses: top[1] } : null
  } catch { return null }
}

async function classifyProducts(products, supplierName) {
  if (!products?.length) return []
  const text = await callAI('claude-haiku-4-5-20251001',
    'Mexican customs tariff classifier. Return ONLY JSON array: [{description,fraccion(XXXX.XX.XX),confidence(0-100)}]. Common: Polipropileno 3902.10.01, Polietileno 3901.20.01, Masterbatch 3206.49.99, Moldes 8480.71.01, Etiquetas 4821.10.01',
    JSON.stringify(products.map(p => ({ description: p.description || p.description_en, qty: p.qty, unit: p.unit }))), 2048)
  let cls = []
  try { cls = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) } catch { return [] }

  // Fallback: when Haiku returns 0% confidence, check email_intelligence
  for (let i = 0; i < cls.length; i++) {
    if (cls[i].confidence === 0 || !cls[i].fraccion) {
      const pattern = await lookupSupplierPattern(supplierName)
      if (pattern) {
        console.log(`        📚 email_intelligence: ${pattern.fraccion} (${pattern.uses}x) for "${supplierName}"`)
        cls[i].fraccion = pattern.fraccion
        cls[i].confidence = 70
        cls[i].source = 'email_intelligence'
      }
    }
  }
  return cls
}

// ── Draft (FULL mode) ─────────────────────────────────────────────────────

async function createDraft(inv, cls, rates, meta) {
  const products = (inv.products || []).map((p, i) => ({ description: p.description, fraccion: cls[i]?.fraccion || p.hs_code_hint || '', qty: p.qty, unit: p.unit || 'KG', valor_usd: p.valor_usd || (p.qty * p.unit_price) || 0, confidence: cls[i]?.confidence || 0 }))
  const valorUSD = inv.valor_total_usd || products.reduce((s, p) => s + p.valor_usd, 0)
  const tc = rates.exchangeRate, vmxn = valorUSD * tc
  const dta = Math.round(vmxn * (rates.dtaRates?.IMD?.rate ?? rates.dtaRates?.A1?.rate ?? 0.008))
  const iva = Math.round((vmxn + dta) * rates.ivaRate)
  const conf = products.length ? Math.round(products.reduce((s, p) => s + p.confidence, 0) / products.length) : 0

  const { data, error } = await supabase.from('pedimento_drafts').insert({
    trafico_id: `pending-${Date.now()}`, status: 'draft', created_by: 'CRUZ-email-intake', company_id: '9254',
    draft_data: { supplier: inv.supplier, country: inv.country, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, incoterm: inv.incoterm, currency: inv.currency || 'USD', products, valor_total_usd: valorUSD, tipo_cambio: tc, regimen: 'IMD', confidence: conf, contributions: { dta, igi: 0, iva, total: dta + iva, valor_mxn: vmxn }, checklist: [{ label: 'Factura comercial', status: 'ok', detail: inv.invoice_number }, { label: 'Lista de empaque', status: products.length ? 'ok' : 'warning' }, { label: 'Certificado T-MEC', status: (inv.country === 'US' || inv.country === 'CA') ? 'ok' : 'warning' }, { label: 'COVE preparado', status: 'pending' }, { label: 'Pedimento generado', status: 'pending' }, { label: 'Valor dentro de rango', status: 'pending' }], email_from: meta.from, email_subject: meta.subject, email_date: meta.date },
  }).select('id').single()
  if (error) throw new Error(`Draft: ${error.message}`)
  return { id: data.id, overallConfidence: conf, valorUSD, supplier: inv.supplier, products }
}

// ── Intel (STUDY mode) ────────────────────────────────────────────────────

async function storeIntel(inv, cls, inbox, meta) {
  const rows = (inv.products || []).map((p, i) => ({
    supplier: inv.supplier || '', country: inv.country || '', invoice_number: inv.invoice_number || '',
    fraccion: cls[i]?.fraccion || p.hs_code_hint || '', description: p.description || p.description_en || '',
    qty: p.qty || 0, unit: p.unit || '', valor_usd: p.valor_usd || (p.qty * p.unit_price) || 0,
    currency: inv.currency || 'USD', confidence: cls[i]?.confidence || 0,
    email_date: meta.date || new Date().toISOString(), email_subject: (meta.subject || '').substring(0, 500), source_inbox: inbox,
  }))
  if (!rows.length) return 0
  const { error } = await supabase.from('email_intelligence').insert(rows)
  if (error) { console.error('  ⚠️  intel:', error.message); return 0 }
  return rows.length
}

// ── Process email ─────────────────────────────────────────────────────────

// ── Entrada Lifecycle — detect warehouse receipt emails ──────────────────

async function processEntradaEmail(subject, body, from) {
  const match = subject.match(/Entrada[:\s#]*(\d+)/i)
    || subject.match(/ENT[:\s#]*(\d+)/i)
    || body.match(/Entrada[:\s#]*(\d+)/i)
  if (!match) return
  const entradaNumber = match[1]
  const supplierMatch = body.match(/(?:proveedor|supplier|shipper)[:\s]+([^\n,]{3,50})/i)
  const bultosMatch = body.match(/(\d+)\s*(?:bultos?|pkgs?|packages?)/i)
  try {
    await supabase.from('entrada_lifecycle').upsert({
      entrada_number: entradaNumber,
      company_id: process.env.NEXT_PUBLIC_COMPANY_ID || '9254',
      supplier: supplierMatch?.[1]?.trim()?.substring(0, 100) || null,
      bultos: bultosMatch ? parseInt(bultosMatch[1]) : null,
      email_received_at: new Date().toISOString(),
      email_subject: subject.substring(0, 200),
      email_from: from.substring(0, 200),
    }, { onConflict: 'entrada_number' })
    await supabase.from('notifications').insert({
      company_id: process.env.NEXT_PUBLIC_COMPANY_ID || '9254',
      type: 'entrada_received',
      title: 'Nueva entrada: ' + entradaNumber,
      body: 'Mercancía en bodega · pendiente de tráfico',
    })
    console.log(`  📦 Entrada ${entradaNumber} → entrada_lifecycle`)
  } catch (err) {
    console.error(`  ⚠️ Entrada parse error: ${err.message}`)
  }
}

async function processEmail(gmail, msgId, mode, inbox, rates) {
  const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' })
  const headers = msg.payload?.headers || []
  const from = hdr(headers, 'From'), subject = hdr(headers, 'Subject'), date = hdr(headers, 'Date')
  const snippet = msg.snippet || ''
  console.log(`  📧 ${from.substring(0, 50)}\n     ${subject.substring(0, 70)}`)

  // Check for entrada references in subject/snippet
  await processEntradaEmail(subject, snippet, from)

  const atts = []
  ;(function scan(parts) { if (!parts) return; for (const p of parts) { if (p.filename && p.body?.attachmentId) atts.push({ filename: p.filename, attachmentId: p.body.attachmentId, mimeType: p.mimeType, size: p.body.size || 0 }); if (p.parts) scan(p.parts) } })(msg.payload?.parts || [msg.payload])

  const pdfs = atts.filter(a => (a.filename||'').toLowerCase().endsWith('.pdf'))
  pdfs.sort((a, b) => { const inv = /invoice|factura|oem|so_/i; return (inv.test(a.filename)?0:1)-(inv.test(b.filename)?0:1) || b.size-a.size })
  if (!pdfs.length) { console.log('     No PDFs'); return null }

  const batch = pdfs.slice(0, mode === 'study' ? 3 : 5)
  console.log(`     📎 ${pdfs.length} PDF(s) → ${batch.length} [${mode.toUpperCase()}]`)

  const results = []
  for (let i = 0; i < batch.length; i++) {
    const att = batch[i]
    console.log(`     [${i+1}/${batch.length}] ${att.filename} (${Math.round(att.size/1024)}KB)`)
    const { data: ad } = await gmail.users.messages.attachments.get({ userId: 'me', messageId: msgId, id: att.attachmentId })
    const b64 = ad.data.replace(/-/g, '+').replace(/_/g, '/')

    console.log('        🧠 Sonnet...')
    const inv = await extractInvoice(b64, att.mimeType, att.filename, subject)
    if (!inv) { console.log('        ❌ skip'); continue }
    console.log(`        ✅ ${inv.supplier} · $${inv.valor_total_usd} ${inv.currency}`)

    console.log('        🏷️  Haiku...')
    const cls = await classifyProducts(inv.products, inv.supplier)
    console.log(`        ✅ ${cls.map(c => c.fraccion+'('+c.confidence+'%)').join(', ') || '—'}`)

    if (mode === 'full') {
      const draft = await createDraft(inv, cls, rates, { from, subject, date })
      console.log(`        📝 Draft: ${draft.id} · ${draft.overallConfidence}%`)
      results.push(draft)
    } else {
      const n = await storeIntel(inv, cls, inbox, { subject, date, from })
      console.log(`        📊 ${n} → email_intelligence`)
      results.push({ supplier: inv.supplier, products: n, mode: 'study' })
    }
  }
  return results.length ? results : null
}

// ── Main ──────────────────────────────────────────────────────────────────

async function run() {
  const t0 = Date.now()
  console.log(`\n📬 CRUZ Email Intake — Multi-Inbox`)
  console.log(`   ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
  console.log(`   ${ALL_INBOXES.map(i => i.email+' ['+i.mode+']').join(' · ')}\n`)

  const rates = await getAllRates()
  let drafts = 0, intel = 0, errs = 0

  for (const inbox of ALL_INBOXES) {
    console.log(`\n━━ ${inbox.email} [${inbox.mode.toUpperCase()}] ━━`)
    const gmail = getGmailForInbox(inbox.email)
    if (!gmail) { console.log('   ⚠️  No auth — skip'); continue }

    try {
      const { data: p } = await gmail.users.getProfile({ userId: 'me' })
      console.log(`   ✓ ${p.emailAddress} (${p.messagesTotal} msgs)`)
    } catch (e) { console.log(`   ❌ ${e.message}`); continue }

    const after = Math.floor((Date.now() - 2*3600000) / 1000)
    const q = inbox.mode === 'study'
      ? `after:${after} has:attachment (filename:pdf OR filename:xlsx)`
      : `after:${after} has:attachment is:unread (filename:pdf OR filename:xlsx OR filename:csv)`
    const { data: list } = await gmail.users.messages.list({ userId: 'me', q, maxResults: inbox.mode === 'study' ? 5 : 10 })
    const msgs = list.messages || []
    console.log(`   ${msgs.length} email(s)\n`)

    for (const m of msgs) {
      try {
        const res = await processEmail(gmail, m.id, inbox.mode, inbox.email, rates)
        if (!res) continue
        for (const r of [].concat(res)) {
          if (r.mode === 'study') { intel += r.products }
          else if (r.id) {
            drafts++
            const tier = r.overallConfidence >= 90 ? 'T1' : r.overallConfidence >= 70 ? 'T2' : 'T3'
            await sendTG(`📋 <b>Borrador CRUZ</b>\n${r.supplier}\n$${r.valorUSD.toLocaleString('en-US',{minimumFractionDigits:2})} USD · ${r.products.length} prod · ${tier}\n<a href="https://evco-portal.vercel.app/drafts/${r.id}">Revisar →</a>`, [[
              { text: '✅ Aprobar', callback_data: `aprobar_${r.id}` },
              { text: '❌ Rechazar', callback_data: `rechazar_${r.id}` },
              { text: '✏️ Corregir', callback_data: `corregir_${r.id}` },
            ]])
            if (TITO_PHONE) await sendWA(TITO_PHONE, `📋 CRUZ\n${r.supplier} · $${r.valorUSD.toLocaleString('en-US',{minimumFractionDigits:2})} USD · ${tier}\nevco-portal.vercel.app/drafts/${r.id}`)
          }
        }
      } catch (err) { errs++; console.error(`  ❌ ${err.message}`) }
      console.log('')
    }
  }

  const sec = ((Date.now()-t0)/1000).toFixed(1)
  console.log(`\n══ Done · ${sec}s · Drafts: ${drafts} · Intel: ${intel} · Errors: ${errs} ══\n`)
  if (errs > 0) await sendTG(`🔴 <b>Email Intake</b> · ${errs} error(es) · ${sec}s`)
}

run().catch(async err => { console.error('❌', err.message); await sendTG(`🔴 <b>Intake FAILED</b>\n${err.message}`); process.exit(1) })
