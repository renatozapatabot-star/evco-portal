#!/usr/bin/env node
/**
 * CRUZ Welcome Email System
 * Sends portal access credentials to all active clients
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { google } = require('googleapis')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const MONDAY_ONLY = process.argv.includes('--monday-only')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (!TELEGRAM_TOKEN) { console.log('[TG]', msg.replace(/<[^>]+>/g, '')); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

function buildWelcomeEmail(company) {
  return {
    subject: `Bienvenido a CRUZ — Su portal aduanal está listo | ${company.name}`,
    body: `Estimado/a ${company.contact_name || 'Cliente'},

Su portal de inteligencia aduanal CRUZ ya está activo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCESO AL PORTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: https://evco-portal.vercel.app
Contraseña: ${company.portal_password}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUÉ PUEDE HACER DESDE HOY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Ver todos sus tráficos activos en tiempo real
- Consultar documentos de cada embarque
- Preguntarle a CRUZ AI sobre cualquier operación
- Revisar su score de cumplimiento aduanal
- Recibir el reporte semanal cada lunes a las 7 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANTE — MVE (Manifestación de Valor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La obligatoriedad del formato E2 entra en vigor
el 31 de marzo de 2026. CRUZ está monitoreando
sus tráficos y le alertará sobre cualquier pendiente.

Para soporte: ai@renatozapata.com
Portal: evco-portal.vercel.app

Atentamente,
Renato Zapata III — Director General
Grupo Aduanal Renato Zapata S.C.
Patente 3596 · Aduana 240 Nuevo Laredo
`
  }
}

async function sendViaGmail(to, subject, body) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const message = [
    `From: ${process.env.GMAIL_FROM || 'ai@renatozapata.com'}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body
  ].join('\n')

  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded }
  })
}

async function run() {
  console.log(`📧 CRUZ Welcome Email System ${DRY_RUN ? '(DRY RUN)' : ''}`)
  console.log('═'.repeat(50))

  if (MONDAY_ONLY && new Date().getDay() !== 1) {
    console.log('Not Monday — skipping')
    return
  }

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .eq('active', true)
    .not('contact_email', 'is', null)

  if (!companies?.length) {
    console.log('No companies with email addresses')
    return
  }

  let sent = 0
  let failed = 0

  for (const company of companies) {
    if (!company.contact_email || !company.portal_password) {
      console.log(`  ⏭️  ${company.name}: no email or password`)
      continue
    }

    const email = buildWelcomeEmail(company)

    if (DRY_RUN) {
      console.log(`  📧 [DRY] ${company.name} → ${company.contact_email}`)
      console.log(`     Subject: ${email.subject}`)
      sent++
      continue
    }

    try {
      await sendViaGmail(company.contact_email, email.subject, email.body)
      console.log(`  ✅ ${company.name} → ${company.contact_email}`)

      await supabase.from('communication_events').insert({
        company_id: company.company_id,
        event_type: 'welcome_email',
        recipient: company.contact_email,
        subject: email.subject,
        status: 'sent',
        created_at: new Date().toISOString()
      })
      sent++
    } catch (e) {
      console.error(`  ❌ ${company.name}: ${e.message}`)
      failed++
    }
  }

  console.log(`\n✅ ${sent} sent, ${failed} failed (of ${companies.length} total)`)
  await tg(`📧 <b>Welcome Emails</b>\n${sent}/${companies.length} enviados${DRY_RUN ? ' (DRY RUN)' : ''}\n— CRUZ 🦀`)
}

run().catch(console.error)
