const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const WATCH_SENDERS = {
  'mario': { patterns: ['mario.ramos@globalpc.net', 'mario@globalpc'], priority: 'high', tag: 'GlobalPC' },
  'ursula': { patterns: ['ursula_b@evcoplastics.com.mx', 'ursula@evco'], priority: 'medium', tag: 'EVCO' },
}
const COMPLIANCE_KEYWORDS = ['VUCEM', 'MVE', 'SAT', 'e.firma', 'padron', 'IMMEX', 'NOM']
const OPERATIONAL_KEYWORDS = ['pedimento', 'factura', 'embarque', 'trafico', 'cruce']

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function getGmailClient() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('⚠️  Gmail OAuth not configured')
    console.log('   Run: npm run gmail-setup')
    return null
  }
  const oauth2 = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground')
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

async function logEvent(emailData) {
  const { error } = await supabase.from('communication_events').upsert({
    email_id: emailData.id,
    tenant_slug: 'evco',
    from_address: emailData.from,
    subject: emailData.subject,
    date: emailData.date,
    is_urgent: emailData.urgent,
    urgent_keywords: emailData.keywords || [],
    scanned_at: new Date().toISOString(),
  }, { onConflict: 'email_id' })
  if (error && error.code !== '23505') console.log('  Log error:', error.message)
}

function extractHeader(headers, name) {
  const h = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

async function scanInbox() {
  console.log('📬 Gmail Scanner — ' + new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' }) + '\n')

  const gmail = await getGmailClient()
  if (!gmail) return

  // Get last 30 minutes of emails
  const after = Math.floor((Date.now() - 30 * 60 * 1000) / 1000)
  const { data: listData } = await gmail.users.messages.list({
    userId: 'me', q: `after:${after}`, maxResults: 20,
  })

  const messages = listData.messages || []
  console.log(`Found ${messages.length} new message(s)\n`)

  if (messages.length === 0) { console.log('✅ No new messages'); return }

  let alerts = 0

  for (const msg of messages) {
    const { data: full } = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })
    const headers = full.payload?.headers || []
    const from = extractHeader(headers, 'From')
    const subject = extractHeader(headers, 'Subject')
    const date = extractHeader(headers, 'Date')
    const fromLower = from.toLowerCase()
    const subjectLower = subject.toLowerCase()

    console.log(`  📧 ${from.substring(0, 40)}`)
    console.log(`     ${subject.substring(0, 60)}`)

    // Check if from watched sender
    let senderTag = null
    for (const [key, cfg] of Object.entries(WATCH_SENDERS)) {
      if (cfg.patterns.some(p => fromLower.includes(p))) {
        senderTag = cfg.tag
        console.log(`     🏷️  ${cfg.tag} — ${cfg.priority} priority`)
        break
      }
    }

    // Check for compliance keywords
    const complianceHits = COMPLIANCE_KEYWORDS.filter(kw => subjectLower.includes(kw.toLowerCase()))
    const operationalHits = OPERATIONAL_KEYWORDS.filter(kw => subjectLower.includes(kw.toLowerCase()))
    const isUrgent = complianceHits.length > 0 || senderTag === 'GlobalPC'

    // Log to Supabase
    await logEvent({ id: msg.id, from, subject, date, urgent: isUrgent, keywords: [...complianceHits, ...operationalHits] })

    // Alert for compliance emails
    if (complianceHits.length > 0) {
      alerts++
      await sendTG([
        `🚨 <b>EMAIL COMPLIANCE</b>`,
        `De: ${from.substring(0, 50)}`,
        `Asunto: ${subject.substring(0, 60)}`,
        `Keywords: ${complianceHits.join(', ')}`,
        `Hora: ${date}`,
        `— CRUZ 🦀`
      ].join('\n'))
      console.log(`     ⚠️  Compliance alert sent!`)
    }

    // GlobalPC and EVCO sender alerts removed — only compliance keyword alerts are sent

    console.log('')
  }

  console.log(`Scanned: ${messages.length} · Alerts: ${alerts}`)
}

scanInbox().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
