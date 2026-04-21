#!/usr/bin/env node

// ============================================================
// CRUZ Client Activation — checks readiness, creates credentials
// Usage: node scripts/activate-client.js --company garlock [--dry-run]
// Called by Telegram bot via /activar command
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'
const ACTIVATION_THRESHOLD = 80

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
}

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function main() {
  const companyId = getArg('--company')
  if (!companyId) {
    console.error('Usage: node scripts/activate-client.js --company [company_id]')
    process.exit(1)
  }

  console.log(`🔑 CRUZ Client Activation — ${companyId}`)

  // 1. Get company
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', companyId)
    .single()

  if (!company) {
    console.error(`❌ Company "${companyId}" not found`)
    process.exit(1)
  }

  // 2. Check if already has portal access
  if (company.portal_password) {
    console.log(`⚠️ ${company.name} already has portal access (password set)`)
    console.log(`  Login: https://evco-portal.vercel.app`)
    process.exit(0)
  }

  // 3. Check readiness score
  const { data: readiness } = await supabase
    .from('client_readiness')
    .select('score, breakdown')
    .eq('company_id', companyId)
    .single()

  const score = readiness?.score || 0
  if (score < ACTIVATION_THRESHOLD) {
    console.log(`❌ Score ${score}/100 — below threshold (${ACTIVATION_THRESHOLD})`)
    console.log(`  Run: node scripts/client-readiness-score.js --dry-run`)
    await sendTelegram(`❌ <b>${company.name}</b> no está listo\nScore: ${score}/100 (mínimo ${ACTIVATION_THRESHOLD})\n— CRUZ 🦀`)
    process.exit(1)
  }

  console.log(`  Score: ${score}/100 ✅`)

  // 4. Generate credentials
  const password = companyId.replace(/-/g, '') + '2026'

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would set password: ${password}`)
    process.exit(0)
  }

  // 5. Set portal password
  await supabase.from('companies').update({
    portal_password: password,
  }).eq('company_id', companyId)

  // 6. Audit log
  await supabase.from('audit_log').insert({
    action: 'client_activated',
    resource: 'companies',
    resource_id: companyId,
    diff: { name: company.name, score, password_set: true },
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {})

  // 7. Telegram
  await sendTelegram([
    `🔑 <b>Cliente activado: ${company.name}</b>`,
    ``,
    `Score: <b>${score}/100</b>`,
    `Login: <code>${password}</code>`,
    `Portal: https://evco-portal.vercel.app`,
    ``,
    `📋 Pendiente: email de bienvenida (requiere aprobación)`,
    `— CRUZ 🦀`,
  ].join('\n'))

  console.log(`\n✅ ${company.name} activated`)
  console.log(`  Password: ${password}`)
  console.log(`  Portal: https://evco-portal.vercel.app`)
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
