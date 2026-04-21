#!/usr/bin/env npx tsx
/**
 * Tito approval helper — sends Tito (Renato III) a preview of Tuesday's
 * cold-outreach so he can reply "está bien" before the live fire.
 *
 * What it does:
 *   1. Renders a fresh PDF using a SAMPLE recipient (e.g. Magna Coahuila)
 *      so the approval is against a real-looking artifact, not abstract copy
 *   2. Builds the exact HTML body prospects will see (same template)
 *   3. Emails Tito with:
 *        - Subject: "[APROBACIÓN] Campaña martes 10:00 — 150 envíos"
 *        - Body: approval checklist + the sample as attachment + inline preview
 *   4. Does NOT send to any prospect. Zero risk of accidental leak.
 *
 * Usage (Monday night, before Tuesday fire):
 *   export TITO_EMAIL="tito@renatozapata.com"   # or whatever Tito uses
 *   npx tsx scripts/cold-outreach/send-tito-preview.ts \
 *     [--recipients-count 150] \
 *     [--campaign cold-2026-04-21]
 *
 * Env required:
 *   RESEND_API_KEY  — same as send-campaign.ts
 *   TITO_EMAIL      — where to send the approval request
 *
 * Tito replies with one of:
 *   "está bien"           → fire Tuesday 10:00 as planned
 *   "cambia X"            → Renato IV adjusts, re-runs this script
 *   "no mandes"           → abort campaign
 *
 * No Tuesday fire happens without one of those responses.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { renderToBuffer } from '@react-pdf/renderer'

dotenv.config({ path: new URL('../../.env.local', import.meta.url).pathname })

import { PitchPDF, type PitchData } from './pitch-pdf'
import { subject as buildSubject, bodyHtml, bodyText, type Recipient, type CTA } from './templates'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  return process.argv[i + 1]
}

const recipientsCount = parseInt(arg('recipients-count', '150') || '150', 10)
const campaignId = arg('campaign', 'cold-2026-04-21')!
const sendTime = arg('send-time', 'martes 2026-04-21 · 10:00 CT')!

const TITO_EMAIL = process.env.TITO_EMAIL
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'
const PORTAL_URL = 'portal.renatozapata.com'

if (!TITO_EMAIL) {
  console.error('✗ TITO_EMAIL env var not set.')
  console.error('  Set it before running: export TITO_EMAIL="tito@renatozapata.com"')
  process.exit(2)
}
if (!RESEND_API_KEY) {
  console.error('✗ RESEND_API_KEY not set in .env.local')
  process.exit(2)
}

// Sample recipient — a real-looking-but-safe-to-share test case.
// Using Magna Coahuila (top-2 in the prospect list) so the preview matches
// the tone of a real send. Tito will recognize the name.
const sampleRecipient: Recipient = {
  email: 'sample@example.com',
  company: 'Magna Coahuila Expansion',
  firstName: 'Carlos',
  industry: 'Automotive Tier 1 - EV parts',
  state: 'Coahuila',
  city: 'Ramos Arizpe',
  unsubToken: 'SAMPLE-PREVIEW-TOKEN',
  campaignId: `${campaignId}-PREVIEW`,
}

const cta: CTA = {
  email: 'ai@renatozapata.com',
  phone: process.env.COLD_OUTREACH_PHONE || undefined,
  whatsapp: process.env.COLD_OUTREACH_WHATSAPP || undefined,
  calendly: process.env.COLD_OUTREACH_CALENDLY || undefined,
  portalUrl: PORTAL_URL,
}

function fechaEs(d: Date): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${String(d.getDate()).padStart(2, '0')} de ${months[d.getMonth()]}, ${d.getFullYear()}`
}

async function main() {
  console.log(`\n→ Generating preview for Tito approval...`)
  console.log(`   Campaign:      ${campaignId}`)
  console.log(`   Send time:     ${sendTime}`)
  console.log(`   Recipients:    ${recipientsCount}`)
  console.log(`   Sample:        ${sampleRecipient.company}`)
  console.log(`   CTA phone:     ${cta.phone || '(not set — will be hidden)'}`)
  console.log(`   CTA whatsapp:  ${cta.whatsapp || '(not set — will be hidden)'}`)
  console.log(`   CTA calendly:  ${cta.calendly || '(not set — will be hidden)'}`)
  console.log(`   Tito's inbox:  ${TITO_EMAIL}`)

  // Render the PDF Tito would approve
  const pitchData: PitchData = {
    recipientCompany: sampleRecipient.company,
    recipientFirstName: sampleRecipient.firstName,
    generatedDate: fechaEs(new Date()),
    opinionRef: 'RZC-PREVIEW-TITO',
    portalUrl: PORTAL_URL,
    cta,
  }
  const pdfBuffer = new Uint8Array(await renderToBuffer(PitchPDF({ data: pitchData })))

  // Exact subject + HTML that a prospect would see
  const prospectSubject = buildSubject(sampleRecipient)
  const prospectHtml = bodyHtml(sampleRecipient, cta)
  const prospectText = bodyText(sampleRecipient, cta)

  // Wrap in approval email for Tito
  const approvalSubject = `[APROBACIÓN] Campaña ${campaignId} — ${recipientsCount} envíos ${sendTime}`
  const approvalHtml = buildApprovalEmail({
    prospectSubject,
    prospectHtmlSnippet: prospectHtml,
    prospectTextSnippet: prospectText,
    sampleRecipient,
    recipientsCount,
    campaignId,
    sendTime,
    cta,
  })

  // Send
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TITO_EMAIL],
      subject: approvalSubject,
      html: approvalHtml,
      attachments: [
        {
          filename: `muestra-pitch-${sampleRecipient.company.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        },
      ],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`\n✗ Send failed: ${data?.message || res.statusText}`)
    process.exit(1)
  }
  console.log(`\n✓ Preview sent to ${TITO_EMAIL}`)
  console.log(`  Resend message id: ${data?.id}`)
  console.log(`\n  Wait for Tito's reply. Possible responses:`)
  console.log(`    "está bien"   → proceed with live send Tuesday`)
  console.log(`    "cambia X"    → adjust, re-run this script`)
  console.log(`    "no mandes"   → abort campaign`)
  console.log(`\n  No Tuesday fire until Tito has explicitly approved.`)
}

function buildApprovalEmail(p: {
  prospectSubject: string
  prospectHtmlSnippet: string
  prospectTextSnippet: string
  sampleRecipient: Recipient
  recipientsCount: number
  campaignId: string
  sendTime: string
  cta: CTA
}): string {
  const ctaSummary = [
    `Email: ${p.cta.email}`,
    p.cta.phone ? `Teléfono: ${p.cta.phone}` : null,
    p.cta.whatsapp ? `WhatsApp: ${p.cta.whatsapp}` : null,
    p.cta.calendly ? `Calendly: ${p.cta.calendly}` : null,
    `Portal: ${p.cta.portalUrl}`,
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border:1px solid #E8E5E0;max-width:640px;">

      <tr><td style="padding:24px 28px;border-bottom:3px solid #C9A84C;">
        <div style="font-size:11px;letter-spacing:2px;color:#6B6B6B;">APROBACIÓN REQUERIDA · TITO</div>
        <div style="margin-top:6px;font-size:20px;font-weight:600;">Campaña ${escapeHtml(p.campaignId)}</div>
        <div style="margin-top:2px;font-size:13px;color:#6B6B6B;">${escapeHtml(p.recipientsCount.toString())} envíos · ${escapeHtml(p.sendTime)}</div>
      </td></tr>

      <tr><td style="padding:20px 28px;font-size:14px;line-height:1.55;">
        <p style="margin:0 0 14px;"><strong>Tito,</strong></p>
        <p style="margin:0 0 14px;">
          Preparé la campaña de prospección en frío para el martes. Antes de
          mandarla necesito tu <strong>"está bien"</strong> explícito — no se
          dispara sin tu aprobación (la regla del gate de 5 segundos que
          acordamos).
        </p>
        <p style="margin:0 0 14px;">
          Abajo está la muestra exacta que recibirán los prospectos, con
          ${escapeHtml(p.sampleRecipient.company)} como ejemplo. El PDF
          adjunto es el mismo que va con cada correo.
        </p>
      </td></tr>

      <tr><td style="padding:0 28px 4px;">
        <div style="padding:14px 16px;background:#FAFAF8;border-left:3px solid #C9A84C;font-size:13px;line-height:1.5;">
          <div style="font-weight:600;margin-bottom:8px;">Checklist de aprobación</div>
          <div style="margin:4px 0;">☐ Subject: <span style="font-family:ui-monospace,Consolas,monospace;">${escapeHtml(p.prospectSubject)}</span></div>
          <div style="margin:4px 0;">☐ Cuerpo del correo (ver abajo)</div>
          <div style="margin:4px 0;">☐ PDF adjunto (1 página, plata sobre negro)</div>
          <div style="margin:4px 0;">☐ Canales CTA: ${escapeHtml(ctaSummary)}</div>
          <div style="margin:4px 0;">☐ Firma: Renato Zapata III · Director General · Patente 3596</div>
          <div style="margin:4px 0;">☐ ${escapeHtml(p.recipientsCount.toString())} destinatarios fuera de Laredo / N. Laredo</div>
          <div style="margin:4px 0;">☐ Lista de llamadas top-20 (tito-dial-list en escritorio)</div>
        </div>
      </td></tr>

      <tr><td style="padding:20px 28px 8px;font-size:13px;color:#6B6B6B;">
        Responde con una de estas tres opciones:
        <div style="margin-top:8px;">
          <span style="display:inline-block;padding:4px 10px;background:#DCFCE7;color:#166534;border-radius:3px;font-size:12px;font-weight:600;">ESTÁ BIEN</span>
          → se dispara martes 10:00 CT
        </div>
        <div style="margin-top:6px;">
          <span style="display:inline-block;padding:4px 10px;background:#FEF3C7;color:#92400E;border-radius:3px;font-size:12px;font-weight:600;">CAMBIA X</span>
          → ajusto y te re-envío
        </div>
        <div style="margin-top:6px;">
          <span style="display:inline-block;padding:4px 10px;background:#FEE2E2;color:#991B1B;border-radius:3px;font-size:12px;font-weight:600;">NO MANDES</span>
          → se cancela
        </div>
      </td></tr>

      <tr><td style="padding:24px 28px;border-top:1px solid #E8E5E0;">
        <div style="font-size:11px;letter-spacing:2px;color:#6B6B6B;margin-bottom:12px;">— MUESTRA EXACTA (lo que recibe el prospecto) —</div>
        <div style="background:#FAFAF8;padding:16px;border:1px dashed #C9A84C;">
          <div style="font-size:12px;color:#6B6B6B;margin-bottom:8px;">
            <strong>De:</strong> Renato Zapata &amp; Co. &lt;ai@renatozapata.com&gt;<br>
            <strong>Para:</strong> ${escapeHtml(p.sampleRecipient.email)}<br>
            <strong>Asunto:</strong> ${escapeHtml(p.prospectSubject)}
          </div>
          ${p.prospectHtmlSnippet}
        </div>
      </td></tr>

      <tr><td style="padding:16px 28px;border-top:1px solid #E8E5E0;font-size:11px;color:#9A9A9A;font-family:ui-monospace,Consolas,monospace;letter-spacing:1px;">
        PATENTE 3596 · ADUANA 240 · EST. 1941 · APROBACIÓN INTERNA — NO COMPARTIR
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
