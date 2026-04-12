#!/usr/bin/env node
// scripts/send-notifications.js
// ============================================================================
// CRUZ Client Auto-Notification Pipeline
//
// Runs every 2 minutes via cron. Fetches pending notification_events,
// renders branded HTML emails by template_key, sends via Resend API,
// and marks each row sent or failed.
//
// Resend API key: RESEND_API_KEY in .env.local
// From: ai@renatozapata.com
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'send-notifications'
const PORTAL_URL = 'https://portal.renatozapata.com'
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'
const BATCH_SIZE = 20

// ── Telegram alerting ──

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Template definitions ──

const TEMPLATES = {
  entrada_created: {
    subject: (p) => `Solicitud Recibida \u2014 ${p.trafico_number || ''}`,
    icon: '\uD83D\uDCE5',
    color: '#3b82f6',
    rows: (p) => [
      { label: 'Tr\u00E1fico', value: p.trafico_number },
      { label: 'Mercanc\u00EDa', value: p.descripcion_mercancia },
      { label: 'Valor Estimado', value: p.valor_estimado },
    ],
    cta: { text: 'Ver en Portal', path: '' },
  },

  docs_complete: {
    subject: (p) => `Documentaci\u00F3n Completa \u2014 ${p.trafico_number || ''}`,
    icon: '\uD83D\uDCCB',
    color: '#22c55e',
    rows: (p) => [
      { label: 'Tr\u00E1fico', value: p.trafico_number },
      { label: 'Siguiente Paso', value: p.siguiente_paso || 'Revisi\u00F3n de pedimento' },
    ],
    cta: { text: 'Ver Expediente', path: '/documentos' },
  },

  pedimento_filed: {
    subject: (p) => `Pedimento Presentado \u2014 ${p.trafico_number || ''}`,
    icon: '\uD83D\uDCC4',
    color: '#B8953F',
    rows: (p) => [
      { label: 'Tr\u00E1fico', value: p.trafico_number },
      { label: 'No. Pedimento', value: p.pedimento_number },
      { label: 'Siguiente Paso', value: p.siguiente_paso || 'Despacho en aduana' },
    ],
    cta: { text: 'Seguimiento en Tiempo Real', path: '/traficos' },
  },

  cleared: {
    subject: (p) => `\u2713 Mercanc\u00EDa Liberada \u2014 ${p.trafico_number || ''}`,
    icon: '\uD83D\uDFE2',
    color: '#22c55e',
    rows: (p) => [
      { label: 'Tr\u00E1fico', value: p.trafico_number },
      { label: 'No. Pedimento', value: p.pedimento_number },
      { label: 'Estado', value: 'Liberado \u2014 mercanc\u00EDa disponible' },
    ],
    cta: { text: 'Ver Detalles de Liberaci\u00F3n', path: '/traficos' },
  },

  hold_placed: {
    subject: (p) => `\u26A0\uFE0F Retenci\u00F3n \u2014 ${p.trafico_number || ''}`,
    icon: '\u26A0\uFE0F',
    color: '#ef4444',
    rows: (p) => [
      { label: 'Tr\u00E1fico', value: p.trafico_number },
      { label: 'Estado', value: p.estado || 'Retenci\u00F3n aplicada \u2014 en revisi\u00F3n' },
    ],
    cta: { text: 'Ver Detalles', path: '/traficos' },
  },
}

// ── Email HTML builder (dark theme, CRUZ branded) ──

function buildEmailHTML(template, payload) {
  const rows = template.rows(payload)
    .filter(r => r.value)
    .map(r => `
      <tr>
        <td style="padding: 10px 16px; font-size: 13px; color: #9ca3af; border-bottom: 1px solid #1a1a2e; white-space: nowrap; vertical-align: top;">
          ${r.label}
        </td>
        <td style="padding: 10px 16px; font-size: 14px; color: #e5e7eb; border-bottom: 1px solid #1a1a2e; font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;">
          ${escapeHtml(String(r.value))}
        </td>
      </tr>
    `).join('')

  const ctaUrl = `${PORTAL_URL}${template.cta.path}`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${template.subject(payload)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px;">

          <!-- Portal Header -->
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <span style="font-size: 28px; font-weight: 900; letter-spacing: 0.15em; background: linear-gradient(135deg, #B8953F, #D4B86A); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                Portal
              </span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 11px; color: #6b7280; letter-spacing: 0.08em; text-transform: uppercase;">
                Renato Zapata &amp; Co.
              </span>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0e0e1a; border: 1px solid #1a1a2e; border-radius: 12px; overflow: hidden;">

                <!-- Icon + Status header -->
                <tr>
                  <td style="padding: 28px 24px 16px; text-align: center;">
                    <div style="font-size: 36px; margin-bottom: 12px;">${template.icon}</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${template.color};">
                      ${template.subject(payload)}
                    </div>
                  </td>
                </tr>

                <!-- Data rows -->
                <tr>
                  <td style="padding: 8px 8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${rows}
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #B8953F, #D4B86A); color: #0a0a0f; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; letter-spacing: 0.02em;">
                      ${template.cta.text} &rarr;
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px 0;">
              <span style="font-size: 11px; color: #4b5563; line-height: 1.6;">
                Renato Zapata &amp; Company &middot; Est. 1941 &middot; Laredo, TX<br>
                Patente 3596 &middot; Aduana 240
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Send email via Resend API ──

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')

  // Try with branded from address first; fall back to Resend test sender
  // if domain is not yet verified (403).
  const fromAddresses = [FROM_EMAIL, 'Portal Test <onboarding@resend.dev>']

  for (const fromAddr of fromAddresses) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [to],
        subject,
        html,
      }),
    })

    if (res.ok) return res.json()

    const body = await res.text()
    // If 403 = domain not verified, try fallback sender
    if (res.status === 403 && fromAddr === FROM_EMAIL) {
      console.log(`  [WARN] Domain not verified, falling back to onboarding@resend.dev`)
      continue
    }
    throw new Error(`Resend API ${res.status}: ${body}`)
  }
}

// ── Main pipeline ──

async function main() {
  console.log(`[${SCRIPT_NAME}] Starting notification send...`)

  if (!RESEND_API_KEY) {
    console.error(`[${SCRIPT_NAME}] RESEND_API_KEY not configured`)
    await sendTelegram(`\uD83D\uDD34 ${SCRIPT_NAME} failed: RESEND_API_KEY not configured`)
    process.exit(1)
  }

  // Count shadow rows (skipped) for visibility
  const { count: shadowCount } = await supabase
    .from('notification_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'shadow')

  // Fetch pending events (live triggers only)
  const { data: events, error: fetchError } = await supabase
    .from('notification_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (fetchError) {
    console.error(`[${SCRIPT_NAME}] Supabase fetch error:`, fetchError.message)
    await sendTelegram(`\uD83D\uDD34 ${SCRIPT_NAME} failed: ${fetchError.message}`)
    await logToSupabase('failed', 0, 0, fetchError.message)
    process.exit(1)
  }

  const pendingCount = events ? events.length : 0
  console.log(`[${SCRIPT_NAME}] ${pendingCount} pending (live) | ${shadowCount || 0} shadow (skipped)`)

  if (!events || events.length === 0) {
    console.log(`[${SCRIPT_NAME}] No pending notifications. Done.`)
    return
  }

  console.log(`[${SCRIPT_NAME}] Processing ${events.length} notification(s)...`)

  let sent = 0
  let failed = 0

  for (const event of events) {
    const { id, template_key, recipient_email, template_vars } = event

    try {
      const template = TEMPLATES[template_key]
      if (!template) {
        throw new Error(`Unknown template_key: ${template_key}`)
      }

      if (!recipient_email) {
        throw new Error('No recipient_email')
      }

      const vars = typeof template_vars === 'string' ? JSON.parse(template_vars) : (template_vars || {})
      const subject = template.subject(vars)
      const html = buildEmailHTML(template, vars)

      const result = await sendEmail(recipient_email, subject, html)

      // Mark sent
      await supabase
        .from('notification_events')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_message_id: result.id || null,
        })
        .eq('id', id)

      console.log(`  [SENT] ${template_key} → ${recipient_email} (${id})`)
      sent++
    } catch (err) {
      // Mark failed
      await supabase
        .from('notification_events')
        .update({
          status: 'failed',
          error_message: err.message,
        })
        .eq('id', id)

      console.error(`  [FAIL] ${template_key} → ${recipient_email}: ${err.message}`)
      failed++
    }
  }

  // Log results
  await logToSupabase(failed === 0 ? 'success' : 'partial', sent, failed, null)

  const summary = `${SCRIPT_NAME}: ${sent} sent, ${failed} failed (of ${events.length})`
  console.log(`[${SCRIPT_NAME}] ${summary}`)

  if (failed > 0) {
    await sendTelegram(`\u26A0\uFE0F ${summary}`)
  }
}

async function logToSupabase(status, sent, failed, errorMsg) {
  try {
    await supabase.from('heartbeat_log').insert({
      script: SCRIPT_NAME,
      status,
      details: { sent, failed, error: errorMsg },
      created_at: new Date().toISOString(),
    })
  } catch (_) { /* best-effort logging */ }
}

main().catch(async (err) => {
  console.error(`[${SCRIPT_NAME}] Fatal:`, err.message)
  await sendTelegram(`\uD83D\uDD34 ${SCRIPT_NAME} fatal: ${err.message}`)
  await logToSupabase('failed', 0, 0, err.message)
  process.exit(1)
})
