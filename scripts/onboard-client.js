#!/usr/bin/env node

// ============================================================
// CRUZ Client Onboarding — one command, new client live
//
// Multi-tenant: creates company record in Supabase. The single
// portal at evco-portal.vercel.app serves all clients. No separate
// deploy needed — login password routes to the correct company_id.
//
// Usage:
//   node scripts/onboard-client.js \
//     --name "ACME Industries" \
//     --rfc "AIN123456ABC" \
//     --clave "1234" \
//     --email "contacto@acme.mx" \
//     --contact "María García"
//
// Options:
//   --dry-run    Preview without writing
//   --no-sync    Skip initial GlobalPC sync
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const NO_SYNC = process.argv.includes('--no-sync')
const TELEGRAM_CHAT = '-5085543275'

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
  const name = getArg('--name')
  const rfc = getArg('--rfc')
  const clave = getArg('--clave')
  const email = getArg('--email')
  const contact = getArg('--contact')

  if (!name || !rfc || !clave) {
    console.error('❌ Required: --name, --rfc, --clave')
    console.error('')
    console.error('Usage:')
    console.error('  node scripts/onboard-client.js \\')
    console.error('    --name "ACME Industries" \\')
    console.error('    --rfc "AIN123456ABC" \\')
    console.error('    --clave "1234" \\')
    console.error('    --email "contacto@acme.mx" \\')
    console.error('    --contact "María García"')
    process.exit(1)
  }

  // Generate company_id slug from name
  const companyId = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('-')

  // Portal password: slug + 2026
  const password = companyId.replace(/-/g, '') + '2026'

  console.log(`\n🦀 CRUZ Client Onboarding`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Nombre:     ${name}`)
  console.log(`  RFC:        ${rfc}`)
  console.log(`  Clave:      ${clave}`)
  console.log(`  Company ID: ${companyId}`)
  console.log(`  Password:   ${password}`)
  console.log(`  Email:      ${email || '—'}`)
  console.log(`  Contacto:   ${contact || '—'}`)
  console.log(`  Portal:     https://evco-portal.vercel.app`)
  console.log(`  Mode:       ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('')

  // ── Step 1: Check for duplicates ──
  console.log('1/7 Checking for duplicates...')
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id, name, rfc')
    .or(`company_id.eq.${companyId},clave_cliente.eq.${clave},rfc.eq.${rfc}`)
  if (existing && existing.length > 0) {
    console.error(`❌ Duplicate: ${existing.map(e => `${e.company_id} (${e.name})`).join(', ')}`)
    process.exit(1)
  }
  console.log('  ✅ No duplicates')

  if (DRY_RUN) {
    console.log('\n[DRY RUN — no changes made]')
    process.exit(0)
  }

  // ── Step 2: Create company record ──
  console.log('2/7 Creating company record...')
  const { error: insertErr } = await supabase.from('companies').insert({
    company_id: companyId,
    name,
    clave_cliente: clave,
    rfc,
    portal_password: password,
    active: true,
    contact_name: contact || null,
    contact_email: email || null,
    patente: '3596',
    aduana: '240',
    created_at: new Date().toISOString(),
  })
  if (insertErr) {
    console.error(`❌ Insert failed: ${insertErr.message}`)
    process.exit(1)
  }
  console.log('  ✅ Company created')

  // ── Step 3: Verify login ──
  console.log('3/7 Verifying portal login...')
  const { data: verify } = await supabase
    .from('companies')
    .select('company_id')
    .eq('portal_password', password)
    .eq('active', true)
    .single()
  if (verify) {
    console.log('  ✅ Login verified')
  } else {
    console.log('  ⚠️ Login verification failed — check companies table')
  }

  // ── Step 4: Initial data check ──
  console.log('4/7 Checking existing data...')
  const { count: trafCount } = await supabase
    .from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  const { count: factCount } = await supabase
    .from('aduanet_facturas')
    .select('*', { count: 'exact', head: true })
    .eq('clave_cliente', clave)
  console.log(`  Tráficos: ${trafCount || 0} · Facturas: ${factCount || 0}`)

  // ── Step 5: Initial GlobalPC sync ──
  if (!NO_SYNC && (trafCount === 0 || trafCount === null)) {
    console.log('5/7 Running initial GlobalPC sync...')
    try {
      const { execSync } = require('child_process')
      execSync(`node scripts/nightly-pipeline.js --company=${companyId}`, {
        cwd: path.resolve(__dirname, '..'),
        timeout: 300000,
        stdio: 'pipe',
      })
      console.log('  ✅ Initial sync complete')
    } catch (e) {
      console.log(`  ⚠️ Sync skipped: ${e.message?.substring(0, 60) || 'error'}`)
    }
  } else if (NO_SYNC) {
    console.log('5/7 Sync skipped (--no-sync)')
  } else {
    console.log('5/7 Data exists — sync not needed')
  }

  // ── Step 5b: Post-sync enrichment ──
  console.log('5b. Post-sync enrichment...')
  const { execSync: exec2 } = require('child_process')
  const cwd = path.resolve(__dirname, '..')

  // WSDL document pull
  try {
    exec2(`node scripts/wsdl-document-pull.js --company=${companyId}`, { cwd, timeout: 120000, stdio: 'pipe' })
    console.log('  ✅ Expediente documents pulled')
  } catch { console.log('  ⚠️ WSDL doc pull skipped') }

  // Supplier resolution
  try {
    exec2(`node scripts/full-client-sync.js --phase=suppliers --company=${companyId}`, { cwd, timeout: 60000, stdio: 'pipe' })
    console.log('  ✅ Supplier names resolved')
  } catch { console.log('  ⚠️ Supplier resolution skipped') }

  // Readiness score
  try {
    exec2(`node scripts/client-readiness-score.js --dry-run`, { cwd, timeout: 30000, stdio: 'pipe' })
    console.log('  ✅ Readiness scored')
  } catch { console.log('  ⚠️ Readiness score skipped') }

  // ── Step 6: Audit log ──
  console.log('6/7 Audit logging...')
  await supabase.from('audit_log').insert({
    action: 'client_onboarded',
    details: { company_id: companyId, name, rfc, clave, contact, email, password_set: true },
    actor: 'CRUZ',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})
  console.log('  ✅ Logged')

  // ── Step 7: Telegram notification ──
  console.log('7/7 Sending notification...')
  await sendTelegram([
    `🦀 <b>Nuevo cliente registrado</b>`,
    ``,
    `<b>${name}</b>`,
    `RFC: <code>${rfc}</code>`,
    `Clave: <code>${clave}</code>`,
    `Login: <code>${password}</code>`,
    contact ? `Contacto: ${contact}` : '',
    email ? `Email: ${email}` : '',
    ``,
    `Portal: https://evco-portal.vercel.app`,
    ``,
    `📋 Pendiente aprobación de Tito:`,
    `  • Email de bienvenida`,
    `  • Carta de Encomienda`,
    `  • Poder Notarial`,
    `  • Padrón de Importadores`,
    `— CRUZ 🦀`,
  ].filter(Boolean).join('\n'))

  // ── Summary ──
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ ${name} — onboarded`)
  console.log(``)
  console.log(`  Login: https://evco-portal.vercel.app`)
  console.log(`  Password: ${password}`)
  console.log(`  Company ID: ${companyId}`)
  console.log(``)
  console.log(`  Verify:`)
  console.log(`    node scripts/data-integrity-check.js`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
