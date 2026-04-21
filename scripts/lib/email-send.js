// scripts/lib/email-send.js
// Shared Resend email sender for CRUZ scripts
// Pattern matches: send-notifications.js, document-wrangler.js, weekly-digest.js, solicitud-email.js

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'

/**
 * Send an email via Resend API.
 * Never throws — always returns { success, messageId?, error? }
 */
async function sendEmail({ to, subject, htmlBody, textBody }) {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: htmlBody || (textBody ? textBody.replace(/\n/g, '<br>') : ''),
        text: textBody || '',
      }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.message || res.statusText }
    return { success: true, messageId: data.id }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = { sendEmail, FROM_EMAIL }
