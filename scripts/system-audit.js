require('dotenv').config({ path: '.env.local' })
const fs = require('fs'); const path = require('path')

console.log('\n🛡️  CRUZ SYSTEM AUDIT')
console.log('═'.repeat(60))
console.log(`Date: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago' })}`)
console.log('═'.repeat(60))

console.log('\n── Environment Variables')
const REQUIRED = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase URL', critical: true },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase Anon Key', critical: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase Service Role', critical: true },
  { key: 'TELEGRAM_BOT_TOKEN', desc: 'Telegram Bot', critical: true },
  { key: 'REVALIDATE_SECRET', desc: 'Portal Revalidation', critical: true },
  { key: 'PORTAL_PASSWORD', desc: 'Portal Password', critical: true },
  { key: 'ANTHROPIC_API_KEY', desc: 'Claude API', critical: false },
  { key: 'BANXICO_TOKEN', desc: 'Banxico Exchange Rate', critical: false },
  { key: 'GMAIL_CLIENT_ID', desc: 'Gmail OAuth Client ID', critical: false },
  { key: 'GMAIL_CLIENT_SECRET', desc: 'Gmail OAuth Secret', critical: false },
  { key: 'GMAIL_REFRESH_TOKEN', desc: 'Gmail Refresh Token', critical: false },
  { key: 'GMAIL_FROM', desc: 'Gmail Send Address', critical: false },
  { key: 'URSULA_EMAIL', desc: 'Ursula Email', critical: false },
  { key: 'GLOBALPC_WSDL_URL', desc: 'GlobalPC WSDL', critical: false },
  { key: 'GLOBALPC_USER', desc: 'GlobalPC User', critical: false },
  { key: 'GLOBALPC_PASS', desc: 'GlobalPC Pass', critical: false },
  { key: 'WEBHOOK_SECRET', desc: 'n8n Webhook', critical: false },
]

let crit = 0, opt = 0
REQUIRED.forEach(({ key, desc, critical }) => {
  const val = process.env[key]
  if (val && val.length > 3) { const m = val.substring(0, 6) + '...' + val.substring(val.length - 3); console.log(`  ✅ ${key.padEnd(35)} ${m}`) }
  else if (critical) { console.log(`  🔴 ${key.padEnd(35)} MISSING — ${desc}`); crit++ }
  else { console.log(`  ⚪ ${key.padEnd(35)} Not set — ${desc}`); opt++ }
})

console.log('\n── Git Safety')
const gi = path.join(process.cwd(), '.gitignore')
if (fs.existsSync(gi)) { const g = fs.readFileSync(gi, 'utf8'); ['.env.local', '.env', 'node_modules'].forEach(c => console.log(`  ${g.includes(c) ? '✅' : '⚠️ '} ${c} ${g.includes(c) ? 'in' : 'NOT in'} .gitignore`)) }

console.log('\n── Scripts')
const scripts = ['morning-report','entradas-anomaly','evco-weekly-audit','telegram-bot','heartbeat','error-monitor','database-backup','globalpc-sync','proveedor-intelligence','fraccion-intelligence','anomaly-baseline','tmec-guardian','igi-checker','tmec-weekly-audit','kpi-alerts','weekly-executive-summary','deep-research-scheduler','carrier-scorecard','send-weekly-audit','ollama-classifier','validate-client','onboard-client','new-client-checklist','system-audit','pcnet-sync']
scripts.forEach(s => { const exists = fs.existsSync(path.join(process.cwd(), 'scripts', s + '.js')); console.log(`  ${exists ? '✅' : '❌'} scripts/${s}.js`) })

console.log('\n' + '═'.repeat(60))
console.log('SUMMARY')
console.log(`  Scripts: ${scripts.filter(s => fs.existsSync(path.join(process.cwd(), 'scripts', s + '.js'))).length}/${scripts.length}`)
console.log(`  Critical missing: ${crit}`)
console.log(`  Optional missing: ${opt}`)
console.log(crit === 0 ? '\n🟢 System is READY' : `\n🔴 ${crit} critical issue(s)`)
console.log('')
