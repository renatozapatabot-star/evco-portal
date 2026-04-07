// scripts/lib/email-auto-reply.js
// ============================================================================
// CRUZ Auto-Reply — Spanish confirmation emails to suppliers
//
// Sends threaded reply to the original email confirming document receipt.
// Uses Gmail API with In-Reply-To header for proper threading.
// Every reply logged to audit_log (append-only).
// ============================================================================

const { google } = require('googleapis')

/**
 * Send a Spanish auto-reply confirming receipt of documents.
 *
 * @param {object} gmail - Authenticated Gmail API client
 * @param {object} opts
 * @param {string} opts.messageId - Gmail message ID to reply to
 * @param {string} opts.threadId - Gmail thread ID
 * @param {string} opts.to - Recipient email (original sender)
 * @param {string} opts.subject - Original email subject
 * @param {string} opts.supplierName - Extracted supplier name
 * @param {string} opts.invoiceNumber - Extracted invoice number
 * @param {string} opts.draftId - CRUZ draft ID for reference
 * @param {string} opts.traficoNumber - Auto-created tráfico number (if any)
 * @param {number} opts.confidenceScore - Extraction confidence %
 * @param {object} supabase - Supabase client for audit logging
 */
async function sendAutoReply(gmail, opts, supabase) {
  const {
    messageId, threadId, to, subject,
    supplierName, invoiceNumber, draftId,
    traficoNumber, confidenceScore,
  } = opts

  if (!to || !messageId) {
    console.log('  [auto-reply] No recipient or messageId — skip')
    return false
  }

  // Extract email address from "Name <email>" format
  const emailMatch = to.match(/<([^>]+)>/)
  const recipientEmail = emailMatch ? emailMatch[1] : to

  // Don't reply to noreply, automated, or system addresses
  const noReplyPatterns = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster', 'automated']
  if (noReplyPatterns.some(p => recipientEmail.toLowerCase().includes(p))) {
    console.log('  [auto-reply] No-reply address detected — skip')
    return false
  }

  const referenciaLabel = traficoNumber
    ? `Referencia: ${traficoNumber}`
    : `Referencia interna: ${draftId.substring(0, 8)}`

  const body = [
    `Estimado/a${supplierName ? ` ${supplierName}` : ''},`,
    '',
    `Confirmamos la recepción de su documentación${invoiceNumber ? ` (Factura ${invoiceNumber})` : ''}.`,
    '',
    `${referenciaLabel}`,
    '',
    'Su información será validada por nuestro equipo en las próximas horas.',
    'Si necesita enviar documentos adicionales, responda a este correo adjuntando los archivos.',
    '',
    'Quedamos a sus órdenes.',
    '',
    '— Renato Zapata & Company',
    'Agente Aduanal · Patente 3596 · Aduana 240 Nuevo Laredo',
    'ai@renatozapata.com',
  ].join('\n')

  // Build RFC 2822 compliant email with threading headers
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const rawMessage = [
    `From: ai@renatozapata.com`,
    `To: ${recipientEmail}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    body,
  ].join('\r\n')

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        threadId: threadId || undefined,
      },
    })
    console.log(`  [auto-reply] Sent to ${recipientEmail}`)

    // Audit log — every outbound email tracked
    if (supabase) {
      await supabase.from('audit_log').insert({
        action: 'email_auto_reply_sent',
        entity_type: 'email',
        entity_id: draftId,
        details: {
          recipient: recipientEmail,
          supplier: supplierName,
          invoice: invoiceNumber,
          trafico: traficoNumber,
          confidence: confidenceScore,
          thread_id: threadId,
        },
      }).then(() => {}, () => {})
    }

    return true
  } catch (err) {
    console.error(`  [auto-reply] Failed: ${err.message}`)

    // Log failure too — no silent failures
    if (supabase) {
      await supabase.from('audit_log').insert({
        action: 'email_auto_reply_failed',
        entity_type: 'email',
        entity_id: draftId,
        details: {
          recipient: recipientEmail,
          error: err.message,
          supplier: supplierName,
        },
      }).then(() => {}, () => {})
    }

    return false
  }
}

module.exports = { sendAutoReply }
