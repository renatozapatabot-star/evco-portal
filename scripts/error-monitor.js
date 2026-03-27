const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

const LOG_FILES = [
  { path: '/tmp/morning-report.log', name: 'Morning Report', critical: true },
  { path: '/tmp/globalpc-sync.log', name: 'GlobalPC Sync', critical: true },
  { path: '/tmp/entradas-anomaly.log', name: 'Entradas Anomaly', critical: false },
  { path: '/tmp/heartbeat.log', name: 'Heartbeat', critical: false },
  { path: '/tmp/weekly-audit.log', name: 'Weekly Audit', critical: true },
  { path: '/tmp/db-backup.log', name: 'DB Backup', critical: true },
  { path: '/tmp/tipo-cambio.log', name: 'Tipo Cambio', critical: false },
]

const ERROR_PATTERNS = [/error:/i, /fatal/i, /exception/i, /ECONNREFUSED/i, /ETIMEDOUT/i, /Access denied/i, /Cannot connect/i, /Failed to/i]

async function sendTelegram(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) })
}

async function checkLogs() {
  console.log('🔍 Checking error logs...\n')
  const issues = []

  for (const logFile of LOG_FILES) {
    if (!fs.existsSync(logFile.path)) { console.log(`  ⬜ ${logFile.name}: No log file yet`); continue }
    const content = fs.readFileSync(logFile.path, 'utf8')
    const lines = content.split('\n').slice(-50)
    const recentErrors = lines.filter(line => line.trim() && ERROR_PATTERNS.some(p => p.test(line)))

    if (recentErrors.length > 0) {
      const sample = recentErrors[recentErrors.length - 1].substring(0, 100)
      issues.push({ name: logFile.name, critical: logFile.critical, errors: recentErrors.length, sample })
      console.log(`  ❌ ${logFile.name}: ${recentErrors.length} error(s)`)
      console.log(`     ${sample}`)
    } else { console.log(`  ✅ ${logFile.name}: No errors`) }
  }

  if (issues.length === 0) { console.log('\n✅ All logs clean'); return }

  const critical = issues.filter(i => i.critical)
  const lines = [critical.length > 0 ? `🚨 <b>ERROR MONITOR — CRÍTICO</b>` : `⚠️ <b>ERROR MONITOR — ADVERTENCIA</b>`, `${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`, `━━━━━━━━━━━━━━━━━━━━`]
  issues.forEach(i => { lines.push(`${i.critical ? '🚨' : '⚠️'} <b>${i.name}</b>: ${i.errors} error(s)`); lines.push(`   ${i.sample}`) })
  lines.push(``, `— CRUZ 🦀`)
  await sendTelegram(lines.join('\n'))
  console.log(`\n⚠️  ${issues.length} issue(s) — alert sent`)
}

checkLogs().catch(err => { console.error('Fatal error:', err); process.exit(1) })
