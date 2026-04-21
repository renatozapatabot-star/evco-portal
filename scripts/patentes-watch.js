#!/usr/bin/env node
/**
 * Patentes watch — PM2 cron, daily at 08:00 America/Chicago.
 *
 * Hits /api/admin/patentes-watch which fires Mensajería alerts at the 90d,
 * 60d, 30d, and 0d tripwires for E_FIRMA / FIEL / renewal dates on every
 * active patente. Protects Patente 3596 from silent expiry.
 *
 * Env:
 *   AGUILA_APP_URL (defaults to https://portal.renatozapata.com)
 *   CRON_SECRET    (must match the server env var)
 */

const BASE = (process.env.AGUILA_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://portal.renatozapata.com').replace(/\/$/, '')
const SECRET = process.env.CRON_SECRET
const SCRIPT_NAME = 'patentes-watch'

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch { /* never crash on telegram failure */ }
}

async function main() {
  if (!SECRET) {
    console.error(`[${SCRIPT_NAME}] CRON_SECRET env var is required`)
    await sendTelegram(`🔴 ${SCRIPT_NAME}: CRON_SECRET missing`)
    process.exit(1)
  }

  const url = `${BASE}/api/admin/patentes-watch`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-cron-secret': SECRET },
    signal: AbortSignal.timeout(60000),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`[${SCRIPT_NAME}] HTTP ${res.status}:`, body)
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed: HTTP ${res.status}`)
    process.exit(1)
  }

  const { checked = 0, notified = 0 } = body?.data ?? {}
  console.log(`[${SCRIPT_NAME}] checked=${checked} notified=${notified} (${new Date().toISOString()})`)
}

main().catch(async (err) => {
  console.error(`[${SCRIPT_NAME}] FATAL:`, err)
  await sendTelegram(`🔴 ${SCRIPT_NAME} FATAL: ${err.message ?? err}`)
  process.exit(1)
})
