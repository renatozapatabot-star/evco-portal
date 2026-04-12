/**
 * AGUILA · Block 17 — Shared Telegram helper.
 *
 * Non-fatal: if `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` env is missing,
 * logs once and returns silently. Never throws — callers always `await` this
 * without try/catch.
 *
 * Existing scripts (tito-daily-briefing, touch-monitor, etc.) keep their
 * inline sendTelegram implementations; this module is for TS/app-router use.
 */

let envMissingLogged = false

interface SendTelegramOptions {
  silent?: boolean
}

export async function sendTelegram(
  message: string,
  opts?: SendTelegramOptions,
): Promise<void> {
  if (process.env.TELEGRAM_SILENT === 'true') return

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    if (!envMissingLogged) {
      envMissingLogged = true
      console.warn(
        '[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing — skipping send',
      )
    }
    return
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_notification: opts?.silent ?? false,
      }),
    })
  } catch (err) {
    console.warn('[telegram] send failed:', err instanceof Error ? err.message : String(err))
  }
}
