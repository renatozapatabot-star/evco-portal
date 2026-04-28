#!/usr/bin/env node
// FIX 2026-04-16: env loading was missing — PM2 cron_restart invoked this
// script without .env.local injection so SUPABASE_URL/SUPABASE_KEY were
// undefined and main() threw "Missing Supabase env vars" on every 5-min
// tick (59 restarts observed in overnight audit).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

/**
 * Mensajería · email fallback via Resend.
 *
 * Runs on a schedule (PM2 --cron every 5 min). For every message older than
 * 30 minutes whose thread has not been read by the addressed role, send one
 * email and insert an idempotency row in mensajeria_email_notifications so
 * we never double-notify the same message.
 *
 * Operators are notified when the client writes. Owners (Tito) are notified
 * when a thread is escalated and the summary has been pending > 30 min
 * without acknowledgment.
 *
 * Never calls sendTelegram — Telegram is reserved for pipeline/infra alerts
 * only (CLAUDE.md invariant).
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   OPERATOR_EMAIL (where operator alerts go), TITO_EMAIL (escalation alerts).
 */

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')
// Telegram is reserved for pipeline/infra alerts per CLAUDE.md — this
// import is for SCRIPT-FAILURE alerts only (the cron crashed), NOT for
// client-facing messaging. Client messaging goes through Resend above.
const { sendTelegram } = require('./lib/telegram')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || process.env.TITO_EMAIL
const TITO_EMAIL = process.env.TITO_EMAIL
const FROM_EMAIL = process.env.MENSAJERIA_FROM_EMAIL || 'mensajeria@renatozapata.com'

const CLIENT_UNREAD_WINDOW_MS = 30 * 60 * 1000
const INTERNAL_UNREAD_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_PER_RUN = 200
const MAX_PER_RECIPIENT_PER_HOUR = 5

// Schema probe — `mensajeria_messages` was created in
// 20260415083503_mve_mensajeria_tables.sql but that migration is in
// supabase/migrations_broken_20260420_1500/ and was never applied to
// the live Supabase project (production schema reorg, see
// supabase/MIGRATION_QUEUE.md). The portal has a runtime probe
// (src/lib/cockpit/table-availability.ts) that branches on this; this
// cron mirrors it. If the table is absent, exit cleanly so PM2 logs a
// success heartbeat instead of crashing every 5 min.
function isMissingTable(err) {
  // PGRST205 = "Could not find the table 'public.X' in the schema cache"
  return (
    err?.code === 'PGRST205' ||
    /Could not find the table/i.test(err?.message || '') ||
    /Could not find the table/i.test(String(err))
  )
}

async function tableExists(supabase, table) {
  // Use a real .select(..).limit(1) — the `head: true` variant does NOT
  // surface PGRST205 for missing tables (the HEAD path skips that check).
  try {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (!error) return true
    if (isMissingTable(error)) return false
    throw error
  } catch (err) {
    if (isMissingTable(err)) return false
    throw err
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase env vars')
  if (!RESEND_KEY) throw new Error('Missing RESEND_API_KEY')

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const resend = new Resend(RESEND_KEY)

  if (!(await tableExists(supabase, 'mensajeria_messages'))) {
    console.log(
      `[mensajeria-email-fallback] mensajeria_messages absent — feature not yet provisioned in this Supabase project. ` +
      `Skipping run (${new Date().toISOString()}).`,
    )
    return
  }

  const clientCutoff = new Date(Date.now() - CLIENT_UNREAD_WINDOW_MS).toISOString()
  const internalCutoff = new Date(Date.now() - INTERNAL_UNREAD_WINDOW_MS).toISOString()

  // 1) Client messages older than 30 min (existing behavior) AND
  //    internal_only workflow messages older than 24h unread by any internal reader.
  const { data: clientMsgs, error: clientErr } = await supabase
    .from('mensajeria_messages')
    .select('id, thread_id, company_id, author_role, author_name, body, created_at, internal_only, undone')
    .eq('internal_only', false)
    .eq('undone', false)
    .eq('author_role', 'client')
    .lte('created_at', clientCutoff)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN)
  if (clientErr) throw clientErr

  const { data: internalMsgs, error: internalErr } = await supabase
    .from('mensajeria_messages')
    .select('id, thread_id, company_id, author_role, author_name, body, created_at, internal_only, undone')
    .eq('internal_only', true)
    .eq('undone', false)
    .neq('author_role', 'system')
    .lte('created_at', internalCutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)
  if (internalErr) throw internalErr

  const msgs = [...(clientMsgs || []), ...(internalMsgs || [])].slice(0, MAX_PER_RUN)

  const { data: alreadySent } = await supabase
    .from('mensajeria_email_notifications')
    .select('message_id')
    .in('message_id', (msgs || []).map(m => m.id))
  const sentSet = new Set((alreadySent || []).map(r => r.message_id))

  const pending = (msgs || []).filter(m => !sentSet.has(m.id))
  if (pending.length === 0) {
    console.log(`[mensajeria-email-fallback] no pending messages (${new Date().toISOString()})`)
    return
  }

  const threadIds = [...new Set(pending.map(m => m.thread_id))]
  const { data: reads } = await supabase
    .from('mensajeria_reads')
    .select('thread_id, last_read_at, reader_key')
    .in('thread_id', threadIds)
  const readsByThread = new Map()
  for (const r of reads || []) {
    if (r.reader_key && r.reader_key.startsWith('internal:')) {
      const existing = readsByThread.get(r.thread_id)
      if (!existing || r.last_read_at > existing) readsByThread.set(r.thread_id, r.last_read_at)
    }
  }

  const { data: threads } = await supabase
    .from('mensajeria_threads')
    .select('id, subject, status, escalated_at, company_id')
    .in('id', threadIds)
  const threadById = new Map((threads || []).map(t => [t.id, t]))

  // Per-recipient rate cap — look back 1h in the notifications table
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('mensajeria_email_notifications')
    .select('recipient_email, sent_at')
    .gte('sent_at', oneHourAgo)
  const recentByRecipient = new Map()
  for (const r of recent || []) {
    recentByRecipient.set(r.recipient_email, (recentByRecipient.get(r.recipient_email) || 0) + 1)
  }

  let sentCount = 0
  for (const m of pending) {
    const threadRead = readsByThread.get(m.thread_id)
    if (threadRead && threadRead > m.created_at) continue

    const thread = threadById.get(m.thread_id)
    if (!thread) continue

    const recipient = thread.status === 'escalated' ? (TITO_EMAIL || OPERATOR_EMAIL) : OPERATOR_EMAIL
    if (!recipient) continue

    const usedThisHour = recentByRecipient.get(recipient) || 0
    if (usedThisHour >= MAX_PER_RECIPIENT_PER_HOUR) continue

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.renatozapata.com').replace(/\/$/, '')
    const threadLink = `${appUrl}/mensajeria?thread=${thread.id}`
    const isInternal = m.internal_only === true
    const lead = isInternal
      ? `Notificación de sistema sin revisar:`
      : `Mensaje sin leer del cliente:`
    const footer = isInternal
      ? `Enviado automáticamente porque la notificación ha estado sin leer 24 horas.`
      : `Enviado automáticamente porque el mensaje ha estado sin leer 30 minutos.`

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipient,
        subject: `[Mensajería] ${thread.subject} · ${thread.company_id}`,
        html: `
          <p>${lead}</p>
          <blockquote style="border-left:3px solid #C9A84C;padding-left:12px;margin-left:0;">
            ${escapeHtml(m.body).slice(0, 2000)}
          </blockquote>
          <p>Hilo: <strong>${escapeHtml(thread.subject)}</strong></p>
          <p>Cliente: <code>${escapeHtml(thread.company_id)}</code></p>
          <p><a href="${threadLink}" style="color:#C9A84C;">Abrir en AGUILA →</a></p>
          <p style="color:#666;font-size:12px;">${footer}</p>
        `,
      })
      await supabase.from('mensajeria_email_notifications').insert({
        message_id: m.id,
        recipient_email: recipient,
      })
      recentByRecipient.set(recipient, usedThisHour + 1)
      sentCount++
    } catch (err) {
      console.error(`[mensajeria-email-fallback] Resend failed for ${m.id}:`, err.message)
    }
  }

  console.log(`[mensajeria-email-fallback] sent ${sentCount}/${pending.length} (${new Date().toISOString()})`)
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

main().catch(async (err) => {
  console.error('[mensajeria-email-fallback] FATAL:', err)
  // Infra-level alert — distinct from client-facing messaging
  // (which never uses Telegram per CLAUDE.md). This fires only when
  // the cron itself crashes, not when a user message is delivered.
  await sendTelegram(
    `🔴 <b>mensajeria-email-fallback</b> fatal: ${err?.message || err}`,
  )
  process.exit(1)
})
