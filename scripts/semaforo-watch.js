#!/usr/bin/env node
/**
 * Semáforo watch — PM2 cron, runs every 5 min.
 *
 * Hits /api/monitor/semaforo-watch which scans traficos where semaforo=2
 * and opens a Mensajería thread per un-alerted tráfico. This script is
 * a thin wrapper so all logic stays in Next.js server code.
 *
 * Env:
 *   AGUILA_APP_URL (defaults to https://portal.renatozapata.com)
 *   CRON_SECRET    (must match the server env var)
 *
 * Silent-failure guard per CLAUDE.md: fires a Telegram alert on non-2xx
 * so the pipeline can't die unnoticed.
 */

const BASE = (process.env.AGUILA_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://portal.renatozapata.com').replace(/\/$/, '')
const SECRET = process.env.CRON_SECRET
const SCRIPT_NAME = 'semaforo-watch'

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
  } catch { /* pipeline must not crash on telegram failure */ }
}

async function main() {
  if (!SECRET) {
    console.error(`[${SCRIPT_NAME}] CRON_SECRET env var is required`)
    await sendTelegram(`🔴 ${SCRIPT_NAME}: CRON_SECRET missing`)
    process.exit(1)
  }

  const url = `${BASE}/api/monitor/semaforo-watch`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-cron-secret': SECRET },
    signal: AbortSignal.timeout(30000),
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
