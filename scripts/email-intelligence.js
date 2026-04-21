const { createClient } = require('@supabase/supabase-js')
const { extractWithQwen, isOllamaRunning } = require('./qwen-extract')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

const EMAIL_PROMPT = `You are a Mexican customs brokerage AI.
Extract from this email:
{
  "trafico_id": "9254-YXXXX format or null",
  "invoice_numbers": ["list of invoice numbers or empty array"],
  "amount": number or null,
  "currency": "USD or MXN or null",
  "supplier": "company name or null",
  "urgency": "critical" or "high" or "medium" or "low",
  "required_action": "one sentence action needed or null",
  "mve_folio": "MVE folio number or null",
  "pedimento_number": "pedimento number or null"
}
Return JSON only.`

async function processUnanalyzedEmails() {
  console.log('📧 Email Intelligence — processing unanalyzed emails')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) {
    console.log('⚠️ Ollama not running — skipping')
    return
  }

  // Get unprocessed emails from communication_events
  const { data: emails } = await supabase
    .from('communication_events')
    .select('*')
    .is('metadata->qwen_processed', null)
    .order('created_at', { ascending: false })
    .limit(50)

  console.log(`Processing ${emails?.length || 0} unanalyzed emails`)

  let processed = 0
  let actionable = 0

  for (const email of (emails || [])) {
    try {
      const content = [
        `From: ${email.sender || ''}`,
        `Subject: ${email.subject || ''}`,
        `Body: ${email.content || email.metadata?.snippet || ''}`
      ].join('\n')

      const extracted = await extractWithQwen(content, EMAIL_PROMPT)
      if (!extracted) continue

      // Update communication_events with extraction
      const metadata = { ...(email.metadata || {}), qwen_processed: true, extraction: extracted }
      await supabase.from('communication_events').update({ metadata })
        .eq('id', email.id)

      // Save to email_extractions
      await supabase.from('email_extractions').insert({
        email_id: email.id,
        sender: email.sender,
        subject: email.subject,
        trafico_id: extracted.trafico_id,
        invoice_number: extracted.invoice_numbers?.[0],
        amount: extracted.amount,
        urgency: extracted.urgency,
        required_action: extracted.required_action,
        raw_extraction: extracted,
      }).catch(() => {})

      // If MVE folio found — update trafico
      if (extracted.mve_folio && extracted.trafico_id) {
        await supabase.from('traficos')
          .update({ mve_folio: extracted.mve_folio })
          .eq('trafico', extracted.trafico_id)
      }

      // If critical/high urgency — alert
      if (extracted.urgency === 'critical' || extracted.urgency === 'high') {
        await tg([
          `📧 <b>EMAIL URGENTE — ${extracted.urgency.toUpperCase()}</b>`,
          `De: ${email.sender || 'Desconocido'}`,
          `Asunto: ${(email.subject || '').substring(0, 80)}`,
          extracted.trafico_id ? `Tráfico: ${extracted.trafico_id}` : '',
          extracted.required_action ? `Acción: ${extracted.required_action}` : '',
          `— CRUZ 🦀`
        ].filter(Boolean).join('\n'))
        actionable++
      }

      processed++
    } catch (e) {
      console.error('Email processing error:', e.message)
    }
  }

  console.log(`✅ Email intelligence: ${processed} processed, ${actionable} actionable`)
}

module.exports = { processUnanalyzedEmails }
processUnanalyzedEmails().catch(console.error)
