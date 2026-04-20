#!/usr/bin/env npx tsx
/**
 * Cold outreach campaign runner.
 *
 * Tuesday 2026-04-21 · 10:00 CT launch. Reads a validated batch CSV,
 * renders a per-recipient PDF, sends via Resend with attachment, throttles
 * 1-per-90s (humanized, not synchronized), retries once on transient
 * failure, logs every send to JSONL.
 *
 * Modes:
 *   --dry-run   Render HTML + PDF to tmp/cold-preview-<n>.{html,pdf} for
 *               the first 3 rows. No sends. No logs. No Telegram.
 *   --test-to   Send ONE email to a single address (usually your own) using
 *               row[0] as the recipient data. Warms the inbox, tests
 *               deliverability, confirms attachment renders.
 *   --live      Fire for real. 5-second cancellation window before first
 *               send. Telegram milestones at start / 50 / 100 / finish /
 *               errors.
 *
 * Env required:
 *   RESEND_API_KEY             — from .env.local
 *   TELEGRAM_BOT_TOKEN         — optional; if missing, logs to stdout
 *   TELEGRAM_CHAT_ID           — optional; same
 *   COLD_OUTREACH_PHONE        — optional; appears in PDF CTA if set
 *   COLD_OUTREACH_WHATSAPP     — optional; appears in PDF CTA if set
 *   COLD_OUTREACH_CALENDLY     — optional; appears in PDF CTA if set
 *
 * Usage:
 *   npx tsx scripts/cold-outreach/send-campaign.ts \
 *     --csv data/cold-batch-2026-04-21.csv \
 *     --campaign cold-2026-04-21 \
 *     [--dry-run | --test-to you@example.com | --live] \
 *     [--throttle-ms 90000]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import * as dotenv from 'dotenv'
import { renderToBuffer } from '@react-pdf/renderer'

dotenv.config({ path: new URL('../../.env.local', import.meta.url).pathname })

import { PitchPDF, type PitchData } from './pitch-pdf'
import {
  subject as buildSubject,
  bodyHtml,
  bodyText,
  unsubHeaders,
  type Recipient,
  type CTA,
} from './templates'

// ── CLI ─────────────────────────────────────────────────────────────
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  return process.argv[i + 1]
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const csvPath = arg('csv', 'data/cold-batch-2026-04-21.csv')!
const campaignId = arg('campaign', 'cold-2026-04-21')!
const throttleMs = parseInt(arg('throttle-ms', '90000') || '90000', 10)
const isDryRun = flag('dry-run')
const isLive = flag('live')
const testTo = arg('test-to')

if (!isDryRun && !isLive && !testTo) {
  console.error('Specify one of --dry-run | --test-to <email> | --live')
  process.exit(2)
}

// ── Config ──────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'
const PORTAL_URL = 'portal.renatozapata.com'
const REPLY_TO = 'ai@renatozapata.com'

const cta: CTA = {
  email: 'ai@renatozapata.com',
  phone: process.env.COLD_OUTREACH_PHONE || undefined,
  whatsapp: process.env.COLD_OUTREACH_WHATSAPP || undefined,
  calendly: process.env.COLD_OUTREACH_CALENDLY || undefined,
  portalUrl: PORTAL_URL,
}

// ── Telegram (infrastructure-only, per CLAUDE.md rule) ──────────────
async function telegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  const silent = process.env.TELEGRAM_SILENT === 'true'
  if (!token || !chatId) {
    console.log(`[telegram] ${message}`)
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_notification: silent }),
    })
  } catch {
    console.log(`[telegram-fail] ${message}`)
  }
}

// ── Resend send with attachment ─────────────────────────────────────
interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  statusCode?: number
}

async function sendWithAttachment(params: {
  to: string
  subject: string
  html: string
  text: string
  pdfBuffer: Uint8Array
  pdfFilename: string
  headers?: Record<string, string>
}): Promise<SendResult> {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [params.to],
        reply_to: REPLY_TO,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: [
          {
            filename: params.pdfFilename,
            content: Buffer.from(params.pdfBuffer).toString('base64'),
          },
        ],
        headers: params.headers,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.message || res.statusText, statusCode: res.status }
    return { success: true, messageId: data?.id, statusCode: res.status }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

// ── CSV loader ──────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function loadRecipients(csvAbs: string): Recipient[] {
  const rows = parseCsv(fs.readFileSync(csvAbs, 'utf8')).filter(r => r.length > 1 && r.some(c => c.trim()))
  if (rows.length < 2) throw new Error(`CSV has no data rows: ${csvAbs}`)
  const header = rows[0].map(h => h.trim().toLowerCase())
  const idx = (n: string) => header.indexOf(n)
  const out: Recipient[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    out.push({
      email: (r[idx('email')] || '').trim().toLowerCase(),
      company: (r[idx('company')] || '').trim(),
      firstName: idx('first_name') >= 0 ? (r[idx('first_name')] || '').trim() : undefined,
      industry: idx('industry') >= 0 ? (r[idx('industry')] || '').trim() : undefined,
      state: idx('state') >= 0 ? (r[idx('state')] || '').trim() : undefined,
      city: idx('city') >= 0 ? (r[idx('city')] || '').trim() : undefined,
      rfc: idx('rfc') >= 0 ? (r[idx('rfc')] || '').trim() || undefined : undefined,
      unsubToken: (r[idx('unsub_token')] || '').trim(),
      campaignId: (r[idx('campaign_id')] || campaignId).trim(),
    })
  }
  return out
}

// ── PDF generation ──────────────────────────────────────────────────
function fechaEs(d: Date): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${String(d.getDate()).padStart(2, '0')} de ${months[d.getMonth()]}, ${d.getFullYear()}`
}

function opinionRef(campaign: string, idx: number): string {
  const n = String(idx + 1).padStart(3, '0')
  const short = campaign.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()
  return `RZC-${short}-${n}`
}

async function renderPdf(r: Recipient, idx: number): Promise<{ buffer: Uint8Array; filename: string; ref: string }> {
  const ref = opinionRef(r.campaignId || campaignId, idx)
  const data: PitchData = {
    recipientCompany: r.company,
    recipientFirstName: r.firstName,
    generatedDate: fechaEs(new Date()),
    opinionRef: ref,
    portalUrl: PORTAL_URL,
    cta,
  }
  const buffer = await renderToBuffer(PitchPDF({ data }))
  const safeCo = r.company.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)
  const filename = `RenatoZapata-${safeCo}.pdf`
  return { buffer: new Uint8Array(buffer), filename, ref }
}

// ── Logging ─────────────────────────────────────────────────────────
function logPath(campaign: string, kind: 'sent' | 'error'): string {
  const dir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `outreach-${kind}-${campaign}.jsonl`)
}

function appendJsonl(file: string, obj: unknown): void {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n')
}

// ── Cancellation window (5 sec · approval gate rule) ────────────────
async function cancellationWindow(seconds: number, recipients: Recipient[], sample: number): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  console.log('')
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`  LIVE COLD OUTREACH · campaign=${campaignId}`)
  console.log(`  recipients: ${recipients.length}`)
  console.log(`  throttle:   ${(throttleMs / 1000).toFixed(0)}s between sends`)
  console.log(`  est. finish: ${Math.ceil((recipients.length * throttleMs) / 1000 / 60)} min`)
  console.log('')
  console.log('  First 3 recipients:')
  for (const r of recipients.slice(0, sample)) {
    console.log(`    ${r.email.padEnd(38)} ${r.company.slice(0, 36)}`)
  }
  console.log('')
  console.log(`  Ctrl-C within ${seconds}s to cancel.`)
  console.log('─────────────────────────────────────────────────────────────')
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r  Firing in ${i}s ... `)
    await new Promise(r => setTimeout(r, 1000))
  }
  process.stdout.write('\r  Firing now.                \n')
  rl.close()
}

// ── Dry run ─────────────────────────────────────────────────────────
async function dryRun(recipients: Recipient[]): Promise<void> {
  const tmp = path.resolve(process.cwd(), 'tmp')
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  const sample = recipients.slice(0, 3)
  console.log(`\nDry-run: rendering ${sample.length} previews to ${tmp}/\n`)
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    const { buffer, filename, ref } = await renderPdf(r, i)
    const htmlPath = path.join(tmp, `cold-preview-${i + 1}.html`)
    const pdfPath = path.join(tmp, `cold-preview-${i + 1}.pdf`)
    fs.writeFileSync(htmlPath, bodyHtml(r, cta))
    fs.writeFileSync(pdfPath, buffer)
    console.log(`  ${i + 1}. ${r.email} · ${r.company}`)
    console.log(`     subject: ${buildSubject(r)}`)
    console.log(`     ref:     ${ref}`)
    console.log(`     html:    ${htmlPath}`)
    console.log(`     pdf:     ${pdfPath}  (${(buffer.length / 1024).toFixed(0)} KB)`)
  }
  console.log(`\n✓ Dry-run complete. Open the previews; verify before --live.\n`)
}

// ── Live send ───────────────────────────────────────────────────────
async function liveRun(recipients: Recipient[]): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('✗ RESEND_API_KEY is not set. Check .env.local. Aborting.')
    process.exit(1)
  }

  const sentLog = logPath(campaignId, 'sent')
  const errLog = logPath(campaignId, 'error')

  await cancellationWindow(5, recipients, 3)
  await telegram(`📧 Cold outreach STARTED · campaign=${campaignId} · recipients=${recipients.length}`)

  const t0 = Date.now()
  let sent = 0
  let failed = 0
  const milestones = new Set([50, 100, 150, 200, 250, 300])

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    let attempt = 0
    let result: SendResult = { success: false, error: 'not-attempted' }
    let ref = ''
    let attachmentBytes = 0

    while (attempt < 2 && !result.success) {
      attempt++
      try {
        const pdf = await renderPdf(r, i)
        ref = pdf.ref
        attachmentBytes = pdf.buffer.length
        result = await sendWithAttachment({
          to: r.email,
          subject: buildSubject(r),
          html: bodyHtml(r, cta),
          text: bodyText(r, cta),
          pdfBuffer: pdf.buffer,
          pdfFilename: pdf.filename,
          headers: unsubHeaders(r, cta),
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result = { success: false, error: msg }
      }
      if (!result.success && attempt < 2) {
        await new Promise(res => setTimeout(res, 5_000))
      }
    }

    const record = {
      ts: new Date().toISOString(),
      campaign: campaignId,
      idx: i + 1,
      email: r.email,
      company: r.company,
      ref,
      attachment_bytes: attachmentBytes,
      attempts: attempt,
      success: result.success,
      message_id: result.messageId,
      error: result.error,
      status_code: result.statusCode,
    }

    if (result.success) {
      sent++
      appendJsonl(sentLog, record)
      console.log(`  ✓ ${i + 1}/${recipients.length}  ${r.email.padEnd(38)} ${r.company.slice(0, 30)}`)
    } else {
      failed++
      appendJsonl(errLog, record)
      console.log(`  ✗ ${i + 1}/${recipients.length}  ${r.email.padEnd(38)} ${result.error || 'unknown error'}`)
    }

    if (milestones.has(sent)) {
      await telegram(`📧 ${sent}/${recipients.length} sent · ${failed} errors · campaign=${campaignId}`)
    }

    // Throttle (not after last send).
    if (i < recipients.length - 1) {
      await new Promise(res => setTimeout(res, throttleMs))
    }
  }

  const minutes = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  const summary = `✅ Cold outreach FINISHED · sent=${sent} · failed=${failed} · duration=${minutes}min · campaign=${campaignId}`
  console.log('')
  console.log(summary)
  console.log(`  sent log:  ${sentLog}`)
  console.log(`  error log: ${errLog}`)
  await telegram(summary)
}

// ── Single test send ───────────────────────────────────────────────
async function testRun(recipients: Recipient[], toEmail: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('✗ RESEND_API_KEY is not set. Aborting.')
    process.exit(1)
  }
  if (recipients.length === 0) {
    console.error('✗ CSV empty — need at least 1 row for data substitution.')
    process.exit(1)
  }
  const r: Recipient = { ...recipients[0], email: toEmail }
  const { buffer, filename, ref } = await renderPdf(r, 0)
  console.log(`\nTest send → ${toEmail}`)
  console.log(`  impersonating:  ${recipients[0].email}`)
  console.log(`  company:        ${r.company}`)
  console.log(`  ref:            ${ref}`)
  console.log(`  subject:        ${buildSubject(r)}`)
  console.log(`  attachment:     ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
  const result = await sendWithAttachment({
    to: r.email,
    subject: buildSubject(r),
    html: bodyHtml(r, cta),
    text: bodyText(r, cta),
    pdfBuffer: buffer,
    pdfFilename: filename,
    headers: unsubHeaders(r, cta),
  })
  if (result.success) {
    console.log(`\n✓ Sent. messageId=${result.messageId}`)
    console.log(`  Check inbox placement: Primary / Promotions / Spam?`)
  } else {
    console.error(`\n✗ Failed: ${result.error}`)
    process.exit(1)
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const absCsv = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath)
  if (!fs.existsSync(absCsv)) {
    console.error(`✗ CSV not found: ${absCsv}`)
    console.error(`  Generate with: npx tsx scripts/cold-outreach/build-batch.ts --in <apollo.csv>`)
    process.exit(1)
  }
  const recipients = loadRecipients(absCsv)

  if (isDryRun) await dryRun(recipients)
  else if (testTo) await testRun(recipients, testTo)
  else if (isLive) await liveRun(recipients)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
