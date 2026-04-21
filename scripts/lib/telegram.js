// scripts/lib/telegram.js — single source of truth for Telegram messaging
const TELEGRAM_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = () => process.env.TELEGRAM_CHAT_ID || '-5085543275'

async function sendTelegram(msg, chatId) {
  const token = TELEGRAM_TOKEN()
  const chat = chatId || TELEGRAM_CHAT()
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!token) { console.log('[TG skip]', msg.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) { console.error('[telegram]', e.message) }
}

module.exports = { sendTelegram }
